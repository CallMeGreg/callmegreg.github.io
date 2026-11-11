import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCardLayout, imagePlacement, measureTextWidth, renderBackSvg, renderCardSvg, svgDataUrl, wrapText,
} from './cardStudioRender.mjs';
import { createProject } from './cardStudioModel.mjs';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const art = { data: PNG, width: 1600, height: 800, name: 'A personal illustration.png' };
const baseCard = {
  id: 'mosswhisker', name: 'Mosswhisker', template: 'classic', type: 'grass',
  hp: '120', stage: 'Basic', evolvesFrom: '', subtitle: 'The woodland companion',
  art: null, artFit: 'cover', artX: 50, artY: 50, artZoom: 1,
  abilityName: 'Quiet company', abilityText: 'A small kindness makes the whole forest feel like home.',
  moves: [
    { name: 'Gentle gust', damage: '30', cost: ['grass', 'colorless'], text: 'A warm breeze carries a little courage.' },
    { name: 'Fern flourish', damage: '70', cost: ['grass', 'grass'], text: 'Leaves dance in a bright, protective circle.' },
  ],
  weakness: 'fire', weaknessModifier: '×2', resistance: 'water', resistanceModifier: '-30',
  retreat: 1, rarity: 'rare', flavor: 'It saves the softest patch of moss for a friend.',
  illustrator: 'Your name', number: '001', setCode: 'STL', border: 'gold', quantity: 1,
};
const baseBack = { style: 'studio', art: null, fit: 'cover', x: 50, y: 50, zoom: 1, label: 'STARFALL', sublabel: 'TRADING CARD GAME', color: '#223b54' };
const types = ['grass', 'fire', 'water', 'lightning', 'psychic', 'fighting', 'darkness', 'metal', 'dragon', 'fairy', 'colorless'];

function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 0.00001, `${actual} should equal ${expected}`);
}

function imageTag(svg) {
  return svg.match(/<image\b[^>]*\/>/)?.[0];
}

test('all three model starter cards render without overflow or warnings', () => {
  const project = createProject();
  assert.deepEqual(project.cards.map((card) => card.name), ['Mosswhisker', 'Cinderwing', 'Tidekeeper']);
  for (const card of project.cards) {
    const layout = getCardLayout(card);
    assert.equal(layout.overflow, false, `${card.name}: ${layout.warnings.join(' ')}`);
    assert.deepEqual(layout.warnings, []);
    assert.ok(layout.bodyFontSize >= 24);
    assert.ok(layout.artBox.width > 0 && layout.artBox.height > 0);
    assert.ok(layout.rules.height <= layout.bodyHeight + 0.001);
    for (const bleed of [false, true]) {
      const svg = renderCardSvg(card, { bleed });
      assert.match(svg, /data-original-art="true"/);
      assert.match(svg, /data-overflow="false"/);
      assert.doesNotMatch(svg, /data-layout-warning="true"|data-body-overflow="true"/);
    }
  }
  assert.match(renderBackSvg(project.back), /data-overflow="false" data-missing-art="false"/);
});

