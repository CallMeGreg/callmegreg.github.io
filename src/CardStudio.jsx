import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CARD_HEIGHT, CARD_WIDTH, MAX_CARDS, MAX_PRINT_COPIES, PAPER_SIZES, RARITIES,
  STORAGE_KEY, TEMPLATES, TYPES, createCard, createProject, getImageDpi,
  getPackLayout, getPrintPages, newId, normalizeBackStyle, parseProject, serializeProject,
} from './cardStudioModel.mjs';
import { getCardLayout, renderBackSvg, renderCardSvg, svgDataUrl } from './cardStudioRender.mjs';
import { assertProjectCapacity, downloadPng, downloadText, fileName, readArtwork, readProjectFile } from './cardStudioFiles.mjs';
import { getPackPlacement, renderPackSvg } from './cardStudioPack.mjs';
import { randomizeCards } from './cardStudioRandomize.mjs';
import './CardStudio.css';

const TYPE_LABELS = Object.fromEntries(TYPES.map(type => [type.id, type.label]));
const PAGE_THEMES = new Set(['blueprint', 'press', 'neon']);
const TABS = [
  { id: 'design', label: 'Design', icon: 'cards' },
  { id: 'print', label: 'Print', icon: 'print' },
  { id: 'packs', label: 'Pack', icon: 'box' },
];

function Icon({ name, size = 18, ...props }) {
  const paths = {
    cards: <><rect x="7" y="5" width="13" height="17" rx="2" /><path d="M4 18H3a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2" /><path d="m13.5 10 1.2 2.8 2.8 1.2-2.8 1.2-1.2 2.8-1.2-2.8-2.8-1.2 2.8-1.2z" /></>,
    print: <><path d="M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v8H6zM17 11h1" /></>,
    box: <><path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10M8 4l9 5" /></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M3 16v5h18v-5" /></>,
    upload: <><path d="M12 16V4m-5 5 5-5 5 5M3 16v5h18v-5" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    left: <path d="m14 6-6 6 6 6" />,
    right: <path d="m10 6 6 6-6 6" />,
    copy: <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 5V3H3v13h2" /></>,
    trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" /></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="2" /><path d="m3 17 6-6 4 4 3-3 5 5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    alert: <><path d="m12 3 10 18H2zM12 9v5m0 3v1" /></>,
    search: <><circle cx="10" cy="10" r="7" /><path d="m15 15 6 6" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    reset: <><path d="M3 10a9 9 0 1 1 2 8M3 3v7h7" /></>,
    spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5zM21 2v4m-2-2h4" /></>,
    ruler: <><path d="m3 16 13-13 5 5L8 21zM12 7l2 2m-5 1 2 2m-5 1 2 2" /></>,
    shield: <><path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6z" /><path d="m8 12 3 3 5-6" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.spark}</svg>;
}

function Field({ label, hint, children, className = '' }) {
  return <label className={`cs-field ${className}`}><span className="cs-field-label">{label}{hint && <small>{hint}</small>}</span>{children}</label>;
}

function TextField({ label, value, onChange, maxLength, multiline = false, hint, placeholder = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!multiline || !ref.current) return;
    ref.current.style.height = 'auto';
    ref.current.style.height = `${Math.min(240, ref.current.scrollHeight)}px`;
  }, [value, multiline]);
  const props = { value, maxLength, placeholder, onChange: event => onChange(event.target.value) };
  return <Field label={label} hint={hint || (maxLength && value.length > maxLength * 0.8 ? `${value.length}/${maxLength}` : '')}>
    {multiline ? <textarea {...props} ref={ref} rows="2" /> : <input {...props} type="text" />}
  </Field>;
}

function SelectField({ label, value, onChange, options, hint }) {
  return <Field label={label} hint={hint}><select value={value} onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></Field>;
}

function RangeField({ label, value, onChange, min, max, step = 1, unit = '' }) {
  return <Field label={label} hint={`${Number(value.toFixed(3))}${unit}`}><input type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} /></Field>;
}

function SectionTitle({ number, title, children }) {
  return <div className="cs-section-title"><div>{number && <span className="cs-eyebrow">{number}</span>}<h2>{title}</h2></div>{children}</div>;
}

function ArtworkInput({ art, onUpload, onRemove, busy, label = 'Upload artwork' }) {
  const [dragging, setDragging] = useState(false);
  return <div>
    <label className={`cs-art-upload ${dragging ? 'is-dragging' : ''}`}
      onDragOver={event => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={event => {
        event.preventDefault();
        setDragging(false);
        if (!busy) onUpload(event.dataTransfer.files[0]);
      }}>
      <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} aria-label={label} onChange={event => { const file = event.target.files[0]; event.target.value = ''; if (file) onUpload(file); }} />
      {art ? <img src={art.data} alt="Uploaded artwork" /> : <span className="cs-upload-icon"><Icon name="image" size={25} /></span>}
      <strong>{art ? 'Replace artwork' : 'Drop your artwork here'}</strong>
      <span>{art ? `${art.width} x ${art.height} px` : <>or <em>browse files</em></>}</span>
      <small>PNG, JPEG or WebP / up to 20 MB</small>
    </label>
    {art && <div className="cs-art-caption"><span title={art.name}>{art.name}</span><button className="cs-text-button" onClick={onRemove} disabled={busy}>Remove</button></div>}
  </div>;
}

function CropControls({ fit, x, y, zoom, onChange }) {
  return <div className="cs-crop-controls">
    <SelectField label="Image fit" value={fit} onChange={value => onChange({ fit: value })} options={[{ id: 'cover', label: 'Fill frame (crop edges)' }, { id: 'contain', label: 'Fit whole image (no cropping)' }]} />
    <RangeField label="Zoom" value={zoom} min={1} max={3} step={0.05} unit="x" onChange={value => onChange({ zoom: value })} />
    <RangeField label="Horizontal position" value={x} min={0} max={100} unit="%" onChange={value => onChange({ x: value })} />
    <RangeField label="Vertical position" value={y} min={0} max={100} unit="%" onChange={value => onChange({ y: value })} />
    <button className="cs-text-button" onClick={() => onChange({ fit: 'cover', x: 50, y: 50, zoom: 1 })}><Icon name="reset" size={14} /> Center artwork</button>
  </div>;
}

function cardDpi(card) {
  const box = getCardLayout(card).artBox;
  return getImageDpi(card.art, box.width / 300, box.height / 300, card.artFit, card.artZoom);
}

const CardThumbnail = memo(function CardThumbnail({ card }) {
  const source = useMemo(() => svgDataUrl(renderCardSvg(card)), [card]);
  return <img src={source} alt="" loading="lazy" width="50" height="70" />;
});

function CardLibrary({ project, onSelect, onAdd, onRandomize, onName, busy }) {
  const [query, setQuery] = useState('');
  const cards = project.cards.filter(card => `${card.name} ${TYPE_LABELS[card.type]}`.toLowerCase().includes(query.toLowerCase()));
  return <aside className="cs-library cs-panel" aria-label="Card collection">
    <div className="cs-library-top"><span className="cs-eyebrow">YOUR COLLECTION</span><span className="cs-count">{project.cards.length}</span></div>
    <TextField label="Project name" value={project.name} onChange={onName} maxLength={80} />
    <div className="cs-library-actions">
      <button className="cs-button cs-add-card" onClick={onAdd} disabled={busy || project.cards.length >= MAX_CARDS}><Icon name="plus" size={17} /> New card</button>
      <button className="cs-button cs-subtle" onClick={onRandomize} disabled={busy}><Icon name="spark" size={17} /> Randomize cards</button>
    </div>
    <label className="cs-search"><Icon name="search" size={15} /><input type="search" aria-label="Search cards" placeholder="Find a card..." value={query} onChange={event => setQuery(event.target.value)} /></label>
    <div className="cs-card-list">
      {cards.map(card => <button key={card.id} className={`cs-library-card ${project.selectedId === card.id ? 'is-selected' : ''}`} onClick={() => onSelect(card.id)} aria-pressed={project.selectedId === card.id}>
        <CardThumbnail card={card} />
        <span className="cs-library-copy"><strong>{card.name || 'Untitled card'}</strong><span><i style={{ background: TYPES.find(type => type.id === card.type).color }} />{TYPE_LABELS[card.type]}</span><small>{card.number || '---'} / {card.template === 'full-art' ? 'Full art' : card.template}</small></span>
        <span className="cs-library-quantity">{card.quantity}x</span>
      </button>)}
      {!cards.length && <p className="cs-empty">No cards match that search.</p>}
    </div>
    <div className="cs-library-footer"><Icon name="shield" size={17} /><p>A world of your own.<span>Private, local, and made by you.</span></p></div>
  </aside>;
}

function DesignFields({ card, update }) {
  const creature = ['classic', 'full-art'].includes(card.template);
  return <div className="cs-fields">
    <div className="cs-field"><span className="cs-field-label">Choose a layout</span><div className="cs-template-grid">{TEMPLATES.map(template => <button key={template.id} title={template.description} className={`cs-template ${template.id === card.template ? 'is-active' : ''}`} aria-pressed={template.id === card.template} onClick={() => update({ template: template.id })}><span className={`cs-template-icon cs-template-${template.id}`}><i /><i /><i /></span><span>{template.label}</span>{template.id === card.template && <Icon name="check" size={12} />}</button>)}</div></div>
    <TextField label="Card name" value={card.name} onChange={name => update({ name })} maxLength={70} placeholder="Give your creation a name" />
    <div className="cs-field-row">
      <SelectField label="Element" value={card.type} onChange={type => update({ type })} options={TYPES} />
      {creature && <TextField label="HP" value={card.hp} onChange={hp => update({ hp })} maxLength={6} />}
    </div>
    {creature && <><TextField label="Stage" value={card.stage} onChange={stage => update({ stage })} maxLength={30} hint="Basic, Stage 1, Stage 2..." /><TextField label="Evolves from" value={card.evolvesFrom} onChange={evolvesFrom => update({ evolvesFrom })} maxLength={70} placeholder="Optional" /></>}
    <TextField label="Species / subtitle" value={card.subtitle} onChange={subtitle => update({ subtitle })} maxLength={120} />
    {card.template !== 'full-art' && <SelectField label="Frame finish" value={card.border} onChange={border => update({ border })} options={[{ id: 'gold', label: 'Champagne gold' }, { id: 'silver', label: 'Brushed silver' }, { id: 'dark', label: 'Midnight' }]} />}
    <div className="cs-inspector-divider" />
    <SelectField label="Rarity" value={card.rarity} onChange={rarity => update({ rarity })} options={RARITIES} />
    <div className="cs-field-row"><TextField label="Set code" value={card.setCode} onChange={setCode => update({ setCode })} maxLength={16} /><TextField label="Card number" value={card.number} onChange={number => update({ number })} maxLength={16} /></div>
    <TextField label="Illustrator" value={card.illustrator} onChange={illustrator => update({ illustrator })} maxLength={70} />
  </div>;
}

function RulesFields({ card, update }) {
  const creature = ['classic', 'full-art'].includes(card.template);
  const changeMove = (index, changes) => update({ moves: card.moves.map((move, position) => position === index ? { ...move, ...changes } : move) });
  return <div className="cs-fields">
    <span className="cs-eyebrow">{creature ? 'ABILITY / OPTIONAL' : 'CARD EFFECT'}</span>
    <TextField label={creature ? 'Ability name' : 'Effect title'} value={card.abilityName} onChange={abilityName => update({ abilityName })} maxLength={60} placeholder="Something extraordinary" />
    <TextField label={creature ? 'Ability text' : 'Effect text'} value={card.abilityText} onChange={abilityText => update({ abilityText })} maxLength={700} multiline placeholder="What does your card do?" />
    {creature && <>
      <div className="cs-inspector-divider" />
      <div className="cs-mini-heading"><span className="cs-eyebrow">MOVES</span><span>{card.moves.length} / 3</span></div>
      {card.moves.map((move, index) => <div className="cs-move" key={index}>
        <div className="cs-mini-heading"><strong>Move {index + 1}</strong><button className="cs-icon-button" aria-label={`Remove move ${index + 1}`} onClick={() => update({ moves: card.moves.filter((_, position) => position !== index) })}><Icon name="close" size={14} /></button></div>
        <div className="cs-field-row cs-move-heading"><TextField label="Move name" value={move.name} onChange={name => changeMove(index, { name })} maxLength={60} /><TextField label="Damage" value={move.damage} onChange={damage => changeMove(index, { damage })} maxLength={8} /></div>
        <div className="cs-field"><span className="cs-field-label">Energy cost <small>Click an energy to remove</small></span><div className="cs-costs">
          {move.cost.map((type, costIndex) => <button key={costIndex} title={`Remove ${TYPE_LABELS[type]} energy`} aria-label={`Remove ${TYPE_LABELS[type]} energy ${costIndex + 1} from move ${index + 1}`} style={{ '--energy-color': TYPES.find(item => item.id === type).color }} onClick={() => changeMove(index, { cost: move.cost.filter((_, position) => position !== costIndex) })}>{TYPE_LABELS[type].slice(0, 1)}</button>)}
          <select aria-label={`Add energy to move ${index + 1}`} value="" disabled={move.cost.length >= 8} onChange={event => { if (event.target.value) changeMove(index, { cost: [...move.cost, event.target.value] }); }}><option value="">+ Energy</option>{TYPES.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}</select>
        </div></div>
        <TextField label="Move description" value={move.text} onChange={text => changeMove(index, { text })} maxLength={700} multiline />
      </div>)}
      <button className="cs-button cs-subtle" disabled={card.moves.length >= 3} onClick={() => update({ moves: [...card.moves, { name: '', damage: '', cost: [card.type], text: '' }] })}><Icon name="plus" size={15} /> Add a move</button>
      <div className="cs-inspector-divider" />
      <div className="cs-field-row"><SelectField label="Weakness" value={card.weakness} onChange={weakness => update({ weakness })} options={[{ id: '', label: 'None' }, ...TYPES]} /><TextField label="Multiplier" value={card.weaknessModifier} onChange={weaknessModifier => update({ weaknessModifier })} maxLength={8} /></div>
      <div className="cs-field-row"><SelectField label="Resistance" value={card.resistance} onChange={resistance => update({ resistance })} options={[{ id: '', label: 'None' }, ...TYPES]} /><TextField label="Reduction" value={card.resistanceModifier} onChange={resistanceModifier => update({ resistanceModifier })} maxLength={8} /></div>
      <SelectField label="Retreat cost" value={card.retreat} onChange={retreat => update({ retreat: Number(retreat) })} options={Array.from({ length: 6 }, (_, index) => ({ id: index, label: `${index} energy` }))} />
    </>}
    <div className="cs-inspector-divider" />
    <TextField label="Flavor text" value={card.flavor} onChange={flavor => update({ flavor })} maxLength={300} multiline placeholder="Every card has a story." />
  </div>;
}