test('XML text and attributes are escaped, never treated as imported markup', () => {
  const injected = `A <B> & "C" 'D'`;
  const svg = renderCardSvg({
    ...baseCard, name: injected, stage: '<Basic>', abilityName: 'A & B',
    abilityText: '<script>alert("no")</script> & friends',
    flavor: `A "story" & a 'friend'.`, illustrator: '<Artist>',
    number: '1<2', setCode: 'A&B',
  });
  assert.ok(svg.includes('A &lt;B&gt; &amp; &quot;C&quot; &apos;D&apos;'));
  assert.ok(svg.includes('&lt;script&gt;'));
  assert.ok(svg.includes('&amp; friends'));
  assert.ok(svg.includes('Illus. &lt;Artist&gt;'));
  assert.ok(svg.includes('A&amp;B · 1&lt;2'));
  assert.doesNotMatch(svg, /<script\b|<B>|<Artist>/i);
  for (const tag of ['SCRIPT', 'ScRiPt']) {
    const mixedCase = renderCardSvg({ ...baseCard, abilityText: `<${tag}>alert("no")</${tag}>` });
    assert.ok(mixedCase.includes(`&lt;${tag}&gt;`));
    assert.doesNotMatch(mixedCase, /<script\b/i);
  }
  const back = renderBackSvg({ ...baseBack, label: injected, sublabel: '<small>& "safe"</small>', color: 'red" onload="bad()' });
  assert.ok(back.includes('&lt;small&gt;&amp; &quot;safe&quot;&lt;/small&gt;'));
  assert.doesNotMatch(back, /onload=|<small>/i);
  assert.match(back, /#223b54/);
});

test('XML-disallowed control characters are replaced', () => {
  const svg = renderCardSvg({ ...baseCard, name: 'A\u0001B\u0000C\ud800D\udc00' });
  assert.doesNotMatch(svg, /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/);
  assert.match(svg, /A�B�C�D�/);
  assert.doesNotThrow(() => svgDataUrl(svg));
});

test('only embedded, raster-signature-checked data URLs can reach an image href', () => {
  const unsafe = [
    'https://example.com/image.png',
    '//example.com/image.png',
    'javascript:alert(1)',
    'file:///private/picture.png',
    'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIj48L3N2Zz4=',
    'data:image/png;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIj48L3N2Zz4=',
    'data:text/html;base64,PHNjcmlwdD4=',
    'data:image/png;name=picture.png;base64,iVBORw0KGgo=',
    PNG + '" onload="alert(1)',
    PNG + '\n',
  ];
  for (const data of unsafe) {
    const card = { ...baseCard, art: { ...art, data } };
    assert.equal(imageTag(renderCardSvg(card)), undefined, data);
    assert.ok(getCardLayout(card).warnings.some((warning) => warning.includes('embedded PNG')));
    const back = renderBackSvg({ ...baseBack, style: 'custom', art: { ...art, data } });
    assert.equal(imageTag(back), undefined, data);
    assert.match(back, /data-back-placeholder="true"/);
    assert.doesNotMatch(back, /onload=/);
  }
  assert.match(imageTag(renderCardSvg({ ...baseCard, art })), /href="data:image\/png;base64,/);
  assert.equal(imageTag(renderCardSvg({ ...baseCard, art: { ...art, width: 0 } })), undefined);
  assert.equal(imageTag(renderCardSvg({ ...baseCard, art: { ...art, height: Infinity } })), undefined);
});

test('JPEG and WebP raster signatures are supported, SVG disguised with their MIME is not', () => {
  const jpeg = 'data:image/jpeg;base64,' + Buffer.from([255, 216, 255, 224, 0, 0, 0, 0]).toString('base64');
  const webp = 'data:image/webp;base64,' + Buffer.from('RIFF0000WEBPVP8 ', 'ascii').toString('base64');
  for (const data of [jpeg, webp]) {
    assert.ok(imageTag(renderCardSvg({ ...baseCard, art: { ...art, data } })));
  }
  for (const mime of ['jpeg', 'webp']) {
    const data = `data:image/${mime};base64,` + Buffer.from('<svg></svg>').toString('base64');
    assert.equal(imageTag(renderCardSvg({ ...baseCard, art: { ...art, data } })), undefined);
  }
});

test('body layout fits a normal ability and two moves without clipping or text squashing', () => {
  const layout = getCardLayout(baseCard);
  assert.equal(layout.overflow, false, layout.warnings.join(' '));
  assert.ok(layout.bodyFontSize >= 24 && layout.bodyFontSize <= 29);
  assert.ok(layout.rules.height <= layout.bodyHeight + 0.001);
  assert.equal(layout.rules.blocks.length, 3);
  for (const block of layout.rules.blocks) {
    for (const line of block.lines) assert.ok(measureTextWidth(line, layout.bodyFontSize) <= 644);
  }
  const svg = renderCardSvg(baseCard);
  assert.match(svg, /Quiet company/);
  assert.match(svg, /Gentle gust/);
  assert.match(svg, /Fern flourish/);
  assert.doesNotMatch(svg, /textLength=|lengthAdjust=|data-layout-warning="true"|data-body-overflow="true"/);
});

test('tiny content gets a larger art window; up to three moves adapt before warning', () => {
  const tiny = getCardLayout({ ...baseCard, abilityName: '', abilityText: '', moves: [] });
  const normal = getCardLayout(baseCard);
  assert.ok(tiny.artBox.height > normal.artBox.height);
  for (let count = 0; count <= 3; count += 1) {
    const layout = getCardLayout({
      ...baseCard,
      moves: Array.from({ length: count }, (_, index) => ({
        name: `Garden song ${index + 1}`, damage: '30+', cost: ['grass'],
        text: 'Restore a little courage to a friend.',
      })),
    });
    assert.equal(layout.overflow, false, `${count} moves: ${layout.warnings.join(' ')}`);
    assert.ok(layout.rules.height <= layout.bodyHeight + 0.001);
  }
});

test('body font shrinks only to a readable minimum and impossible content gives explicit warnings', () => {
  const dense = getCardLayout({
    ...baseCard, abilityText: 'A tiny leaf. '.repeat(24),
    moves: baseCard.moves.map((move) => ({ ...move, text: 'Restore courage to a friend.' })),
  });
  assert.equal(dense.overflow, false, dense.warnings.join(' '));
  assert.ok(dense.bodyFontSize < 29 && dense.bodyFontSize >= 24);
  assert.ok(dense.rules.height <= dense.bodyHeight + 0.001);
  const hugeText = 'Every little leaf has a very long story to tell. '.repeat(130);
  const card = { ...baseCard, abilityText: hugeText };
  const layout = getCardLayout(card);
  assert.equal(layout.bodyFontSize, 24);
  assert.equal(layout.bodyOverflow, true);
  assert.equal(layout.overflow, true);
  assert.match(layout.warnings.join(' '), /minimum 24-unit body size/);
  assert.equal(layout.rules.blocks[0].lines.join(' '), hugeText.trim());
  const svg = renderCardSvg(card);
  assert.match(svg, /RULES TEXT DOES NOT FIT/);
  assert.match(svg, /Printing blocked/);
  assert.doesNotMatch(svg, /textLength=|lengthAdjust=/);
});

test('names, evolution, damage, flavor, and footer each warn rather than silently truncate', () => {
  const huge = 'Averylongunbreakableword'.repeat(60);
  const cases = [
    [{ name: huge }, /Name/],
    [{ stage: huge }, /Stage/],
    [{ evolvesFrom: huge }, /Evolves-from/],
    [{ hp: huge }, /HP/],
    [{ subtitle: huge }, /Subtitle/],
    [{ flavor: huge }, /Flavor/],
    [{ illustrator: huge }, /Illustrator/],
    [{ setCode: huge }, /Set \/ card number/],
    [{ weaknessModifier: huge }, /Weakness modifier/],
    [{ resistanceModifier: huge }, /Resistance modifier/],
    [{ abilityName: huge }, /Ability name/],
    [{ moves: [{ name: huge, damage: '20', text: '', cost: [] }] }, /Move 1 name/],
    [{ moves: [{ name: 'Breeze', damage: huge, text: '', cost: [] }] }, /Move 1 damage/],
  ];
  for (const [changes, warning] of cases) {
    const card = { ...baseCard, ...changes };
    const layout = getCardLayout(card);
    assert.equal(layout.overflow, true);
    assert.match(layout.warnings.join(' '), warning);
    assert.match(renderCardSvg(card), /data-(?:layout-warning|body-overflow)="true"/);
  }
});

test('all four templates, eleven types, three borders, and six rarities render independently', () => {
  for (const template of ['classic', 'full-art', 'trainer', 'energy']) {
    for (const type of types) {
      const card = { ...baseCard, template, type };
      const layout = getCardLayout(card);
      assert.equal(layout.overflow, false, `${template}/${type}: ${layout.warnings.join(' ')}`);
      const svg = renderCardSvg(card);
      assert.match(svg, new RegExp(`data-template="${template}"`));
      assert.match(svg, /data-original-art="true"/);
      assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
      assert.equal(svg.includes('data-combat-stats="true"'), template === 'classic' || template === 'full-art');
    }
  }
  for (const border of ['gold', 'silver', 'dark']) {
    for (const rarity of ['common', 'uncommon', 'rare', 'double-rare', 'ultra-rare', 'secret']) {
      assert.ok(renderCardSvg({ ...baseCard, border, rarity }).includes(`aria-label="${rarity} rarity"`));
    }
  }
});

test('trainer and energy ignore dormant creature-only fields and use ability rules instead', () => {
  for (const template of ['trainer', 'energy']) {
    const card = {
      ...baseCard, template, hp: 'INVALID HP '.repeat(100), stage: 'INVALID STAGE '.repeat(100),
      evolvesFrom: 'INVALID EVOLUTION '.repeat(100), subtitle: 'INVALID SPECIES '.repeat(100),
      moves: [{ name: 'DORMANT MOVE', damage: '9999999999999999999', text: 'x'.repeat(10000), cost: [] }],
      weaknessModifier: 'INVALID WEAKNESS '.repeat(100),
      resistanceModifier: 'INVALID RESISTANCE '.repeat(100),
      retreat: 1e50,
    };
    assert.equal(getCardLayout(card).overflow, false);
    const svg = renderCardSvg(card);
    assert.match(svg, /Quiet company/);
    assert.match(svg, /EFFECT/);
    assert.doesNotMatch(svg, /DORMANT MOVE|INVALID HP|INVALID STAGE|INVALID EVOLUTION|INVALID SPECIES|WEAKNESS|RESISTANCE|RETREAT/);
  }
});

test('full-art fills the trim with borderless artwork and transparent outlined text', () => {
  const card = { ...baseCard, template: 'full-art', art };
  const layout = getCardLayout(card);
  assert.deepEqual(layout.artBox, { x: 0, y: 0, width: 750, height: 1050 });
  assert.ok(layout.focusArtBox.height < layout.artBox.height);
  const placement = imagePlacement(art, layout.artBox);
  const svg = renderCardSvg(card);
  assert.ok(imageTag(svg).includes(`width="${placement.width}"`));
  assert.match(svg, /data-card-labels="full-art"/);
  assert.match(svg, /paint-order: stroke fill/);
  assert.match(svg, /fill="#fff9ed"/);
  assert.doesNotMatch(svg, /card-border|card-face|paper-grain|fill-opacity="\.94"/);
  assert.doesNotMatch(svg.split('<g data-card-labels="full-art">')[1], /<rect\b/);
  assert.equal(layout.bodyOverflow, false);
});

test('full-art ignores frame finishes without changing the saved frame choice for other layouts', () => {
  const card = { ...baseCard, template: 'full-art' };
  assert.equal(renderCardSvg({ ...card, border: 'gold' }), renderCardSvg({ ...card, border: 'silver' }));
  assert.equal(renderCardSvg({ ...card, border: 'gold' }), renderCardSvg({ ...card, border: 'dark' }));
  assert.doesNotMatch(renderCardSvg(card), /width="646"[^>]+stroke=/);
  for (const template of ['classic', 'trainer', 'energy']) {
    assert.match(renderCardSvg({ ...baseCard, template }), /fill="url\(#card-border\)"/);
    assert.match(renderCardSvg({ ...baseCard, template }), /fill="url\(#card-face\)"/);
    assert.doesNotMatch(renderCardSvg({ ...baseCard, template }), /paint-order: stroke fill/);
  }
});

test('full-art bleed extends all eight edge regions without moving the trimmed artwork or adding a frame', () => {
  for (const uploaded of [null, art]) {
    const card = { ...baseCard, template: 'full-art', art: uploaded, artX: 24, artY: 72, artZoom: 1.4 };
    const trim = renderCardSvg(card);
    const bleed = renderCardSvg(card, { bleed: true });
    assert.equal(imageTag(trim), imageTag(bleed));
    assert.doesNotMatch(trim, /data-art-bleed/);
    assert.match(bleed, /data-art-bleed="true"/);
    assert.equal((bleed.match(/<use href="#card-artwork"\/>/g) || []).length, 8);
    assert.match(bleed, /viewBox="-37.5 -37.5 825 1125"/);
    assert.doesNotMatch(bleed, /card-border|card-face/);
  }
});

test('wide and tall cover / contain placements preserve aspect ratio and use real box dimensions', () => {
  const box = { x: 48, y: 160, width: 654, height: 360 };
  const cases = [
    [1600, 800, 'cover', { x: 15, y: 160, width: 720, height: 360 }],
    [1600, 800, 'contain', { x: 48, y: 176.5, width: 654, height: 327 }],
    [800, 1600, 'cover', { x: 48, y: -314, width: 654, height: 1308 }],
    [800, 1600, 'contain', { x: 285, y: 160, width: 180, height: 360 }],
  ];
  for (const [width, height, fit, expected] of cases) {
    const placement = imagePlacement({ width, height }, box, { fit });
    for (const property of ['x', 'y', 'width', 'height']) close(placement[property], expected[property]);
    close(placement.width / placement.height, width / height);
  }
});

test('image anchors, zoom, invalid dimensions, and bounded settings are deterministic', () => {
  const box = { x: 48, y: 160, width: 654, height: 360 };
  const topLeft = imagePlacement(art, box, { x: 0, y: 0 });
  const bottomRight = imagePlacement(art, box, { x: 100, y: 100 });
  close(topLeft.x, 48);
  close(bottomRight.x, -18);
  const zoomed = imagePlacement(art, box, { x: 25, y: 75, zoom: 2 });
  assert.deepEqual(zoomed, { x: -148.5, y: -110, width: 1440, height: 720 });
  const contain = imagePlacement(art, box, { fit: 'contain', x: 100, y: 100 });
  close(contain.y, 193);
  assert.deepEqual(imagePlacement(null, box), { x: 48, y: 160, width: 0, height: 0 });
  assert.deepEqual(imagePlacement({ width: Infinity, height: 1 }, box), { x: 48, y: 160, width: 0, height: 0 });
  assert.deepEqual(imagePlacement(art, box, { x: -10, y: 500, zoom: 9 }), imagePlacement(art, box, { x: 0, y: 100, zoom: 3 }));
  assert.deepEqual(imagePlacement(art, box, { x: NaN, y: NaN, zoom: NaN }), imagePlacement(art, box));
});

test('rasters are clipped and aspect-preserving in the exact layout art box', () => {
  const card = { ...baseCard, art, artFit: 'contain', artX: 20, artY: 80, artZoom: 1.7 };
  const layout = getCardLayout(card);
  const expected = imagePlacement(art, layout.artBox, { fit: 'contain', x: 20, y: 80, zoom: 1.7 });
  const svg = renderCardSvg(card);
  const tag = imageTag(svg);
  for (const property of ['x', 'y', 'width', 'height']) assert.ok(tag.includes(`${property}="${Number(expected[property].toFixed(3))}"`));
  assert.match(tag, /preserveAspectRatio="xMidYMid meet"/);
  assert.match(tag, /clip-path="url\(#art-window\)"/);
  assert.doesNotMatch(tag, /preserveAspectRatio="none"/);
});

test('trim and bleed dimensions represent 2.5 × 3.5 inches with 0.125-inch bleed on all sides', () => {
  for (const render of [() => renderCardSvg(baseCard), () => renderBackSvg(baseBack)]) {
    assert.match(render(), /^<svg\b[^>]*width="2\.5in" height="3\.5in" viewBox="0 0 750 1050"/);
  }
  for (const svg of [renderCardSvg(baseCard, { bleed: true }), renderBackSvg(baseBack, { bleed: true })]) {
    assert.match(svg, /^<svg\b[^>]*width="2\.75in" height="3\.75in" viewBox="-37.5 -37.5 825 1125"/);
    const outer = svg.match(/<rect x="-37.5" y="-37.5" width="825" height="1125"[^>]*>/)?.[0];
    assert.ok(outer);
    assert.doesNotMatch(outer, /\brx=|\bry=/);
  }
});

test('bleed never rescales or repositions front or back artwork', () => {
  const card = { ...baseCard, art, artX: 22, artY: 76, artZoom: 1.3 };
  assert.equal(imageTag(renderCardSvg(card)), imageTag(renderCardSvg(card, { bleed: true })));
  for (const style of ['pokemon', 'yugioh', 'custom']) {
    const back = { ...baseBack, style, art, x: 24, y: 80, zoom: 1.4 };
    assert.equal(imageTag(renderBackSvg(back)), imageTag(renderBackSvg(back, { bleed: true })));
    assert.match(renderBackSvg(back, { bleed: true }), /<clipPath id="back-window"><rect x="-37.5" y="-37.5" width="825" height="1125"/);
  }
});

test('non-studio backs require uploaded artwork and never bundle imitation official designs', () => {
  for (const style of ['pokemon', 'yugioh', 'custom']) {
    const missing = renderBackSvg({ ...baseBack, style });
    assert.match(missing, /Upload back artwork/);
    assert.match(missing, /data-missing-art="true"/);
    assert.doesNotMatch(missing, /data-studio-back="true"/);
    assert.equal(imageTag(missing), undefined);
    const uploaded = renderBackSvg({ ...baseBack, style, art });
    assert.match(uploaded, /data-missing-art="false"/);
    assert.doesNotMatch(uploaded, /data-back-placeholder="true"|Upload back artwork/);
    assert.ok(imageTag(uploaded));
  }
});

test('guides are optional and off by default for both previewable SVG types', () => {
  for (const [render, input] of [[renderCardSvg, baseCard], [renderBackSvg, baseBack]]) {
    assert.doesNotMatch(render(input), /data-card-guides|#ff378f|#00b8d4/);
    assert.doesNotMatch(render(input, { bleed: true }), /data-card-guides/);
    const svg = render(input, { guides: true, bleed: true });
    assert.match(svg, /data-card-guides="true"/);
    assert.match(svg, /x="37.5" y="37.5" width="675" height="975" stroke="#00b8d4" stroke-dasharray="8 7"/);
    assert.match(svg, /width="750" height="1050" stroke="#ff378f" stroke-dasharray="14 8"/);
  }
});

test('rendered text stays inside the 0.125-inch trim-safe inset', () => {
  const documents = [
    ...['classic', 'full-art', 'trainer', 'energy'].flatMap((template) => types.map((type) => renderCardSvg({ ...baseCard, template, type }))),
    renderCardSvg({ ...baseCard, name: 'Large name '.repeat(100), abilityText: 'Many rules. '.repeat(300) }),
    renderBackSvg(baseBack),
    renderBackSvg({ ...baseBack, style: 'custom' }),
  ];
  const entities = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
  for (const svg of documents) {
    for (const match of svg.matchAll(/<text\b([^>]*)>(.*?)<\/text>/g)) {
      const attributes = match[1];
      const value = match[2].replace(/&(?:amp|lt|gt|quot|apos);/g, (entity) => entities[entity]);
      const attribute = (name) => attributes.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
      const x = Number(attribute('x'));
      const y = Number(attribute('y'));
      const fontSize = Number(attribute('font-size'));
      const width = measureTextWidth(value, fontSize, Number(attribute('font-weight')));
      const anchor = attribute('text-anchor');
      const left = x - (anchor === 'end' ? width : anchor === 'middle' ? width / 2 : 0);
      assert.ok(left >= 37.5, `${value}: left ${left}`);
      assert.ok(left + width <= 712.5, `${value}: right ${left + width}`);
      assert.ok(y - fontSize >= 37.5, `${value}: top ${y - fontSize}`);
      assert.ok(y + fontSize * 0.25 <= 1012.5, `${value}: bottom ${y + fontSize * 0.25}`);
    }
  }
});

test('wrapping preserves explicit newlines and all letters of overlong words', () => {
  assert.deepEqual(wrapText('one\n\ntwo\n', 500, 24), ['one', '', 'two', '']);
  assert.deepEqual(wrapText('one\r\ntwo\rthree', 500, 24), ['one', 'two', 'three']);
  assert.deepEqual(wrapText('', 500, 24), ['']);
  const word = 'Mosswhiskersupercalifragilistic'.repeat(10);
  const lines = wrapText(word, 120, 27);
  assert.ok(lines.length > 1);
  assert.equal(lines.join(''), word);
  for (const line of lines) assert.ok(measureTextWidth(line, 27) <= 120);
  const unicode = '湖🌿海🐋'.repeat(10);
  const unicodeLines = wrapText(unicode, 100, 24);
  assert.equal(unicodeLines.join(''), unicode);
  assert.doesNotMatch(unicodeLines.join('|'), /[\ud800-\udbff]\||\|[\udc00-\udfff]/);
  assert.equal(wrapText('abcdefgh', 0, 24).join(''), 'abcdefgh');
});

test('fallback measurement accounts for glyph width and weight, not just character count', () => {
  assert.ok(measureTextWidth('WWWW', 29) > measureTextWidth('iiii', 29) * 3);
  assert.ok(measureTextWidth('Gentle', 29, 700) > measureTextWidth('Gentle', 29, 400));
  close(measureTextWidth('Moss', 48), measureTextWidth('Moss', 24) * 2);
  for (const line of wrapText('Wide WWWW and narrow iii words should fit.', 190, 29, 700)) {
    assert.ok(measureTextWidth(line, 29, 700) <= 190);
  }
  for (let point = 32; point <= 126; point += 1) {
    assert.ok(Number.isFinite(measureTextWidth(String.fromCodePoint(point), 24, 400)));
    assert.ok(Number.isFinite(measureTextWidth(String.fromCodePoint(point), 24, 700)));
  }
});

test('browser canvas measurement is lazy and uses the same SVG font family', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  let created = 0;
  const context = {
    font: '',
    measureText(value) { return { width: value.length * 12 }; },
  };
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement(tag) {
        assert.equal(tag, 'canvas');
        created += 1;
        return { getContext: () => context };
      },
    },
  });
  try {
    const renderer = await import('./cardStudioRender.mjs?canvas-measurement-test');
    assert.equal(created, 0, 'Importing must not touch the DOM');
    close(renderer.measureTextWidth('leaf', 29, 700), 48 * 1.025);
    assert.equal(context.font, '700 29px Arial, Helvetica, sans-serif');
    renderer.measureTextWidth('wave', 24);
    assert.equal(created, 1, 'The same canvas context should be reused');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  }
});