function ArtFields({ card, update, upload, busy }) {
  return <div className="cs-fields">
    <ArtworkInput art={card.art} onUpload={upload} onRemove={() => update({ art: null, artX: 50, artY: 50, artZoom: 1 })} busy={busy} label="Upload card artwork" />
    {card.art && <CropControls fit={card.artFit} x={card.artX} y={card.artY} zoom={card.artZoom} onChange={changes => update({
      ...(changes.fit !== undefined && { artFit: changes.fit }),
      ...(changes.x !== undefined && { artX: changes.x }),
      ...(changes.y !== undefined && { artY: changes.y }),
      ...(changes.zoom !== undefined && { artZoom: changes.zoom }),
    })} />}
    <div className="cs-tip"><Icon name="ruler" size={19} /><div><strong>Any image. Always card-sized.</strong><p>Your artwork is never stretched. Crop or contain it inside a fixed 2.5 x 3.5-inch card. For full-card art, start with at least 750 x 1050 px; more if you crop or zoom.</p></div></div>
  </div>;
}

function BackFields({ back, update, upload, busy }) {
  return <div className="cs-fields">
    <p className="cs-help cs-help-top">One matching back for the whole collection. All backs use the same 2.5 x 3.5-inch trim size.</p>
    <SelectField label="Back design" value={normalizeBackStyle(back.style)} onChange={style => update({ style })} options={[
      { id: 'studio', label: 'Starfall / Studio original' },
      { id: 'custom', label: 'Custom artwork' },
    ]} />
    {back.style === 'studio' ? <>
      <TextField label="Collection title" value={back.label} onChange={label => update({ label })} maxLength={40} />
      <TextField label="Subtitle" value={back.sublabel} onChange={sublabel => update({ sublabel })} maxLength={80} />
      <Field label="Back color" hint={back.color}><input type="color" value={back.color} onChange={event => update({ color: event.target.value })} /></Field>
    </> : <>
      <ArtworkInput art={back.art} onUpload={upload} onRemove={() => update({ art: null })} busy={busy} label="Upload card back artwork" />
      {!back.art && <p className="cs-warning-text">Upload artwork before exporting or printing this back.</p>}
      <CropControls fit={back.fit} x={back.x} y={back.y} zoom={back.zoom} onChange={update} />
      <Field label="Letterbox / bleed color" hint={back.color}><input type="color" value={back.color} onChange={event => update({ color: event.target.value })} /></Field>
    </>}
  </div>;
}

function Inspector({ card, project, section, setSection, updateCard, updateBack, upload, duplicate, remove, busy }) {
  return <aside className="cs-inspector cs-panel" aria-label="Card editor">
    <div className="cs-inspector-header"><div><span className="cs-eyebrow">THE DETAILS</span><h2>Make it yours.</h2></div><div className="cs-inline-actions"><button className="cs-icon-button" aria-label="Duplicate selected card" title="Duplicate card" onClick={duplicate} disabled={busy || project.cards.length >= MAX_CARDS}><Icon name="copy" size={16} /></button><button className="cs-icon-button cs-danger" aria-label="Delete selected card" title="Delete card" onClick={remove} disabled={busy || project.cards.length === 1}><Icon name="trash" size={16} /></button></div></div>
    <div className="cs-inspector-tabs" aria-label="Editor sections">{[['design', 'Design'], ['rules', 'Rules'], ['art', 'Artwork'], ['back', 'Back']].map(([id, label]) => <button key={id} onClick={() => setSection(id)} aria-pressed={section === id} className={section === id ? 'is-active' : ''}>{label}</button>)}</div>
    <div className="cs-inspector-content">
      {section === 'design' && <DesignFields card={card} update={updateCard} />}
      {section === 'rules' && <RulesFields card={card} update={updateCard} />}
      {section === 'art' && <ArtFields card={card} update={updateCard} upload={file => upload(file, 'card', card.id)} busy={busy} />}
      {section === 'back' && <BackFields back={project.back} update={updateBack} upload={file => upload(file, 'back')} busy={busy} />}
    </div>
  </aside>;
}

function CardPreview({ card, back, side, setSide, guides, setGuides, bleed, setBleed, exportCard, busy }) {
  const source = useMemo(() => svgDataUrl(side === 'front' ? renderCardSvg(card, { guides }) : renderBackSvg(back, { guides })), [card, back, side, guides]);
  const layout = useMemo(() => getCardLayout(card), [card]);
  return <section className="cs-preview" aria-label="Live card preview">
    <div className="cs-preview-toolbar"><span className="cs-eyebrow"><span className="cs-live-dot" />LIVE PREVIEW</span><button className={`cs-guide-toggle ${guides ? 'is-active' : ''}`} aria-pressed={guides} onClick={() => setGuides(!guides)}><Icon name="ruler" size={15} /> Safe area</button></div>
    <div className="cs-preview-stage">
      <div className="cs-dimension cs-dimension-top"><span>2.5 IN / 63.5 MM</span></div>
      <div className="cs-card-display"><img src={source} alt={`${card.name || 'Untitled card'} ${side} preview`} width="750" height="1050" /></div>
      <div className="cs-dimension cs-dimension-side"><span>3.5 IN / 88.9 MM</span></div>
    </div>
    <div className="cs-preview-below"><div className="cs-segmented"><button className={side === 'front' ? 'is-active' : ''} aria-pressed={side === 'front'} onClick={() => setSide('front')}>Front</button><button className={side === 'back' ? 'is-active' : ''} aria-pressed={side === 'back'} onClick={() => setSide('back')}>Back</button></div></div>
    {side === 'front' && layout.warnings.length > 0 && <div className={`cs-preview-warning ${layout.overflow ? 'is-error' : ''}`} role={layout.overflow ? 'alert' : 'status'}><Icon name="alert" size={16} /><span>{layout.warnings.join(' ')}</span></div>}
    {guides && <p className="cs-preview-hint">Dashed inset = safe area. Guides are never included in card downloads.</p>}
    <div className="cs-preview-export"><span className="cs-eyebrow">READY WHEN YOU ARE</span><div className="cs-export-actions"><button className="cs-button" disabled={busy} onClick={() => exportCard('png', 300)}><Icon name="download" size={15} /> PNG <span>300 DPI</span></button><details className="cs-export-more"><summary aria-label="More card export options"><Icon name="right" size={14} /></summary><div><button disabled={busy} onClick={() => exportCard('png', 600)}>PNG / 600 DPI</button><button disabled={busy} onClick={() => exportCard('svg')}>SVG / vector</button></div></details></div></div>
    <label className="cs-check cs-export-bleed"><input type="checkbox" checked={bleed} onChange={event => setBleed(event.target.checked)} /><span>Include 1/8-inch bleed in downloads <small>{bleed ? '2.75 x 3.75 in, including bleed' : '2.5 x 3.5 in, trimmed'}</small></span></label>
  </section>;
}

function SheetMarks({ layout, settings, side }) {
  if (!settings.cropMarks) return null;
  const { width, height, originX, originY, columns, rows, cellWidth, cellHeight, bleed } = layout;
  const dx = side === 'back' ? settings.offsetX / 25.4 : 0;
  const dy = side === 'back' ? settings.offsetY / 25.4 : 0;
  const xs = new Set();
  const ys = new Set();
  for (let column = 0; column < columns; column += 1) {
    xs.add(originX + column * cellWidth + bleed + dx);
    xs.add(originX + column * cellWidth + bleed + CARD_WIDTH + dx);
  }
  for (let row = 0; row < rows; row += 1) {
    ys.add(originY + row * cellHeight + bleed + dy);
    ys.add(originY + row * cellHeight + bleed + CARD_HEIGHT + dy);
  }
  const left = originX + dx;
  const top = originY + dy;
  const right = left + columns * cellWidth;
  const bottom = top + rows * cellHeight;
  return <svg className="cs-sheet-marks" viewBox={`0 0 ${width} ${height}`} aria-hidden="true"><g stroke="#252525" strokeWidth="0.006" fill="none">{[...xs].map(x => <path key={`x${x}`} d={`M${x} ${top - 0.1}v0.07M${x} ${bottom + 0.03}v0.07`} />)}{[...ys].map(y => <path key={`y${y}`} d={`M${left - 0.1} ${y}h0.07M${right + 0.03} ${y}h0.07`} />)}</g></svg>;
}

function CardSheet({ layout, page, settings, back, printing = false }) {
  const backSource = useMemo(() => svgDataUrl(renderBackSvg(back, { bleed: settings.bleed })), [back, settings.bleed]);
  const cardSources = useMemo(() => new Map(page.slots.map(slot => [slot.card.id, svgDataUrl(renderCardSvg(slot.card, { bleed: settings.bleed }))])), [page, settings.bleed]);
  return <div className="cs-paper" style={{ aspectRatio: `${layout.width} / ${layout.height}`, ...(printing && { width: `${layout.width}in`, height: `${layout.height}in` }) }} aria-label={`Sheet ${page.sheetNumber}, ${page.side === 'front' ? 'fronts' : 'backs'}`}>
    {page.slots.map(slot => <img className="cs-sheet-slot" key={slot.index} src={page.side === 'front' ? cardSources.get(slot.card.id) : backSource} alt={`${slot.card.name} ${page.side}`} style={{
      ...(printing ? {
        left: `${slot.x}in`, top: `${slot.y}in`,
        width: `${layout.cellWidth}in`, height: `${layout.cellHeight}in`,
      } : {
        left: `${slot.x / layout.width * 100}%`, top: `${slot.y / layout.height * 100}%`,
        width: `${layout.cellWidth / layout.width * 100}%`, height: `${layout.cellHeight / layout.height * 100}%`,
      }),
      transform: `rotate(${slot.rotation}deg)`,
    }} />)}
    <SheetMarks layout={layout} settings={settings} side={page.side} />
  </div>;
}

function PrintSettings({ settings, update }) {
  return <div className="cs-fields">
    <div className="cs-field-row"><SelectField label="Paper size" value={settings.paper} onChange={paper => update({ paper })} options={Object.entries(PAPER_SIZES).map(([id, paper]) => ({ id, label: paper.label }))} /><SelectField label="Orientation" value={settings.orientation} onChange={orientation => update({ orientation })} options={[{ id: 'portrait', label: 'Portrait' }, { id: 'landscape', label: 'Landscape' }]} /></div>
    <SelectField label="Printer-safe margin" value={settings.margin} onChange={margin => update({ margin: Number(margin) })} options={[{ id: 0.125, label: '1/8 in / 3.2 mm (check your printer)' }, { id: 0.25, label: '1/4 in / 6.4 mm (recommended)' }, { id: 0.5, label: '1/2 in / 12.7 mm' }, { id: 0.75, label: '3/4 in / 19.1 mm' }]} />
    <label className="cs-check"><input type="checkbox" checked={settings.bleed} onChange={event => update({ bleed: event.target.checked })} /><span>Add 1/8-inch bleed<small>Extra color outside each trim edge.</small></span></label>
    <label className="cs-check"><input type="checkbox" checked={settings.cropMarks} onChange={event => update({ cropMarks: event.target.checked })} /><span>Show cut marks<small>Marks stay outside the cards and reach 0.1 in into the margins. Increase margins if your printer clips them.</small></span></label>
    <div className="cs-inspector-divider" />
    <SelectField label="Print sides" value={settings.sides} onChange={sides => update({ sides })} options={[{ id: 'both', label: 'Fronts + backs / automatic duplex' }, { id: 'fronts', label: 'Fronts only' }, { id: 'backs', label: 'Backs only' }]} />
    <SelectField label="Duplex flip edge" value={settings.flip} onChange={flip => update({ flip })} options={[{ id: 'long-edge', label: 'Flip on long edge' }, { id: 'short-edge', label: 'Flip on short edge' }]} />
    <p className="cs-help">Backs are mirrored into the matching slots, including partial sheets. Use this same flip edge in your printer settings.</p>
    <details className="cs-disclosure"><summary>Back alignment / calibration</summary><div className="cs-fields">
      <RangeField label="Back horizontal offset" value={settings.offsetX} min={-5} max={5} step={0.1} unit=" mm" onChange={offsetX => update({ offsetX })} />
      <RangeField label="Back vertical offset" value={settings.offsetY} min={-5} max={5} step={0.1} unit=" mm" onChange={offsetY => update({ offsetY })} />
      <p className="cs-help">Positive values move the back right/down as seen in the back-page preview. Test one sheet and measure it against a light. More margin clearance may be needed.</p>
      <button className="cs-text-button" onClick={() => update({ offsetX: 0, offsetY: 0 })}>Reset alignment</button>
    </div></details>
  </div>;
}

function printPreflight(project) {
  const errors = [];
  const warnings = [];
  let result = null;
  try { result = getPrintPages(project); } catch (error) { errors.push(error.message); }
  if (project.print.sides !== 'fronts' && project.back.style !== 'studio' && !project.back.art) {
    errors.push('The selected back needs artwork. Upload a back, choose the studio original, or print fronts only.');
  }
  if (project.print.sides !== 'backs') {
    for (const card of project.cards.filter(item => item.quantity > 0)) {
      const layout = getCardLayout(card);
      if (layout.overflow) errors.push(`${card.name || 'Untitled card'}: too much text to print. Shorten its rules or name.`);
      else if (layout.warnings.length) warnings.push(`${card.name || 'Untitled card'}: ${layout.warnings.join(' ')}`);
      const dpi = cardDpi(card);
      if (dpi !== null && dpi < 300) warnings.push(`${card.name || 'Untitled card'}: artwork is ${dpi} DPI at this crop; 300 DPI is recommended.`);
    }
  }
  if (project.print.sides !== 'fronts' && project.back.art && project.back.style !== 'studio') {
    const dpi = getImageDpi(project.back.art, CARD_WIDTH, CARD_HEIGHT, project.back.fit, project.back.zoom);
    if (dpi < 300) warnings.push(`Back artwork is ${dpi} DPI; a larger image will print more clearly.`);
  }
  return { result, errors, warnings };
}