test('wrapped studio back labels and sublabels have separate safe areas, or explicit warnings', () => {
  const svg = renderBackSvg({
    ...baseBack, label: 'THE CELESTIAL FIELD GUIDE',
    sublabel: 'A collection of companions\nfor the long way home\nOriginal series',
  });
  assert.match(svg, /data-overflow="false"/);
  const labels = [...svg.matchAll(/<text x="375" y="([\d.]+)" font-size="([\d.]+)"[^>]*>(.*?)<\/text>/g)];
  const heading = labels.filter((match) => Number(match[1]) < 792);
  const sublabel = labels.filter((match) => Number(match[1]) >= 792);
  assert.ok(heading.length >= 2);
  assert.equal(sublabel.length, 3);
  assert.ok(Math.max(...heading.map((match) => Number(match[1]) + Number(match[2]) * 0.25))
    < Math.min(...sublabel.map((match) => Number(match[1]) - Number(match[2]))));
  for (const match of labels) assert.ok(Number(match[1]) + Number(match[2]) * 0.25 < 1012.5);
  const overflowing = renderBackSvg({ ...baseBack, label: 'Long label '.repeat(100) });
  assert.match(overflowing, /data-overflow="true"/);
  assert.match(overflowing, /Back label does not fit/);
});

test('SVG data URLs round trip exactly, including Unicode and URL-significant characters', () => {
  const svg = renderCardSvg({ ...baseCard, name: 'Moss & Moon #1 🌿' });
  const url = svgDataUrl(svg);
  assert.ok(url.startsWith('data:image/svg+xml;charset=utf-8,'));
  assert.equal(decodeURIComponent(url.slice(url.indexOf(',') + 1)), svg);
  assert.doesNotMatch(url.slice(url.indexOf(',') + 1), /[<>#&"]/);
});

test('original art and studio backs are deterministic and have no network or font dependencies', () => {
  const rendered = [
    ...types.map((type) => renderCardSvg({ ...baseCard, type })),
    renderBackSvg(baseBack),
  ];
  for (const svg of rendered) {
    assert.doesNotMatch(svg, /<script|<foreignObject|<style|@import|@font-face|https:\/\/|xlink:href=/i);
    assert.doesNotMatch(svg, /\bhref="(?!data:image\/)/i);
    assert.doesNotMatch(svg, /url\((?!#)/);
    assert.match(svg, /font-family="Arial, Helvetica, sans-serif"/);
  }
  assert.equal(renderCardSvg(baseCard), renderCardSvg(baseCard));
  assert.equal(renderBackSvg(baseBack), renderBackSvg(baseBack));
  assert.notEqual(renderCardSvg({ ...baseCard, type: 'grass' }), renderCardSvg({ ...baseCard, type: 'fire' }));
  assert.notEqual(renderCardSvg({ ...baseCard, type: 'water' }), renderCardSvg({ ...baseCard, type: 'fire' }));
});

test('default and malformed optional inputs remain finite and self-contained', () => {
  for (const svg of [
    renderCardSvg(), renderCardSvg(null),
    renderCardSvg({ template: '<script>', type: '" onload="bad()', border: '<bad>', moves: null }),
    renderBackSvg(), renderBackSvg(null),
  ]) {
    assert.ok(svg.startsWith('<svg '));
    assert.ok(svg.endsWith('</svg>'));
    assert.doesNotMatch(svg, /NaN|Infinity|undefined|onload=/);
  }
});