function PrintStudio({ project, updatePrint, updateQuantity, setAllQuantities, preflight, beginPrint, busy, editBack }) {
  const [pageIndex, setPageIndex] = useState(0);
  const result = preflight.result;
  const shownIndex = result ? Math.min(pageIndex, result.pages.length - 1) : 0;
  const page = result?.pages[shownIndex];
  return <div className="cs-print-workspace">
    <aside className="cs-panel cs-print-settings"><SectionTitle number="PAPER & PRECISION" title="A good impression." /><PrintSettings settings={project.print} update={updatePrint} /><button className="cs-text-button" onClick={editBack}>Edit the collection back <Icon name="arrow" size={15} /></button></aside>
    <section className="cs-print-main">
      <div className="cs-print-summary"><div><span className="cs-eyebrow">YOUR PRINT SHEET</span><h2>{result ? `${result.totalCopies} ${result.totalCopies === 1 ? 'card' : 'cards'}. Ready to become real.` : 'Let’s get this print-ready.'}</h2></div>{result && <span className="cs-badge">{result.layout.capacity} cards / sheet</span>}</div>
      <div className="cs-print-instruction"><Icon name="ruler" size={23} /><p><strong>Actual size. Every time.</strong>Print at 100%, with {PAPER_SIZES[project.print.paper].label} paper, {project.print.orientation} orientation, no browser headers/footers, and no fit-to-page scaling. Or choose Save as PDF.</p></div>
      {preflight.errors.length > 0 && <div className="cs-preflight is-error" role="alert"><strong>Before you print</strong><ul>{preflight.errors.map(error => <li key={error}>{error}</li>)}</ul></div>}
      {preflight.warnings.length > 0 && <details className="cs-preflight"><summary>{preflight.warnings.length} quality {preflight.warnings.length === 1 ? 'note' : 'notes'} / review before printing</summary><ul>{preflight.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
      <div className="cs-sheet-stage">{page ? <CardSheet layout={result.layout} page={page} settings={project.print} back={project.back} /> : <div className="cs-empty-sheet"><Icon name="print" size={42} /><p>Choose at least one card and resolve the notes above to build your sheets.</p></div>}</div>
      {result && <div className="cs-page-navigation"><button className="cs-icon-button" aria-label="Previous print page" disabled={shownIndex <= 0} onClick={() => setPageIndex(shownIndex - 1)}><Icon name="left" /></button><span>Sheet {page.sheetNumber} / {page.side === 'front' ? 'Fronts' : 'Backs'}<small>Page {shownIndex + 1} of {result.pages.length}</small></span><button className="cs-icon-button" aria-label="Next print page" disabled={shownIndex >= result.pages.length - 1} onClick={() => setPageIndex(shownIndex + 1)}><Icon name="right" /></button></div>}
      <div className="cs-print-bottom"><p>{result ? `${result.sheetCount} physical ${result.sheetCount === 1 ? 'sheet' : 'sheets'}${project.print.sides === 'both' ? ' / interleaved fronts & backs' : ''}` : 'No print job yet'}<small>Test one sheet before printing the full collection.</small></p><button className="cs-button cs-primary" disabled={busy || preflight.errors.length > 0} onClick={() => beginPrint('cards')}><Icon name="print" /> Print / Save PDF</button></div>
      <details className="cs-disclosure cs-manual-help"><summary>Printing two-sided cards without automatic duplex?</summary><p>Choose Fronts only, print one sheet, and mark the top edge of the paper. Reinsert it as your printer requires, then choose Backs only and print the corresponding page. Check orientation and alignment before batching. Feed direction and output order vary by printer; for certainty, pair one front sheet with its matching back sheet at a time. Never use a two-pages-per-sheet option.</p></details>
    </section>
    <aside className="cs-panel cs-print-queue"><div className="cs-mini-heading"><span className="cs-eyebrow">PRINT QUEUE</span><span>{project.cards.length} designs</span></div><h2>Make a few.<br />Or a whole deck.</h2><p className="cs-help">Copies per design. Set to 0 to leave a card out. Up to {MAX_PRINT_COPIES} copies per print job.</p><div className="cs-queue-actions"><button className="cs-text-button" onClick={() => setAllQuantities(1)}>One of each</button><button className="cs-text-button" onClick={() => setAllQuantities(0)}>Clear queue</button></div><div className="cs-queue-list">{project.cards.map(card => <div className="cs-queue-item" key={card.id}><CardThumbnail card={card} /><span>{card.name || 'Untitled card'}</span><select aria-label={`Print quantity for ${card.name || 'Untitled card'}`} value={card.quantity} onChange={event => updateQuantity(card.id, Number(event.target.value))}>{Array.from({ length: 100 }, (_, index) => <option key={index} value={index}>{index}</option>)}</select></div>)}</div></aside>
  </div>;
}

function PackWorkshop({ project, updatePack, updatePrint, upload, beginPrint, downloadPack, busy }) {
  const { pack } = project;
  const net = getPackLayout(pack);
  const flat = useMemo(() => svgDataUrl(renderPackSvg(pack)), [pack]);
  let placementError = '';
  try { getPackPlacement(pack, project.print); } catch (error) { placementError = error.message; }
  return <div className="cs-pack-workspace">
    <aside className="cs-panel cs-pack-settings"><SectionTitle number="THE FINISHING TOUCH" title="Wrap up a world." /><div className="cs-fields">
      <TextField label="Pack name" value={pack.name} onChange={name => updatePack({ name })} maxLength={40} />
      <TextField label="Tagline" value={pack.subtitle} onChange={subtitle => updatePack({ subtitle })} maxLength={100} />
      <TextField label="Series / edition" value={pack.series} onChange={series => updatePack({ series })} maxLength={40} />
      <Field label="Signature color" hint={pack.color}><input type="color" value={pack.color} onChange={event => updatePack({ color: event.target.value })} /></Field>
      <ArtworkInput art={pack.art} onUpload={file => upload(file, 'pack')} onRemove={() => updatePack({ art: null })} busy={busy} label="Upload pack artwork" />
      <div className="cs-inspector-divider" /><span className="cs-eyebrow">MEASURE TWICE</span>
      <SelectField label="Cards in each pack" value={pack.cardCount} onChange={cardCount => updatePack({ cardCount: Number(cardCount) })} options={Array.from({ length: 40 }, (_, index) => ({ id: index + 1, label: `${index + 1} ${index === 0 ? 'card' : 'cards'}` }))} />
      <RangeField label="Thickness of one card" value={pack.thickness} min={0.008} max={0.03} step={0.001} unit=" in" onChange={thickness => updatePack({ thickness })} />
      <p className="cs-help">{(pack.thickness * 25.4).toFixed(2)} mm per card. Measure your finished stock (and sleeves, if used), not just the printer paper.</p>
      <RangeField label="Fit clearance" value={pack.allowance} min={0.0625} max={0.5} step={0.0625} unit=" in" onChange={allowance => updatePack({ allowance })} />
      <details className="cs-disclosure"><summary>Seam allowances</summary><div className="cs-fields"><RangeField label="Top & bottom seal" value={pack.seal} min={0.25} max={0.75} step={0.0625} unit=" in" onChange={seal => updatePack({ seal })} /><RangeField label="Glue tab" value={pack.glue} min={0.25} max={0.75} step={0.0625} unit=" in" onChange={glue => updatePack({ glue })} /></div></details>
      <label className="cs-check"><input type="checkbox" checked={pack.showGuides} onChange={event => updatePack({ showGuides: event.target.checked })} /><span>Show cut & fold guides</span></label>
    </div></aside>
    <section className="cs-pack-main">
      <div className="cs-pack-net-header"><div><span className="cs-eyebrow">THE FLAT TEMPLATE</span><h3>Cut. Fold. Fill. Delight.</h3></div><span>{net.width.toFixed(3)} x {net.height.toFixed(3)} in</span></div>
      <div className="cs-pack-net"><img src={flat} alt="Printable pack template with glue tab, back, side gussets, front, and end seals" /></div>
      <div className="cs-pack-key"><span><i className="cs-cut-key" /> Cut edge</span><span><i className="cs-fold-key" /> Fold line</span><span><i className="cs-glue-key" /> Glue tab</span></div>
      <div className="cs-pack-measurements"><div><span>FINISHED FACE</span><strong>{net.bodyWidth.toFixed(3)} x {net.bodyHeight.toFixed(3)} in</strong></div><div><span>STACK DEPTH + CLEARANCE</span><strong>{net.depth.toFixed(3)} in / {(net.depth * 25.4).toFixed(1)} mm</strong></div><div><span>FLAT TEMPLATE</span><strong>{(net.width * 25.4).toFixed(1)} x {(net.height * 25.4).toFixed(1)} mm</strong></div></div>
      <div className="cs-panel cs-pack-output"><div className="cs-field-row"><SelectField label="Print paper" value={project.print.paper} onChange={paper => updatePrint({ paper })} options={Object.entries(PAPER_SIZES).map(([id, paper]) => ({ id, label: paper.label }))} /><SelectField label="Orientation" value={project.print.orientation} onChange={orientation => updatePrint({ orientation })} options={[{ id: 'portrait', label: 'Portrait' }, { id: 'landscape', label: 'Landscape' }]} /></div><p className="cs-help">Uses the printer margin from the Print tab ({project.print.margin} in). One wrapper per sheet, printed single-sided at 100%. Change copies in your printer dialog.</p>{placementError && <p className="cs-warning-text" role="alert">{placementError}</p>}<div className="cs-inline-actions"><button className="cs-button" disabled={busy} onClick={downloadPack}><Icon name="download" size={16} /> Download SVG</button><button className="cs-button cs-primary" disabled={busy || Boolean(placementError)} onClick={() => beginPrint('pack')}><Icon name="print" size={16} /> Print template / PDF</button></div></div>
      <div className="cs-pack-howto"><h3>Your desk, a tiny print shop.</h3><div>{[
        ['01', 'Prototype first', 'Print on plain paper at actual size. Wrap your real card stack and check the clearance before using good paper.'],
        ['02', 'Cut & score', 'Cut around the outer edge, then lightly score the fold lines. Use a straightedge and a blunt scoring tool; do not cut the folds.'],
        ['03', 'Wrap & seal', 'Fold the side panels around the stack. Tape or glue the long tab behind the opposite edge to form a sleeve, then seal the bottom.'],
        ['04', 'Fill with wonder', 'Slide in the cards and fold the top seal. Use double-sided craft tape. This is a paper craft, not a heat-sealed foil wrapper.'],
      ].map(([number, title, text]) => <article key={number}><span>{number}</span><div><h4>{title}</h4><p>{text}</p></div></article>)}</div></div>
    </section>
  </div>;
}

function ImportDialog({ imported, current, onClose, onImport, onBackup }) {
  const ref = useRef(null);
  useEffect(() => { ref.current.showModal(); }, []);
  const canMerge = current.cards.length + imported.cards.length <= MAX_CARDS;
  return <dialog ref={ref} className="cs-import-dialog" onCancel={onClose} aria-labelledby="cs-import-title"><div className="cs-dialog-heading"><span className="cs-eyebrow">PICK UP WHERE YOU LEFT OFF</span><button className="cs-icon-button" aria-label="Cancel import" onClick={onClose}><Icon name="close" /></button></div><h2 id="cs-import-title">Welcome back, creator.</h2><p><strong>{imported.name || 'Untitled project'}</strong> contains {imported.cards.length} card designs, artwork, and print/pack settings.</p><div className="cs-import-options"><button className="cs-button" onClick={() => onImport('merge')} disabled={!canMerge}><Icon name="plus" />Add cards to this collection</button><p>Keeps your current back, print, and pack settings. Imported cards receive new IDs.{!canMerge && ` This would exceed the ${MAX_CARDS}-card limit.`}</p><button className="cs-button cs-primary" onClick={() => onImport('replace')}><Icon name="cards" />Replace current project</button><p>Replaces all {current.cards.length} current designs and settings with this file. Download a backup first if you want to keep them.</p></div><div className="cs-dialog-footer"><button className="cs-text-button" onClick={onBackup}><Icon name="download" size={15} /> Download current project</button><button className="cs-text-button" autoFocus onClick={onClose}>Cancel</button></div></dialog>;
}

function ResetDialog({ error, onClose, onReset, onBackup }) {
  const ref = useRef(null);
  const cancelRef = useRef(null);
  useEffect(() => { ref.current.showModal(); cancelRef.current.focus(); }, []);
  return <dialog ref={ref} className="cs-import-dialog cs-reset-dialog" onCancel={onClose} aria-labelledby="cs-reset-title" aria-describedby="cs-reset-description">
    <div className="cs-dialog-heading"><span className="cs-eyebrow">RESET STUDIO</span><button className="cs-icon-button" aria-label="Cancel reset" onClick={onClose}><Icon name="close" /></button></div>
    <h2 id="cs-reset-title">Reset Card Studio?</h2>
    <p id="cs-reset-description">This will clear all cards, artwork, backs, print settings, and pack settings saved in this browser and restore the starter collection. This cannot be undone. Download your project first if you want to keep it.</p>
    {error && <p className="cs-reset-error" role="alert">{error}</p>}
    <div className="cs-dialog-footer"><button className="cs-text-button" onClick={onBackup}><Icon name="download" size={15} /> Download project</button><div className="cs-inline-actions"><button className="cs-button" ref={cancelRef} onClick={onClose}>Cancel</button><button className="cs-button cs-destructive" onClick={onReset}>Reset studio</button></div></div>
  </dialog>;
}

function PrintPortal({ job, onReady, onDone, onError }) {
  const ref = useRef(null);
  useEffect(() => {
    let cancelled = false;
    document.body.classList.add('card-studio-printing');
    const done = () => { if (!cancelled) onDone(); };
    window.addEventListener('afterprint', done);
    async function prepare() {
      try {
        await document.fonts.ready;
        await Promise.all([...ref.current.querySelectorAll('img')].map(image => image.decode()));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (!cancelled) { onReady(); window.print(); }
      } catch (error) {
        if (!cancelled) onError(new Error(`Could not prepare the print sheets: ${error.message}`));
      }
    }
    prepare();
    return () => {
      cancelled = true;
      document.body.classList.remove('card-studio-printing');
      window.removeEventListener('afterprint', done);
    };
  }, [job, onReady, onDone, onError]);
  const { width, height } = job.layout;
  return createPortal(<div className="cs-print-root" ref={ref}>
    <style>{`@media print { @page { size: ${width}in ${height}in; margin: 0; } }`}</style>
    {job.kind === 'cards' ? job.pages.map((page, index) => <div className="cs-print-sheet" key={index}><CardSheet layout={job.layout} page={page} settings={job.project.print} back={job.project.back} printing /></div>) : <div className="cs-print-sheet"><div className="cs-paper" style={{ width: `${width}in`, height: `${height}in` }}><img alt="Pack wrapper print template" className="cs-sheet-slot" src={svgDataUrl(renderPackSvg(job.project.pack))} style={{ left: `${job.layout.x}in`, top: `${job.layout.y}in`, width: `${job.layout.net.width}in`, height: `${job.layout.net.height}in` }} /></div></div>}
  </div>, document.body);
}

function restoreProject() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    return { project: raw ? parseProject(raw) : createProject(), error: '', recovery: null };
  } catch (error) {
    console.warn('Could not restore Card Studio:', error);
    return { project: createProject(), error: `Your saved project could not be opened: ${error.message} It has not been overwritten. Download the recovery file, then import a valid project or reset to start fresh.`, recovery: raw };
  }
}

export default function CardStudio() {
  const [searchParams] = useSearchParams();
  const requestedTheme = searchParams.get('theme');
  const pageTheme = PAGE_THEMES.has(requestedTheme) ? requestedTheme : 'neon';
  const [initial] = useState(restoreProject);
  const [project, setProjectState] = useState(initial.project);
  const [tab, setTab] = useState('design');
  const [section, setSection] = useState('design');
  const [side, setSide] = useState('front');
  const [guides, setGuides] = useState(false);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [saveError, setSaveError] = useState(initial.error);
  const [storageProtected, setStorageProtected] = useState(Boolean(initial.error));
  const [pendingImport, setPendingImport] = useState(null);
  const [resetRequested, setResetRequested] = useState(false);
  const [resetError, setResetError] = useState('');
  const [printJob, setPrintJob] = useState(null);
  const [printReady, setPrintReady] = useState(false);
  const importRef = useRef(null);
  const projectRef = useRef(project);
  const protectedRef = useRef(storageProtected);
  const savedRef = useRef(project);
  projectRef.current = project;
  protectedRef.current = storageProtected;
  const selected = project.cards.find(card => card.id === project.selectedId);
  const preflight = useMemo(() => printPreflight(project), [project]);
  const isBusy = Boolean(busy || printJob);

  useEffect(() => {
    if (requestedTheme && !PAGE_THEMES.has(requestedTheme)) {
      console.warn('Unknown Card Studio theme preview:', requestedTheme);
    }
  }, [requestedTheme]);

  const reportError = useCallback(error => {
    console.warn('Card Studio:', error);
    setNotice({ type: 'error', text: error.message });
  }, []);

  const setProject = useCallback(update => {
    const next = typeof update === 'function' ? update(projectRef.current) : update;
    try {
      assertProjectCapacity(next);
      projectRef.current = next;
      setProjectState(next);
    } catch (error) { reportError(error); }
  }, [reportError]);

  const save = useCallback(current => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      savedRef.current = current;
      setSaveError('');
      setSaveStatus('');
      return true;
    } catch (error) {
      console.warn('Could not save Card Studio:', error);
      setSaveStatus('Not saved');
      setSaveError('Local storage is full or unavailable. Your latest changes are still open here, but are not saved. Download a project file before leaving, then remove large images or try saving again.');
      return false;
    }
  }, []);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Card Studio | The Playground';
    return () => { document.title = previousTitle; };
  }, []);

  useEffect(() => {
    if (storageProtected || project === savedRef.current) return;
    setSaveStatus('Saving...');
    const timeout = setTimeout(() => save(project), 350);
    return () => clearTimeout(timeout);
  }, [project, storageProtected, save]);

  useEffect(() => {
    function flush(event) {
      if (savedRef.current === projectRef.current) return;
      if (protectedRef.current) {
        if (event?.type === 'beforeunload') { event.preventDefault(); event.returnValue = ''; }
        return;
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projectRef.current));
        savedRef.current = projectRef.current;
      } catch (error) {
        console.warn('Could not save Card Studio before leaving:', error);
        if (event?.type === 'beforeunload') { event.preventDefault(); event.returnValue = ''; }
      }
    }
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    return () => { flush(); window.removeEventListener('beforeunload', flush); window.removeEventListener('pagehide', flush); };
  }, []);

  useEffect(() => {
    if (!notice || notice.type === 'error') return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const updateCard = changes => setProject(current => ({ ...current, cards: current.cards.map(card => card.id === current.selectedId ? { ...card, ...changes } : card) }));
  const updateBack = changes => setProject(current => ({ ...current, back: { ...current.back, ...changes } }));
  const updatePrint = changes => setProject(current => ({ ...current, print: { ...current.print, ...changes } }));
  const updatePack = changes => setProject(current => ({ ...current, pack: { ...current.pack, ...changes } }));

  async function operation(label, callback) {
    setBusy(label);
    setNotice(null);
    try { await callback(); } catch (error) { reportError(error); } finally { setBusy(''); }
  }

  function addCard() {
    if (project.cards.length >= MAX_CARDS) return reportError(new Error(`A project can contain up to ${MAX_CARDS} card designs.`));
    const card = createCard({
      type: selected.type, template: selected.template, subtitle: '', weakness: '',
      number: String(project.cards.length + 1).padStart(3, '0'),
      moves: [{ name: 'New move', damage: '', cost: [selected.type], text: '' }],
    });
    setProject(current => ({ ...current, cards: [...current.cards, card], selectedId: card.id }));
    setSection('design');
    setSide('front');
  }

  function duplicateCard() {
    if (project.cards.length >= MAX_CARDS) return reportError(new Error(`A project can contain up to ${MAX_CARDS} card designs.`));
    const card = { ...selected, id: newId(), name: `${selected.name.slice(0, 63)} (copy)`, moves: selected.moves.map(move => ({ ...move, cost: [...move.cost] })) };
    try {
      const next = { ...project, cards: [...project.cards, card], selectedId: card.id };
      serializeProject(next);
      setProject(next);
    } catch (error) { reportError(error); }
  }

  function randomizeCollection() {
    if (!window.confirm(`Randomize element, HP, stage, ability name, ability text, moves, and flavor text for all ${project.cards.length} cards in this collection? Names, uploaded artwork, layouts, and other settings will be kept. This cannot be undone. Download your project first if you want to keep the current designs.`)) return;
    setProject(current => ({ ...current, cards: randomizeCards(current.cards) }));
  }

  function removeCard() {
    if (!window.confirm(`Delete "${selected.name || 'Untitled card'}" from this collection? This cannot be undone.`)) return;
    const cards = project.cards.filter(card => card.id !== selected.id);
    setProject(current => ({ ...current, cards, selectedId: cards[0].id }));
  }

  function upload(file, target, cardId) {
    operation('Opening artwork...', async () => {
      const art = await readArtwork(file);
      const current = projectRef.current;
      const next = target === 'card'
        ? { ...current, cards: current.cards.map(card => card.id === cardId ? { ...card, art, artX: 50, artY: 50, artZoom: 1 } : card) }
        : { ...current, [target]: { ...current[target], art, ...(target === 'back' && { x: 50, y: 50, zoom: 1 }) } };
      serializeProject(next);
      setProject(next);
      setNotice({ type: 'success', text: 'Artwork added. Adjust its framing without changing the card dimensions.' });
    });
  }

  function downloadProject() {
    try {
      downloadText(serializeProject(project), `${fileName(project.name)}.cardstudio.json`);
      setNotice({ type: 'success', text: 'Project download prepared, including all artwork and settings.' });
    } catch (error) { reportError(error); }
  }

  function openProject(file) {
    operation('Checking project and embedded artwork...', async () => setPendingImport(await readProjectFile(file)));
  }

  function importProject(mode) {
    if (mode === 'merge') {
      const importedCards = pendingImport.cards.map(card => ({ ...card, id: newId() }));
      if (project.cards.length + importedCards.length > MAX_CARDS) return reportError(new Error(`This import would exceed ${MAX_CARDS} cards. Replace the project instead.`));
      if (storageProtected) return reportError(new Error('The saved project is protected after a restore error. Download its recovery file, then use Replace current project or Reset.'));
      const next = { ...project, cards: [...project.cards, ...importedCards], selectedId: importedCards[0].id };
      try { serializeProject(next); } catch (error) { reportError(error); return; }
      setProject(next);
    } else {
      savedRef.current = null;
      setStorageProtected(false);
      setSaveError('');
      setProject(pendingImport);
    }
    setPendingImport(null);
    setTab('design');
    setSide('front');
    setNotice({ type: 'success', text: mode === 'merge' ? 'Cards added. Your current back and print/pack settings were kept.' : 'Project imported. You are right where you left off.' });
  }

  function exportCard(format, dpi) {
    operation('Preparing your card...', async () => {
      if (side === 'front' && getCardLayout(selected).overflow) throw new Error('This card has too much text to export safely. Shorten its rules or name first.');
      if (side === 'back' && project.back.style !== 'studio' && !project.back.art) throw new Error('Upload back artwork or choose the studio original before exporting.');
      const bleed = project.print.bleed;
      const svg = side === 'front' ? renderCardSvg(selected, { bleed }) : renderBackSvg(project.back, { bleed });
      const name = `${fileName(side === 'front' ? selected.name : project.name)}-${side}${bleed ? '-bleed' : ''}`;
      if (format === 'svg') downloadText(svg, `${name}.svg`, 'image/svg+xml');
      else await downloadPng(svg, { width: CARD_WIDTH + (bleed ? 0.25 : 0), height: CARD_HEIGHT + (bleed ? 0.25 : 0), dpi, name: `${name}-${dpi}dpi.png` });
      setNotice({ type: 'success', text: `${side === 'front' ? 'Card' : 'Back'} download prepared${format === 'png' ? ` at ${dpi} DPI` : ' as a vector SVG'}. Safe-area guides are not included.` });
    });
  }

  function reset() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      const fresh = createProject();
      savedRef.current = fresh;
      setProject(fresh);
      setStorageProtected(false);
      setSaveError('');
      setSaveStatus('');
      setTab('design');
      setSection('design');
      setSide('front');
      setResetRequested(false);
      setResetError('');
      setNotice({ type: 'success', text: 'Saved Card Studio data cleared. A fresh starter collection is ready.' });
    } catch (error) {
      const message = `The saved project could not be cleared: ${error.message}`;
      setResetError(message);
      reportError(new Error(message));
    }
  }

  function beginPrint(kind) {
    try {
      setPrintReady(false);
      if (kind === 'cards') {
        if (preflight.errors.length) throw new Error(preflight.errors.join(' '));
        setPrintJob({ kind, project, ...preflight.result });
      } else {
        setPrintJob({ kind, project, layout: getPackPlacement(project.pack, project.print) });
      }
    } catch (error) { reportError(error); }
  }
  const readyToPrint = useCallback(() => setPrintReady(true), []);
  const finishPrint = useCallback(() => { setPrintJob(null); setPrintReady(false); }, []);
  const failPrint = useCallback(error => { setPrintJob(null); setPrintReady(false); reportError(error); }, [reportError]);

  return <div className="cs" data-studio-theme={pageTheme}>
    <a className="cs-skip" href="#cs-workspace">Skip to workspace</a>
    <header className="cs-header"><div className="cs-header-brand"><Link to="/#playground" className="cs-back-link" aria-label="Back to the playground" onClick={event => { if (saveError && !window.confirm('Some work may not be saved. Leave Card Studio without downloading a backup?')) event.preventDefault(); }}><Icon name="left" size={19} /></Link><span className="cs-logo"><Icon name="cards" size={23} /></span><h1 className="cs-wordmark">Card Studio</h1></div><div className="cs-header-actions"><button className="cs-button cs-subtle" disabled={isBusy} onClick={() => importRef.current.click()}><Icon name="upload" size={15} /><span>Import</span></button><button className="cs-button cs-subtle" disabled={isBusy} onClick={downloadProject}><Icon name="download" size={15} /><span>Download project</span></button></div></header>
    <input ref={importRef} className="cs-hidden-input" type="file" accept=".json,application/json" aria-label="Import Card Studio project" onChange={event => { const file = event.target.files[0]; event.target.value = ''; if (file) openProject(file); }} />
    <main className="cs-container">
      <nav className="cs-tabs" aria-label="Studio workspaces">{TABS.map((item, index) => <button key={item.id} className={tab === item.id ? 'is-active' : ''} onClick={() => setTab(item.id)} aria-current={tab === item.id ? 'page' : undefined}><span className="cs-tab-number" aria-hidden="true">0{index + 1}</span><Icon name={item.icon} size={17} /><span>{item.label}</span></button>)}{(busy || saveError || saveStatus === 'Saving...') && <span className={`cs-save-state ${saveError ? 'is-warning' : ''}`} role="status">{busy || (saveError ? 'Not saved / backup recommended' : 'Saving...')}</span>}</nav>
      {saveError && <div className="cs-banner is-error" role="alert"><Icon name="alert" /><div><strong>Your work needs a backup.</strong><p>{saveError}</p><div className="cs-inline-actions"><button className="cs-text-button" onClick={downloadProject}>Download current project</button>{storageProtected && initial.recovery && <button className="cs-text-button" onClick={() => downloadText(initial.recovery, 'card-studio-recovery.json')}>Download recovery file</button>}{!storageProtected && <button className="cs-text-button" onClick={() => save(project)}>Retry save</button>}</div></div></div>}
      {notice && <div className={`cs-banner ${notice.type === 'error' ? 'is-error' : 'is-success'}`} role={notice.type === 'error' ? 'alert' : 'status'}><Icon name={notice.type === 'error' ? 'alert' : 'check'} /><p>{notice.text}</p><button className="cs-icon-button" aria-label="Dismiss notification" onClick={() => setNotice(null)}><Icon name="close" size={15} /></button></div>}
      {printJob && <div className="cs-banner" role="status"><Icon name="print" /><p>{printReady ? 'Print sheets are prepared at actual size. Print cards with the chosen duplex edge; print pack wrappers single-sided. If your browser did not open a dialog, use the button here.' : 'Preparing full-resolution artwork and print sheets. The print dialog will open when every image is ready.'}</p><button className="cs-text-button" disabled={!printReady} onClick={() => window.print()}>Open print dialog</button><button className="cs-text-button" onClick={finishPrint}>Close</button></div>}
      <div id="cs-workspace" tabIndex="-1">
        {tab === 'design' && <div className="cs-design-workspace">
          <CardLibrary project={project} onSelect={selectedId => { setProject(current => ({ ...current, selectedId })); }} onAdd={addCard} onRandomize={randomizeCollection} onName={name => setProject(current => ({ ...current, name }))} busy={isBusy} />
          <CardPreview card={selected} back={project.back} side={side} setSide={setSide} guides={guides} setGuides={setGuides} bleed={project.print.bleed} setBleed={bleed => updatePrint({ bleed })} exportCard={exportCard} busy={isBusy} />
          <Inspector card={selected} project={project} section={section} setSection={value => { setSection(value); setSide(value === 'back' ? 'back' : 'front'); }} updateCard={updateCard} updateBack={updateBack} upload={upload} duplicate={duplicateCard} remove={removeCard} busy={isBusy} />
        </div>}
        {tab === 'print' && <PrintStudio project={project} updatePrint={updatePrint} updateQuantity={(id, quantity) => setProject(current => ({ ...current, cards: current.cards.map(card => card.id === id ? { ...card, quantity } : card) }))} setAllQuantities={quantity => setProject(current => ({ ...current, cards: current.cards.map(card => ({ ...card, quantity })) }))} preflight={preflight} beginPrint={beginPrint} busy={isBusy} editBack={() => { setTab('design'); setSection('back'); setSide('back'); }} />}
        {tab === 'packs' && <PackWorkshop project={project} updatePack={updatePack} updatePrint={updatePrint} upload={upload} beginPrint={beginPrint} busy={isBusy} downloadPack={() => { try { downloadText(renderPackSvg(project.pack), `${fileName(project.pack.name)}-pack-template.svg`, 'image/svg+xml'); setNotice({ type: 'success', text: 'Full-size pack template download prepared. Print at 100% and prototype with plain paper first.' }); } catch (error) { reportError(error); } }} />}
      </div>
      <footer className="cs-footer"><button className="cs-text-button" onClick={() => { setResetError(''); setResetRequested(true); }} disabled={isBusy}><Icon name="reset" size={14} /> Reset studio</button></footer>
    </main>
    {pendingImport && <ImportDialog imported={pendingImport} current={project} onClose={() => setPendingImport(null)} onImport={importProject} onBackup={downloadProject} />}
    {resetRequested && <ResetDialog error={resetError} onClose={() => setResetRequested(false)} onReset={reset} onBackup={downloadProject} />}
    {printJob && <PrintPortal job={printJob} onReady={readyToPrint} onDone={finishPrint} onError={failPrint} />}
  </div>;
}
