const WIDTH = 750;
const HEIGHT = 1050;
const UNITS_PER_INCH = 300;
const BLEED = 37.5;
const SAFE = 37.5;
const LEFT = 53;
const CONTENT_WIDTH = 644;
const ART_TOP = 162;
const MIN_BODY_FONT = 24;
const FONT = 'Arial, Helvetica, sans-serif';

const PALETTES = {
  grass: { name: 'Grass', ink: '#183d32', light: '#edf2d6', pale: '#f8fae8', accent: '#52845a', bright: '#b3d783', sky: '#174d46', horizon: '#d6dca3', land: '#315b46', coat: '#91b785', shade: '#436d55', cream: '#fff2cd' },
  fire: { name: 'Fire', ink: '#542f26', light: '#f7dfb4', pale: '#fff3df', accent: '#ba5b3e', bright: '#ffc16d', sky: '#65374b', horizon: '#f3bd83', land: '#873e40', coat: '#e29251', shade: '#a34939', cream: '#fff1cb' },
  water: { name: 'Water', ink: '#163d54', light: '#d4eaf0', pale: '#f0f8f6', accent: '#3e85a4', bright: '#90d9db', sky: '#194a68', horizon: '#b1e3dc', land: '#27667b', coat: '#69b8c5', shade: '#34758e', cream: '#e4f4e3' },
  lightning: { name: 'Lightning', ink: '#4b421d', light: '#f6edb8', pale: '#fffbed', accent: '#b49a3d', bright: '#ffe995', sky: '#465375', horizon: '#efe3ad', land: '#676857', coat: '#e2c76f', shade: '#9b7c43', cream: '#fff8d8' },
  psychic: { name: 'Psychic', ink: '#433059', light: '#e8dcef', pale: '#fbf2fb', accent: '#91649f', bright: '#d9afdf', sky: '#493b6b', horizon: '#d7bddb', land: '#5d507e', coat: '#ba9acb', shade: '#7a628e', cream: '#f8e9f4' },
  fighting: { name: 'Fighting', ink: '#513c2e', light: '#eedcc4', pale: '#fbf3e7', accent: '#a87751', bright: '#dfb98b', sky: '#615750', horizon: '#e9c69e', land: '#816754', coat: '#b59069', shade: '#775b4c', cream: '#f7e7c7' },
  darkness: { name: 'Darkness', ink: '#25354b', light: '#dce4e9', pale: '#edf1f4', accent: '#536780', bright: '#aabfd6', sky: '#1e2b47', horizon: '#8598b5', land: '#303f5c', coat: '#8799b4', shade: '#445773', cream: '#dce8f1' },
  metal: { name: 'Metal', ink: '#34434b', light: '#e0e7e5', pale: '#f3f6f1', accent: '#728b91', bright: '#ccdeda', sky: '#425c6c', horizon: '#cbd8ce', land: '#607979', coat: '#bbc9c5', shade: '#6f8b8d', cream: '#f7f5e5' },
  dragon: { name: 'Dragon', ink: '#4a3e26', light: '#eee1b5', pale: '#faf4db', accent: '#a38a49', bright: '#e9d894', sky: '#364e59', horizon: '#e0cf97', land: '#5f6c52', coat: '#b6ba78', shade: '#677b5a', cream: '#fff0bd' },
  fairy: { name: 'Fairy', ink: '#583747', light: '#f2dce4', pale: '#fff2f4', accent: '#b17691', bright: '#efb9d1', sky: '#6b466b', horizon: '#f0c9d5', land: '#916779', coat: '#d6a5bd', shade: '#9e708f', cream: '#fff0df' },
  colorless: { name: 'Colorless', ink: '#3d4546', light: '#e9e9df', pale: '#fcfbf2', accent: '#89938a', bright: '#e2dfb6', sky: '#4d6971', horizon: '#e2e1bc', land: '#677b6b', coat: '#c4c6a9', shade: '#7f927a', cream: '#fff4db' },
};

const BORDERS = {
  gold: ['#796130', '#e9d69b', '#fff1c6', '#ac843e'],
  silver: ['#697780', '#d2dce0', '#f8fbfb', '#91a0a9'],
  dark: ['#121d2b', '#425066', '#8392a5', '#25354b'],
};

const NORMAL_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const BOLD_WIDTHS = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

let measurementContext;

function text(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '\ufffd')
    .replace(/[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff]/g, (character) => character.length === 2 ? character : '\ufffd');
}

function escapeXml(value) {
  return text(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character]);
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, minimum, maximum, fallback = minimum) {
  return Math.min(maximum, Math.max(minimum, number(value, fallback)));
}

function n(value) {
  return Number(number(value).toFixed(3));
}

function palette(type) {
  return PALETTES[type] || PALETTES.colorless;
}

function getMeasurementContext() {
  if (measurementContext === undefined && typeof document !== 'undefined') {
    try {
      measurementContext = document.createElement('canvas').getContext('2d') || null;
    } catch {
      measurementContext = null;
    }
  }
  return measurementContext;
}

/** Arial metrics with a small safety margin; the fallback also works in Node and workers. */
export function measureTextWidth(value, fontSize, weight = 400) {
  const content = text(value);
  const size = Math.max(1, number(fontSize, 29));
  const fontWeight = clamp(weight, 100, 900, 400);
  const context = getMeasurementContext();
  if (context) {
    context.font = `${fontWeight} ${size}px ${FONT}`;
    return context.measureText(content).width * 1.025;
  }
  const widths = fontWeight >= 600 ? BOLD_WIDTHS : NORMAL_WIDTHS;
  let total = 0;
  for (const character of content) {
    const point = character.codePointAt(0);
    if (point >= 32 && point <= 126) total += widths[point - 32] / 1000;
    else if (/[\p{Mark}\u200b-\u200d\ufe0e\ufe0f]/u.test(character)) total += 0;
    else if (/\s/u.test(character)) total += 0.278;
    else if (point >= 0x2e80) total += 1;
    else if ('‘’‚'.includes(character)) total += 0.278;
    else if ('“”„'.includes(character)) total += 0.474;
    else if (character === '—') total += 1;
    else if (character === '–') total += 0.556;
    else total += 0.65;
  }
  return total * size * 1.04;
}

/** Explicit newlines are retained, including empty lines; long words are never discarded. */
export function wrapText(value, width, fontSize, weight = 400) {
  const maxWidth = Math.max(1, number(width, 1));
  const result = [];
  for (const paragraph of text(value).replace(/\r\n?/g, '\n').split('\n')) {
    const words = paragraph.trim().split(/\s+/u).filter(Boolean);
    if (!words.length) {
      result.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (measureTextWidth(candidate, fontSize, weight) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) {
        result.push(line);
        line = '';
      }
      if (measureTextWidth(word, fontSize, weight) <= maxWidth) {
        line = word;
        continue;
      }
      for (const character of word) {
        if (line && measureTextWidth(line + character, fontSize, weight) > maxWidth) {
          result.push(line);
          line = '';
        }
        line += character;
      }
    }
    result.push(line);
  }
  return result;
}

function fitText(value, width, height, {
  preferred = 29, minimum = 24, weight = 400, maxLines = Infinity, leading = 1.18,
} = {}) {
  let fitted;
  for (let size = preferred; size >= minimum; size -= 1) {
    const lines = wrapText(value, width, size, weight);
    const lineHeight = size * leading;
    fitted = {
      lines, fontSize: size, lineHeight, height: lines.length * lineHeight,
      width, maxHeight: height, weight,
    };
    if (lines.length <= maxLines && fitted.height <= height
      && lines.every((line) => measureTextWidth(line, size, weight) <= width)) {
      return { ...fitted, overflow: false };
    }
  }
  return { ...fitted, overflow: true };
}

function normalizeCard(input = {}) {
  const card = input || {};
  const template = ['classic', 'full-art', 'trainer', 'energy'].includes(card.template) ? card.template : 'classic';
  return {
    ...card,
    template,
    type: Object.hasOwn(PALETTES, card.type) ? card.type : 'colorless',
    border: Object.hasOwn(BORDERS, card.border) ? card.border : 'gold',
    name: text(card.name) || 'Untitled card',
    stage: text(card.stage) || 'Basic',
    hp: text(card.hp),
    evolvesFrom: text(card.evolvesFrom),
    subtitle: text(card.subtitle),
    abilityName: text(card.abilityName),
    abilityText: text(card.abilityText),
    flavor: text(card.flavor),
    illustrator: text(card.illustrator),
    setCode: text(card.setCode),
    number: text(card.number),
    weakness: text(card.weakness),
    weaknessModifier: text(card.weaknessModifier),
    resistance: text(card.resistance),
    resistanceModifier: text(card.resistanceModifier),
    retreat: Math.max(0, Math.round(number(card.retreat))),
    moves: Array.isArray(card.moves) ? card.moves.map((move) => ({
      name: text(move?.name),
      damage: text(move?.damage),
      text: text(move?.text),
      cost: Array.isArray(move?.cost) ? move.cost : [],
    })) : [],
    art: card.art || null,
  };
}

function safeRaster(art) {
  if (!art || typeof art.data !== 'string'
    || !Number.isFinite(art.width) || art.width <= 0
    || !Number.isFinite(art.height) || art.height <= 0) return false;
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(art.data);
  if (!match || match[2].length % 4 !== 0) return false;
  // Check raster signatures as well as the URL, without decoding an entire large photograph.
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = [];
  let bits = 0;
  let buffer = 0;
  for (const character of match[2].slice(0, 24)) {
    if (character === '=') break;
    buffer = (buffer << 6) | alphabet.indexOf(character);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 255);
    }
  }
  if (match[1] === 'png') return [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  if (match[1] === 'jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  return bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
}

/** Position an aspect-preserving raster in trim coordinates, independently of bleed. */
export function imagePlacement(art, box, { fit = 'cover', x = 50, y = 50, zoom = 1 } = {}) {
  const target = {
    x: number(box?.x), y: number(box?.y),
    width: Math.max(0, number(box?.width)), height: Math.max(0, number(box?.height)),
  };
  const sourceWidth = number(art?.width);
  const sourceHeight = number(art?.height);
  if (sourceWidth <= 0 || sourceHeight <= 0 || !target.width || !target.height) {
    return { x: target.x, y: target.y, width: 0, height: 0 };
  }
  const scale = (fit === 'contain' ? Math.min : Math.max)(
    target.width / sourceWidth, target.height / sourceHeight,
  ) * clamp(zoom, 1, 3, 1);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: target.x + (target.width - width) * clamp(x, 0, 100, 50) / 100,
    y: target.y + (target.height - height) * clamp(y, 0, 100, 50) / 100,
    width,
    height,
  };
}

function rulesLayout(card, fontSize, creature) {
  const blocks = [];
  const warnings = [];
  const lineHeight = fontSize * 1.21;
  if (card.abilityName || card.abilityText) {
    const badge = creature ? 'ABILITY' : 'EFFECT';
    const name = card.abilityName || (creature ? 'Special ability' : card.template === 'energy' ? 'Energy effect' : 'Trainer rule');
    const heading = fitText(name, CONTENT_WIDTH - 122, 67, {
      preferred: fontSize + 1, minimum: MIN_BODY_FONT, weight: 700, maxLines: 2, leading: 1.08,
    });
    const lines = card.abilityText ? wrapText(card.abilityText, CONTENT_WIDTH, fontSize) : [];
    const headingHeight = Math.max(29, heading.overflow ? 52 : heading.height);
    if (heading.overflow) warnings.push('Ability name does not fit at a readable size. Shorten it before printing.');
    blocks.push({
      kind: 'ability', badge, heading, headingHeight, lines, lineHeight,
      height: headingHeight + (lines.length ? 7 + lines.length * lineHeight : 0),
    });
  }
  if (creature) {
    card.moves.forEach((move, index) => {
      const costColumns = Math.min(4, move.cost.length);
      const costWidth = costColumns ? costColumns * 29 + 10 : 0;
      const costHeight = Math.ceil(move.cost.length / 4) * 29;
      const damageWidth = move.damage ? 102 : 0;
      const headingWidth = CONTENT_WIDTH - costWidth - damageWidth - (damageWidth ? 12 : 0);
      const heading = fitText(move.name || 'Unnamed move', headingWidth, 67, {
        preferred: fontSize + 1, minimum: MIN_BODY_FONT, weight: 700, maxLines: 2, leading: 1.08,
      });
      const damage = move.damage ? fitText(move.damage, damageWidth, 67, {
        preferred: 36, minimum: 24, weight: 700, maxLines: 2, leading: 1.05,
      }) : null;
      const headingHeight = Math.max(32, heading.overflow ? 52 : heading.height, damage?.height || 0, costHeight);
      const lines = move.text ? wrapText(move.text, CONTENT_WIDTH, fontSize) : [];
      if (heading.overflow) warnings.push(`Move ${index + 1} name does not fit at a readable size. Shorten it before printing.`);
      if (damage?.overflow) warnings.push(`Move ${index + 1} damage does not fit. Shorten it before printing.`);
      blocks.push({
        kind: 'move', heading, headingHeight, cost: move.cost, costWidth, damage, damageWidth,
        lines, lineHeight, height: headingHeight + (lines.length ? 6 + lines.length * lineHeight : 0),
      });
    });
  }
  return {
    blocks, warnings,
    height: blocks.reduce((sum, block) => sum + block.height, 0) + Math.max(0, blocks.length - 1) * 20,
  };
}

/**
 * All geometry is in 300-DPI trim units. Overflow retains its complete measured
 * lines here; rendering replaces an impossible field with an explicit notice.
 */
export function getCardLayout(input) {
  const card = normalizeCard(input);
  const creature = card.template === 'classic' || card.template === 'full-art';
  const warnings = [];
  const check = (field, label) => {
    if (field?.overflow) warnings.push(`${label} does not fit at a readable size. Shorten it before printing.`);
    return field;
  };
  const stageText = creature ? card.stage : card.template === 'trainer' ? 'TRAINER' : 'BASIC ENERGY';
  const stage = check(fitText(stageText, 174, 36, {
    preferred: 20, minimum: 17, weight: 700, maxLines: 2, leading: 1.05,
  }), 'Stage');
  const stageWidth = Math.min(198, Math.max(92, ...stage.lines.map((line) => measureTextWidth(line, stage.fontSize, 700) + 24)));
  const evolutionX = 48 + stageWidth + 14;
  const evolution = creature && card.evolvesFrom ? check(fitText(`Evolves from ${card.evolvesFrom}`, 697 - evolutionX, 36, {
    preferred: 18, minimum: 16, maxLines: 2, leading: 1.1,
  }), 'Evolves-from text') : null;
  const name = check(fitText(card.name, creature ? 474 : 574, 68, {
    preferred: 44, minimum: 28, weight: 700, maxLines: 2, leading: 1.06,
  }), 'Name');
  const hp = creature ? check(fitText(card.hp || '—', 84, 43, {
    preferred: 36, minimum: 24, weight: 700, maxLines: 1, leading: 1.05,
  }), 'HP') : null;
  const subtitle = creature && card.subtitle ? check(fitText(card.subtitle, 624, 44, {
    preferred: 20, minimum: 18, maxLines: 2, leading: 1.1,
  }), 'Subtitle') : null;
  const flavor = card.flavor ? check(fitText(card.flavor, CONTENT_WIDTH - 20, 69, {
    preferred: 21, minimum: 19, maxLines: 3, leading: 1.15,
  }), 'Flavor text') : null;
  const illustrator = check(fitText(`Illus. ${card.illustrator || '—'}`, 328, 36, {
    preferred: 17, minimum: 16, maxLines: 2, leading: 1.1,
  }), 'Illustrator');
  const setNumber = check(fitText([card.setCode, card.number].filter(Boolean).join(' · ') || 'STL · 001', 244, 36, {
    preferred: 17, minimum: 16, weight: 700, maxLines: 2, leading: 1.1,
  }), 'Set / card number');
  const weakness = creature && card.weakness ? check(fitText(card.weaknessModifier, 119, 28, {
    preferred: 22, minimum: 18, maxLines: 1, leading: 1.1,
  }), 'Weakness modifier') : null;
  const resistance = creature && card.resistance ? check(fitText(card.resistanceModifier, 119, 28, {
    preferred: 22, minimum: 18, maxLines: 1, leading: 1.1,
  }), 'Resistance modifier') : null;
  const retreat = creature && card.retreat > 5 ? check(fitText(`× ${card.retreat}`, 148, 28, {
    preferred: 22, minimum: 18, maxLines: 1, leading: 1.1,
  }), 'Retreat cost') : null;
  const flavorHeight = flavor ? (flavor.overflow ? 69 : flavor.height) : 0;
  const flavorTop = 956 - flavorHeight;
  const combatTop = creature ? flavorTop - (flavor ? 14 : 0) - 56 : null;
  const bodyBottom = (creature ? combatTop : flavorTop) - 18;
  const subtitleHeight = subtitle ? (subtitle.overflow ? 44 : subtitle.height) : 0;
  const artBodyGap = subtitle ? subtitleHeight + 23 : 18;
  const minArtHeight = card.template === 'energy' ? 254 : 230;
  const maxArtHeight = creature ? 518 : 560;
  const available = bodyBottom - ART_TOP - artBodyGap;
  let bodyFontSize = creature ? 29 : 30;
  let rules;
  for (; bodyFontSize >= MIN_BODY_FONT; bodyFontSize -= 1) {
    rules = rulesLayout(card, bodyFontSize, creature);
    if (rules.height <= available - minArtHeight && !rules.warnings.length) break;
  }
  bodyFontSize = Math.max(MIN_BODY_FONT, bodyFontSize);
  const artHeight = Math.max(minArtHeight, Math.min(maxArtHeight, available - rules.height));
  const baseBodyTop = ART_TOP + artHeight + artBodyGap;
  const bodyTop = baseBodyTop + Math.min(20, Math.max(0, (bodyBottom - baseBodyTop - rules.height) / 2));
  const bodyHeight = Math.max(0, bodyBottom - bodyTop);
  const bodyOverflow = rules.height > bodyHeight + 0.001 || rules.warnings.length > 0;
  warnings.push(...rules.warnings);
  if (rules.height > bodyHeight + 0.001) {
    warnings.push(`Rules text needs ${Math.ceil(rules.height)} units, but only ${Math.floor(bodyHeight)} fit at the minimum ${MIN_BODY_FONT}-unit body size. Shorten the rules or remove a move before printing.`);
  }
  const validArt = safeRaster(card.art);
  if (card.art && !validArt) warnings.push('Artwork must be an embedded PNG, JPEG, or WebP raster with valid dimensions. Replace it before printing.');
  return {
    artBox: card.template === 'full-art'
      ? { x: 0, y: 0, width: WIDTH, height: HEIGHT }
      : { x: 48, y: ART_TOP, width: 654, height: artHeight },
    focusArtBox: { x: 48, y: ART_TOP, width: 654, height: artHeight },
    bodyFontSize,
    overflow: warnings.length > 0,
    warnings,
    creature, fullArt: card.template === 'full-art', validArt, bodyOverflow, bodyTop, bodyBottom, bodyHeight, artFocusBottom: baseBodyTop - 11,
    rules, stage, stageWidth, evolution, evolutionX, name, hp, subtitle, subtitleHeight,
    flavor, flavorTop, combatTop, weakness, resistance, retreat, illustrator, setNumber,
  };
}

function rect(box, attributes = '') {
  return `<rect x="${n(box.x)}" y="${n(box.y)}" width="${n(box.width)}" height="${n(box.height)}" ${attributes}/>`;
}

function textLines(lines, x, top, fontSize, {
  fill = '#23343c', weight = 400, lineHeight = fontSize * 1.18, anchor = 'start', italic = false,
} = {}) {
  return lines.map((line, index) => `<text x="${n(x)}" y="${n(top + fontSize + index * lineHeight)}" font-size="${n(fontSize)}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${italic ? ' font-style="italic"' : ''} xml:space="preserve">${escapeXml(line)}</text>`).join('');
}

function notice(x, y, width, height, label = 'Text does not fit') {
  const size = width < 130 ? 13 : 17;
  const lines = wrapText(label, width - 12, size, 700);
  const visibleHeight = Math.max(26, Math.min(height, lines.length * size * 1.1 + 8));
  return `<g data-layout-warning="true">${rect({ x, y, width, height: visibleHeight }, 'rx="4" fill="#fff1e9" stroke="#b65a3b" stroke-width="1.5"')}${textLines(lines, x + 6, y + 3, size, { fill: '#8b382b', weight: 700, lineHeight: size * 1.1 })}</g>`;
}

function fittedText(fit, x, y, { fill, anchor = 'start', italic = false, label = 'Text does not fit' } = {}) {
  if (!fit) return '';
  if (fit.overflow) return notice(x, y, fit.width, fit.maxHeight, label);
  const position = anchor === 'middle' ? x + fit.width / 2 : anchor === 'end' ? x + fit.width : x;
  return textLines(fit.lines, position, y, fit.fontSize, {
    fill, weight: fit.weight, lineHeight: fit.lineHeight, anchor, italic,
  });
}

const GLYPHS = {
  grass: '<path d="M16 26V14M16 21C7 22 5 17 6 11c7-1 11 3 10 10ZM16 17C15 9 20 5 27 6c0 7-4 12-11 11Z" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>',
  fire: '<path d="M17 4c3 7-2 8 3 13 0-4 3-5 4-7 7 11 2 18-8 18C6 28 3 19 9 12c-1 6 3 7 4 8-2-8 4-9 4-16Z" fill="currentColor"/><path d="M16 20c-4 5-2 7 1 7s5-3-1-7Z" fill="#fff" opacity=".6"/>',
  water: '<path d="M16 4C13 10 6 16 6 21a10 10 0 0 0 20 0c0-5-7-11-10-17Z" fill="currentColor"/><path d="M10 21c0 4 4 6 8 4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>',
  lightning: '<path d="M18 3 6 19h8l-1 10L27 12h-9l3-9Z" fill="currentColor"/>',
  psychic: '<path d="M3 16c8-12 18-12 26 0-8 12-18 12-26 0Z" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="m16 9 6 7-6 7-6-7Z" fill="currentColor"/><circle cx="16" cy="16" r="2" fill="#fff" opacity=".8"/>',
  fighting: '<path d="m5 22 3-12 9-5 10 9-2 12H10Z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/><path d="m8 10 8 6 11-2M16 16l-6 10m6-10 1-11m-1 11 9 10" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  darkness: '<path d="M22 5C7 1 1 17 10 25c7 6 15 1 17-5-12 5-19-7-5-15Z" fill="currentColor"/><path d="m24 4 1.5 4 4 1.5-4 1.5-1.5 4L22.5 11 19 9.5 22.5 8Z" fill="currentColor"/>',
  metal: '<path d="m16 4 11 6v12l-11 6-11-6V10Z" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="m16 9 6 7-6 7-6-7Z" fill="currentColor"/>',
  dragon: '<path d="m21 4 4 6-8 2c-8 2-9 8-3 10 5 2 9-1 8-5 7 5 0 13-9 10C2 23 5 12 16 9l-3-3 8 1Z" fill="currentColor"/><circle cx="21" cy="9" r="1" fill="#fff"/>',
  fairy: '<path d="M16 4c7 0 5 9 0 12-5-3-7-12 0-12Zm12 19c-3 6-10 1-12-7 8-2 16 1 12 7ZM4 23c-4-6 4-9 12-7-2 8-9 13-12 7Z" fill="currentColor"/><path d="m16 12 4 4-4 5-4-5Z" fill="#fff" opacity=".65"/>',
  colorless: '<path d="m16 3 4 9 9 4-9 4-4 9-4-9-9-4 9-4Z" fill="currentColor"/><circle cx="16" cy="16" r="3" fill="#fff" opacity=".7"/>',
};

function elementIcon(type, x, y, size, { badge = true, ink = '#fff9e9', background } = {}) {
  const key = Object.hasOwn(GLYPHS, type) ? type : 'colorless';
  return `<g aria-label="${palette(key).name}" transform="translate(${n(x - size / 2)} ${n(y - size / 2)}) scale(${n(size / 32)})" color="${ink}">${badge ? `<circle cx="16" cy="16" r="15" fill="${background || palette(key).accent}" stroke="#fff9e7" stroke-opacity=".85" stroke-width="1.1"/><circle cx="16" cy="16" r="12.8" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width=".7"/>` : ''}${GLYPHS[key]}</g>`;
}

function star(x, y, radius, fill, opacity = 1) {
  return `<path d="M${n(x)} ${n(y - radius)} ${n(x + radius * 0.24)} ${n(y - radius * 0.24)} ${n(x + radius)} ${n(y)} ${n(x + radius * 0.24)} ${n(y + radius * 0.24)} ${n(x)} ${n(y + radius)} ${n(x - radius * 0.24)} ${n(y + radius * 0.24)} ${n(x - radius)} ${n(y)} ${n(x - radius * 0.24)} ${n(y - radius * 0.24)}Z" fill="${fill}" opacity="${opacity}"/>`;
}

function sceneDefs(p) {
  return `<linearGradient id="art-sky" x2=".15" y2="1"><stop stop-color="${p.sky}"/><stop offset=".62" stop-color="${p.accent}"/><stop offset="1" stop-color="${p.horizon}"/></linearGradient>
    <radialGradient id="art-sun"><stop stop-color="${p.cream}"/><stop offset=".74" stop-color="${p.bright}" stop-opacity=".85"/><stop offset="1" stop-color="${p.bright}" stop-opacity="0"/></radialGradient>
    <linearGradient id="art-land" x2=".8" y2="1"><stop stop-color="${p.accent}"/><stop offset="1" stop-color="${p.ink}"/></linearGradient>
    <linearGradient id="art-river" x2=".3" y2="1"><stop stop-color="${p.horizon}"/><stop offset="1" stop-color="${p.bright}" stop-opacity=".15"/></linearGradient>
    <linearGradient id="creature-coat" x1=".2" y1="0" x2=".8" y2="1"><stop stop-color="${p.coat}"/><stop offset=".6" stop-color="${p.coat}"/><stop offset="1" stop-color="${p.shade}"/></linearGradient>
    <linearGradient id="creature-belly" x2=".6" y2="1"><stop stop-color="${p.cream}"/><stop offset="1" stop-color="${p.bright}"/></linearGradient>`;
}

function fox(p) {
  return `<g stroke="${p.shade}" stroke-width="2.2" stroke-linejoin="round">
    <path d="M285 365c-92 34-150-15-124-77 21-48 83-42 96-9-36-13-61 7-50 30 9 20 40 14 67 5Z" fill="url(#creature-coat)"/>
    <path d="M181 335c-26-41-6-72 26-75-18 21-10 42 17 52-14 3-28 11-43 23Z" fill="${p.cream}" stroke="none"/>
    <ellipse cx="350" cy="339" rx="91" ry="69" fill="url(#creature-coat)"/>
    <path d="M299 315c15-20 66-29 91-8l-1 69-49 14-42-20Z" fill="url(#creature-belly)" stroke="none"/>
    <path d="m289 228-14-78c35 6 55 31 62 56m45 5c16-30 38-42 66-42l-29 74" fill="${p.coat}"/>
    <path d="m295 207-8-38 34 39m75 8 33-31-18 42" fill="${p.cream}" stroke="none"/>
    <path d="M281 258c-7-42 22-67 65-68 49-3 89 29 85 68l17 14-21 7c-12 44-103 61-137 13l-21-9 17-10Z" fill="url(#creature-coat)"/>
    <path d="M292 263c20-5 40 6 54 21 17-22 41-28 72-20-4 29-34 47-66 44-30 1-52-16-60-45Z" fill="url(#creature-belly)" stroke="none"/>
    <path d="m331 198 16-22 15 21-12 26Z" fill="${p.bright}" stroke="none"/>
    <ellipse cx="318" cy="251" rx="7" ry="10" fill="#203d39" stroke="none"/><ellipse cx="389" cy="249" rx="7" ry="10" fill="#203d39" stroke="none"/>
    <circle cx="320" cy="247" r="2.3" fill="#fff" stroke="none"/><circle cx="391" cy="245" r="2.3" fill="#fff" stroke="none"/>
    <path d="m342 273 17-1-8 8Zm9 7c-2 8-8 11-15 7m15-7c1 8 9 10 15 5" fill="#315247" stroke="#315247" stroke-width="2"/>
    <path d="m307 275-31-7m29 15-35 3m126-11 32-12m-30 19 35 1" fill="none" stroke-width="1.7" opacity=".7"/>
    <ellipse cx="304" cy="384" rx="31" ry="16" fill="${p.coat}"/><ellipse cx="386" cy="385" rx="33" ry="16" fill="${p.coat}"/>
    <path d="m291 384 1 8m10-9 1 10m70-9 1 9m11-10 1 10" fill="none" opacity=".65"/>
    <path d="M363 198c16-22 27-25 43-27-4 20-20 33-43 27Z" fill="${p.accent}" stroke="${p.cream}" stroke-width="1"/>
    <path d="m368 194 29-17" fill="none" stroke="${p.bright}" stroke-width="1.5"/>
  </g>`;
}

function owl(p) {
  return `<g stroke="${p.shade}" stroke-width="2.2" stroke-linejoin="round">
    <path d="M301 328c-64 4-124-51-129-108 43 9 88 23 131 63m81 1c49-43 92-52 122-54-7 61-59 106-114 105" fill="url(#creature-coat)"/>
    <path d="m186 238 78 54m-66-31 70 49m220-60-75 50m61-24-64 43" fill="none" stroke="${p.cream}" stroke-opacity=".65" stroke-width="5" stroke-linecap="round"/>
    <path d="m318 350-29 65 43-21 16 32 19-33 42 11-28-58" fill="${p.coat}"/>
    <ellipse cx="348" cy="306" rx="83" ry="91" fill="url(#creature-coat)"/>
    <ellipse cx="348" cy="321" rx="54" ry="65" fill="url(#creature-belly)" stroke="none"/>
    <path d="m281 222-14-55 43 21c24-14 53-13 78 0l38-25-10 61c13 53-19 82-66 83-49 1-89-30-69-85Z" fill="url(#creature-coat)"/>
    <path d="M348 215c-42-49-91 11-55 48l55 34 55-35c39-43-13-93-55-47Z" fill="${p.cream}" stroke="none"/>
    <ellipse cx="319" cy="237" rx="12" ry="15" fill="#3c3540" stroke="none"/><ellipse cx="379" cy="237" rx="12" ry="15" fill="#3c3540" stroke="none"/>
    <circle cx="322" cy="232" r="4" fill="#fff" stroke="none"/><circle cx="382" cy="232" r="4" fill="#fff" stroke="none"/>
    <path d="m338 252 21 0-11 18Z" fill="${p.accent}" stroke="none"/>
    <path d="m331 185 18-26 18 26-19 21Z" fill="${p.bright}" stroke="none"/>
    <path d="m323 318 9 9 8-9m16 0 9 9 8-9m-34 27 9 9 9-9" fill="none" stroke="${p.accent}" stroke-width="3" stroke-linecap="round"/>
    <path d="m317 382-12 10m12-10 5 14m57-14-5 14m5-14 13 9" fill="none" stroke="${p.ink}" stroke-width="5" stroke-linecap="round"/>
  </g>`;
}

function whale(p) {
  return `<g stroke="${p.shade}" stroke-width="2.2" stroke-linejoin="round">
    <path d="M428 272c43-5 77-36 81-71-21-10-33-30-29-49 24 6 46 25 52 45 18-18 41-22 63-17-10 28-29 43-55 43-3 65-50 114-107 105Z" fill="url(#creature-coat)"/>
    <path d="M204 221c43-48 148-55 210-22 54 28 78 78 45 122-29 39-133 51-209 22-55-22-81-75-46-122Z" fill="url(#creature-coat)"/>
    <path d="M198 280c38 31 125 46 224 25 16-3 30-9 46-19-4 50-75 76-153 63-62-4-102-24-117-69Z" fill="url(#creature-belly)" stroke="none"/>
    <path d="M324 285c-3 47 30 77 61 85-4-27-3-52-20-79" fill="${p.shade}"/>
    <path d="M347 189c10-20 24-24 47-22l-5 30" fill="${p.coat}"/>
    <ellipse cx="236" cy="265" rx="9" ry="12" fill="#1d424c" stroke="none"/><circle cx="239" cy="261" r="3" fill="#fff" stroke="none"/>
    <path d="M212 289c10 9 23 11 36 5" fill="none" stroke="${p.ink}" stroke-width="3" stroke-linecap="round"/>
    <path d="M294 206c-10-21-6-34 4-45 7 15 6 28-4 45Zm15-8c3-22 14-31 29-30-3 15-13 25-29 30Z" fill="${p.bright}" stroke="none"/>
    <path d="m263 318 9 15m15-8 9 14m15-9 8 11" fill="none" stroke="${p.shade}" stroke-opacity=".35" stroke-width="2"/>
    <g fill="${p.cream}" stroke="none" opacity=".8"><circle cx="293" cy="233" r="4"/><circle cx="318" cy="222" r="3"/><circle cx="339" cy="235" r="5"/><circle cx="366" cy="219" r="3"/><circle cx="391" cy="238" r="4"/></g>
    <path d="m293 233 25-11 21 13 27-16 25 19" fill="none" stroke="${p.cream}" stroke-width="1" opacity=".45"/>
  </g>`;
}

function originalArtwork(card, layout) {
  const p = palette(card.type);
  const box = layout.artBox;
  const sceneHeight = 660 * box.height / box.width;
  const full = card.template === 'full-art';
  const visibleHeight = full ? (layout.artFocusBottom - box.y) * 660 / box.width : sceneHeight;
  const horizon = full ? Math.min(370, visibleHeight * 0.7) : sceneHeight * 0.58;
  const scale = full ? Math.min(1.12, Math.max(0.62, (visibleHeight - 100) / 335)) : Math.min(1.12, sceneHeight / 435);
  const creatureY = full ? Math.min(360, 100 + (visibleHeight - 100) * 0.54) : sceneHeight * 0.56;
  const isWater = card.type === 'water';
  const isOwl = ['fire', 'lightning', 'psychic'].includes(card.type);
  const sunY = full ? 104 : sceneHeight * 0.22;
  const hills = `<path d="M-20 ${n(horizon + 35)} 91 ${n(horizon - 82)} 178 ${n(horizon - 15)} 297 ${n(horizon - 114)} 432 ${n(horizon + 2)} 553 ${n(horizon - 70)} 688 ${n(horizon + 22)}V${n(sceneHeight)}H-20Z" fill="${p.horizon}" opacity=".21"/>
    <path d="M-10 ${n(horizon + 62)}Q123 ${n(horizon - 49)} 262 ${n(horizon + 52)}T670 ${n(horizon + 18)}V${n(sceneHeight)}H-10Z" fill="${p.land}" opacity=".72"/>
    <path d="M-10 ${n(horizon + 88)}Q146 ${n(horizon + 18)} 295 ${n(horizon + 89)}T670 ${n(horizon + 67)}V${n(sceneHeight)}H-10Z" fill="url(#art-land)"/>
    <path d="M422 ${n(horizon + 58)}c-198 35 60 39-124 84S103 ${n(sceneHeight - horizon - 45)} 179 ${n(sceneHeight - horizon + 20)}h254c-218-66 77-94 15-151s-114-34-26-75Z" fill="url(#art-river)" opacity=".55"/>`;
  const stars = Array.from({ length: 19 }, (_, index) => star(
    26 + (index * 107) % 610, 18 + (index * 41) % Math.max(24, Math.floor(horizon * 0.7)),
    index % 4 === 0 ? 5 : 2.2, p.cream, index % 3 === 0 ? 0.7 : 0.35,
  )).join('');
  const trees = [22, 82, 133, 515, 565, 626].map((x, index) => {
    const y = horizon + 54 + index % 2 * 18;
    const height = 50 + index % 3 * 20;
    return `<path d="M${x} ${n(y)}v-${height}m0 8-22 39h44l-22-39m0 23-31 42h62Z" fill="${p.land}" stroke="${p.land}" stroke-width="4" opacity=".65"/>`;
  }).join('');
  const foreground = [20, 64, 106, 550, 595, 641].map((x, index) => {
    const y = sceneHeight + 9;
    return `<g transform="translate(${x} ${n(y)})" fill="${index % 2 ? p.accent : p.ink}" opacity=".82"><path d="M0 0C-34-23-33-61-32-82-9-66 7-34 0 0ZM2 0c-5-42 22-69 45-80C48-43 28-13 2 0Z"/><path d="M1 0c-4-63-7-80-21-105" fill="none" stroke="${p.bright}" stroke-width="2"/><circle cx="-20" cy="-105" r="4" fill="${p.cream}"/></g>`;
  }).join('');
  let subject;
  if (card.template === 'energy') {
    const radius = Math.min(130, sceneHeight * 0.31);
    const cy = sceneHeight * 0.48;
    subject = `<circle cx="330" cy="${n(cy)}" r="${n(radius + 23)}" fill="${p.ink}" fill-opacity=".16" stroke="${p.cream}" stroke-opacity=".55" stroke-width="1.5"/><circle cx="330" cy="${n(cy)}" r="${n(radius + 10)}" fill="none" stroke="${p.cream}" stroke-dasharray="2 12" stroke-width="2"/>${elementIcon(card.type, 330, cy, radius * 2, { background: p.accent })}${star(330, cy - radius - 36, 10, p.cream)}${star(330, cy + radius + 36, 10, p.cream)}`;
  } else if (card.template === 'trainer') {
    const cy = sceneHeight * 0.5;
    const radius = Math.min(116, sceneHeight * 0.28);
    subject = `<g transform="translate(330 ${n(cy)})"><ellipse cy="${n(radius + 31)}" rx="${n(radius * 1.1)}" ry="16" fill="${p.ink}" opacity=".25"/><path d="m0 ${n(-radius - 22)} ${n(radius + 22)} ${n(radius + 22)} ${n(-radius - 22)} ${n(radius + 22)} ${n(-radius - 22)} ${n(-radius - 22)}Z" fill="${p.ink}" fill-opacity=".4" stroke="${p.cream}" stroke-width="2"/><circle r="${n(radius)}" fill="${p.sky}" stroke="${p.bright}" stroke-width="6"/><circle r="${n(radius - 15)}" fill="none" stroke="${p.cream}" stroke-width="1.5" stroke-dasharray="2 9"/>${star(0, 0, radius - 23, p.cream)}${star(0, 0, (radius - 23) * 0.5, p.accent)}<circle r="12" fill="${p.bright}"/></g>`;
  } else {
    subject = `<ellipse cx="346" cy="${n(creatureY + 122 * scale)}" rx="${n((isWater ? 175 : 137) * scale)}" ry="${n(16 * scale)}" fill="${p.ink}" opacity=".22"/><g transform="translate(${n(330 - 340 * scale)} ${n(creatureY - 280 * scale)}) scale(${n(scale)})">${isWater ? whale(p) : isOwl ? owl(p) : fox(p)}</g>`;
  }
  const atmosphere = isWater
    ? `<g fill="none" stroke="${p.cream}" stroke-opacity=".45"><circle cx="137" cy="${n(sceneHeight * 0.39)}" r="12"/><circle cx="163" cy="${n(sceneHeight * 0.25)}" r="6"/><circle cx="502" cy="${n(sceneHeight * 0.61)}" r="9"/><path d="M55 ${n(sceneHeight * 0.8)}q45-16 90 0m310 30q55-18 110 0" stroke-width="2"/></g>`
    : `${star(166, creatureY - 65, 8, p.bright, 0.85)}${star(468, creatureY + 24, 6, p.cream, 0.85)}`;
  return `<svg data-original-art="true" x="${n(box.x)}" y="${n(box.y)}" width="${n(box.width)}" height="${n(box.height)}" viewBox="0 0 660 ${n(sceneHeight)}" preserveAspectRatio="xMidYMid meet" overflow="hidden">
    <rect width="660" height="${n(sceneHeight)}" fill="url(#art-sky)"/>
    <circle cx="523" cy="${n(sunY)}" r="88" fill="url(#art-sun)"/><circle cx="523" cy="${n(sunY)}" r="42" fill="${p.cream}" opacity=".77"/><circle cx="523" cy="${n(sunY)}" r="50" fill="none" stroke="${p.cream}" opacity=".25"/>
    ${stars}<g fill="none" stroke="${p.cream}" stroke-width="2" stroke-opacity=".17"><path d="M-20 ${n(horizon * 0.4)}q136-35 254-5t255-9"/><path d="M369 ${n(horizon * 0.24)}q103-25 307 8"/></g>
    ${hills}${trees}${subject}${atmosphere}${foreground}
    ${full ? '' : `<rect x="7" y="7" width="646" height="${n(sceneHeight - 14)}" rx="2" fill="none" stroke="${p.cream}" stroke-opacity=".25"/>`}
  </svg>`;
}

function image(art, box, options, clip) {
  if (!safeRaster(art)) return '';
  const placement = imagePlacement(art, box, options);
  return `<image x="${n(placement.x)}" y="${n(placement.y)}" width="${n(placement.width)}" height="${n(placement.height)}" href="${escapeXml(art.data)}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${clip})"/>`;
}

function artworkBleed(margin) {
  if (!margin) return '';
  // Extend only the outermost artwork pixels; the trimmed image never moves or scales.
  const slices = [
    [-margin, 0, margin, HEIGHT, `0 0 1 ${HEIGHT}`],
    [WIDTH, 0, margin, HEIGHT, `${WIDTH - 1} 0 1 ${HEIGHT}`],
    [0, -margin, WIDTH, margin, `0 0 ${WIDTH} 1`],
    [0, HEIGHT, WIDTH, margin, `0 ${HEIGHT - 1} ${WIDTH} 1`],
    [-margin, -margin, margin, margin, '0 0 1 1'],
    [WIDTH, -margin, margin, margin, `${WIDTH - 1} 0 1 1`],
    [-margin, HEIGHT, margin, margin, `0 ${HEIGHT - 1} 1 1`],
    [WIDTH, HEIGHT, margin, margin, `${WIDTH - 1} ${HEIGHT - 1} 1 1`],
  ];
  return `<g data-art-bleed="true">${slices.map(([x, y, width, height, viewBox]) =>
    `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${viewBox}" preserveAspectRatio="none" overflow="hidden"><use href="#card-artwork"/></svg>`,
  ).join('')}</g>`;
}

function rarityMark(rarity, x, y, color) {
  const kind = ['common', 'uncommon', 'rare', 'double-rare', 'ultra-rare', 'secret'].includes(rarity) ? rarity : 'common';
  const shapes = {
    common: '<circle r="6"/><circle r="11" fill="none" stroke-width="1"/>',
    uncommon: '<path d="m0-12 10 12L0 12-10 0Z"/><path d="m0-7 5 7-5 7-5-7Z" fill="#fff" opacity=".5" stroke="none"/>',
    rare: star(0, 0, 15, color),
    'double-rare': `${star(-8, -3, 10, color)}${star(9, 4, 10, color)}`,
    'ultra-rare': '<path d="m-13-5 6-8H7l6 8L0 14Z" fill="none" stroke-width="2"/><path d="m-13-5 13 19L-5-5 0-13 5-5 0 14 13-5Z" fill="none" stroke-width="1.2"/>',
    secret: `<circle r="14" fill="none" stroke-width="1.5"/><circle r="10" fill="none" stroke-width=".8"/>${star(0, 0, 8, color)}`,
  };
  return `<g aria-label="${kind} rarity" transform="translate(${x} ${y})" fill="${color}" stroke="${color}"><title>${kind} rarity</title>${shapes[kind]}</g>`;
}

function renderRules(layout, p) {
  if (layout.bodyOverflow) {
    return `<g data-body-overflow="true">${rect({ x: LEFT, y: layout.bodyTop, width: CONTENT_WIDTH, height: Math.min(132, layout.bodyHeight) }, 'rx="8" fill="#fff0e7" stroke="#b96948" stroke-width="2"')}
      ${textLines(['RULES TEXT DOES NOT FIT'], LEFT + 18, layout.bodyTop + 14, 23, { fill: '#8b3e30', weight: 700 })}
      ${textLines(['Shorten the rules or remove a move.', 'Minimum body size: 24 units. Printing blocked.'], LEFT + 18, layout.bodyTop + 52, 20, { fill: '#8b3e30', lineHeight: 28 })}</g>`;
  }
  let y = layout.bodyTop;
  return layout.rules.blocks.map((block, index) => {
    let result = '';
    if (index) result += `<path d="M${LEFT} ${n(y - 10)}h${CONTENT_WIDTH}" stroke="${p.ink}" stroke-opacity=".16" stroke-width="1"/>`;
    if (block.kind === 'ability') {
      if (!layout.fullArt) result += rect({ x: LEFT, y: y + 3, width: 104, height: 26 }, `rx="13" fill="${p.accent}"`);
      result += textLines([block.badge], LEFT + 52, y + 5, 16, { fill: '#fff9ed', weight: 700, anchor: 'middle' });
      result += fittedText(block.heading, LEFT + 122, y, { fill: p.ink, label: 'Ability name does not fit' });
    } else {
      block.cost.forEach((cost, costIndex) => {
        result += elementIcon(cost, LEFT + 13 + costIndex % 4 * 29, y + 17 + Math.floor(costIndex / 4) * 29, 25);
      });
      result += fittedText(block.heading, LEFT + block.costWidth, y, { fill: p.ink, label: 'Move name does not fit' });
      result += fittedText(block.damage, LEFT + CONTENT_WIDTH - block.damageWidth, y - 2, { fill: p.ink, anchor: 'end', label: 'Damage does not fit' });
    }
    result += textLines(block.lines, LEFT, y + block.headingHeight + (block.kind === 'ability' ? 7 : 6), layout.bodyFontSize, { fill: p.ink, lineHeight: block.lineHeight });
    y += block.height + 20;
    return result;
  }).join('');
}

function combatBar(card, layout, p) {
  if (!layout.creature) return '';
  const y = layout.combatTop;
  let result = '<g data-combat-stats="true">';
  if (!layout.fullArt) result += rect({ x: 46, y: y - 4, width: 658, height: 62 }, `rx="8" fill="${p.ink}" fill-opacity=".055"`);
  result += `<path d="M263 ${n(y + 7)}v40m224-40v40" stroke="${p.ink}" stroke-opacity=".16"/>`;
  result += textLines(['WEAKNESS'], 58, y + 1, 15, { fill: p.ink, weight: 700 });
  result += textLines(['RESISTANCE'], 279, y + 1, 15, { fill: p.ink, weight: 700 });
  result += textLines(['RETREAT'], 503, y + 1, 15, { fill: p.ink, weight: 700 });
  if (card.weakness) result += elementIcon(card.weakness, 71, y + 40, 25) + fittedText(layout.weakness, 95, y + 25, { fill: p.ink, label: 'Too long' });
  else result += textLines(['—'], 61, y + 24, 22, { fill: p.ink });
  if (card.resistance) result += elementIcon(card.resistance, 292, y + 40, 25) + fittedText(layout.resistance, 316, y + 25, { fill: p.ink, label: 'Too long' });
  else result += textLines(['—'], 282, y + 24, 22, { fill: p.ink });
  if (card.retreat > 5) result += elementIcon('colorless', 516, y + 40, 25) + fittedText(layout.retreat, 540, y + 25, { fill: p.ink, label: 'Too long' });
  else if (card.retreat) result += Array.from({ length: card.retreat }, (_, index) => elementIcon('colorless', 516 + index * 29, y + 40, 25)).join('');
  else result += textLines(['—'], 506, y + 24, 22, { fill: p.ink });
  return result + '</g>';
}

function guidesSvg() {
  return `<g data-card-guides="true" fill="none" stroke-width="2" pointer-events="none">
    <rect x="0" y="0" width="750" height="1050" stroke="#ff378f" stroke-dasharray="14 8"/>
    <rect x="${SAFE}" y="${SAFE}" width="${WIDTH - 2 * SAFE}" height="${HEIGHT - 2 * SAFE}" stroke="#00b8d4" stroke-dasharray="8 7"/>
  </g>`;
}

function svgOpen(bleed, attributes = '') {
  const margin = bleed ? BLEED : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${(WIDTH + margin * 2) / UNITS_PER_INCH}in" height="${(HEIGHT + margin * 2) / UNITS_PER_INCH}in" viewBox="${-margin || 0} ${-margin || 0} ${WIDTH + margin * 2} ${HEIGHT + margin * 2}" font-family="${FONT}" ${attributes}>`;
}

/** A completely self-contained image: no HTML, external fonts, styles, or remote assets. */
export function renderCardSvg(input, { bleed = false, guides = false } = {}) {
  const card = normalizeCard(input);
  const layout = getCardLayout(card);
  const p = palette(card.type);
  const border = BORDERS[card.border];
  const margin = bleed ? BLEED : 0;
  const full = card.template === 'full-art';
  const lettering = full ? { ...p, ink: '#fff9ed' } : p;
  let svg = svgOpen(bleed, `role="img" aria-labelledby="card-title card-description" data-template="${card.template}" data-overflow="${layout.overflow}"`);
  svg += `<title id="card-title">${escapeXml(card.name)}</title><desc id="card-description">${escapeXml(layout.warnings.length ? layout.warnings.join(' ') : `An original ${p.name.toLowerCase()} ${card.template} trading card.`)}</desc>
    <defs>
      ${full ? '' : `<linearGradient id="card-border" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="750" y2="1050"><stop stop-color="${border[0]}"/><stop offset=".2" stop-color="${border[1]}"/><stop offset=".47" stop-color="${border[2]}"/><stop offset=".73" stop-color="${border[3]}"/><stop offset="1" stop-color="${border[1]}"/></linearGradient>
      <linearGradient id="card-face" x2=".2" y2="1"><stop stop-color="${p.light}"/><stop offset=".53" stop-color="${p.pale}"/><stop offset="1" stop-color="${p.light}"/></linearGradient>
      <pattern id="paper-grain" width="19" height="19" patternUnits="userSpaceOnUse"><circle cx="3" cy="5" r=".7" fill="${p.ink}" opacity=".045"/><path d="m12 13 2 1" stroke="${p.ink}" stroke-width=".6" opacity=".06"/></pattern>`}
      <clipPath id="art-window">${rect(layout.artBox)}</clipPath>
      ${sceneDefs(p)}
    </defs>`;
  svg += rect({ x: -margin, y: -margin, width: WIDTH + margin * 2, height: HEIGHT + margin * 2 }, `fill="${full ? p.sky : 'url(#card-border)'}"`);
  if (!full) {
    svg += '<rect x="13" y="13" width="724" height="1024" rx="18" fill="none" stroke="#fff8d5" stroke-opacity=".55" stroke-width="1.5"/>';
    svg += '<rect x="23" y="23" width="704" height="1004" rx="13" fill="#182c32" fill-opacity=".65"/>';
    svg += '<rect x="29" y="29" width="692" height="992" rx="9" fill="url(#card-face)"/>';
    svg += '<rect x="29" y="29" width="692" height="992" rx="9" fill="url(#paper-grain)"/>';
    svg += rect({ x: 43, y: ART_TOP - 5, width: 664, height: layout.artBox.height + 10 }, `rx="5" fill="${p.ink}" fill-opacity=".7" stroke="${border[2]}" stroke-width="1.5"`);
  }
  svg += `<g id="card-artwork" clip-path="url(#art-window)">${rect(layout.artBox, `fill="${p.sky}"`)}${layout.validArt
    ? image(card.art, layout.artBox, { fit: card.artFit, x: card.artX, y: card.artY, zoom: card.artZoom }, 'art-window')
    : originalArtwork(card, layout)}</g>`;
  if (full) {
    svg += artworkBleed(margin);
    svg += '<style>[data-card-labels="full-art"] text { paint-order: stroke fill; stroke: #11221e; stroke-width: 2.5; stroke-linejoin: round; } [data-card-labels="full-art"] [aria-label$="rarity"] { paint-order: stroke fill; stroke: #11221e; stroke-width: 2; }</style>';
  }
  svg += `<g data-card-labels="${full ? 'full-art' : 'framed'}">`;
  if (card.art && !layout.validArt) {
    svg += notice(64, ART_TOP + 15, 622, 34, 'Artwork rejected — use an embedded PNG, JPEG or WebP');
  }
  if (!full) svg += `<rect x="48" y="43" width="${n(layout.stageWidth)}" height="36" rx="18" fill="${p.ink}" fill-opacity=".1"/>`;
  svg += fittedText(layout.stage, 60, 43 + Math.max(0, (36 - layout.stage.height) / 2), { fill: lettering.ink, label: 'Stage does not fit' });
  if (layout.evolution) {
    svg += fittedText(layout.evolution, layout.evolutionX, 43 + Math.max(0, (36 - layout.evolution.height) / 2), { fill: lettering.ink, label: 'Evolution text does not fit' });
  } else {
    svg += textLines([`${p.name.toUpperCase()} · ${layout.creature ? 'COMPANION' : card.template === 'trainer' ? 'FIELD KIT' : 'ESSENCE'}`], 695, 49, 15, { fill: lettering.ink, anchor: 'end', weight: 700 });
  }
  svg += fittedText(layout.name, LEFT, 85 + Math.max(0, (68 - layout.name.height) / 2), { fill: lettering.ink, label: 'Name does not fit' });
  if (layout.creature) {
    svg += textLines(['HP'], 548, 86, 14, { fill: lettering.ink, weight: 700 });
    svg += fittedText(layout.hp, 548, 105, { fill: lettering.ink, label: 'HP too long' });
  }
  svg += elementIcon(card.type, 670, 119, 53, { background: p.accent });
  if (layout.subtitle) {
    const subtitleY = ART_TOP + layout.focusArtBox.height + 7;
    svg += fittedText(layout.subtitle, 63, subtitleY, { fill: lettering.ink, anchor: 'middle', label: 'Subtitle does not fit' });
  }
  svg += renderRules(layout, lettering);
  svg += combatBar(card, layout, lettering);
  if (layout.flavor) {
    svg += `<path d="M58 ${n(layout.flavorTop - 7)}h634" stroke="${lettering.ink}" stroke-opacity=".2" stroke-width="1"/>`;
    svg += fittedText(layout.flavor, 63, layout.flavorTop, { fill: lettering.ink, italic: true, label: 'Flavor text does not fit' });
  }
  svg += `<path d="M53 963h644" stroke="${full ? lettering.ink : '#425144'}" stroke-opacity=".22" stroke-width="1"/>`;
  svg += fittedText(layout.illustrator, LEFT, 970, { fill: lettering.ink, label: 'Illustrator does not fit' });
  svg += fittedText(layout.setNumber, 406, 970, { fill: lettering.ink, anchor: 'end', label: 'Set / number does not fit' });
  svg += rarityMark(card.rarity, 680, 984, lettering.ink);
  svg += '</g>';
  if (!full) svg += `<rect x="27" y="27" width="696" height="996" rx="11" fill="none" stroke="${border[2]}" stroke-opacity=".65" stroke-width="1"/>`;
  if (guides) svg += guidesSvg();
  return svg + '</svg>';
}

function safeColor(value) {
  return typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : '#223b54';
}

function mixColor(hex, target, amount) {
  const expanded = hex.length === 4 ? '#' + [...hex.slice(1)].map((character) => character + character).join('') : hex;
  const result = [1, 3, 5].map((position) => {
    const start = Number.parseInt(expanded.slice(position, position + 2), 16);
    return Math.round(start + (target - start) * amount).toString(16).padStart(2, '0');
  });
  return '#' + result.join('');
}

function studioBack(back, color) {
  const light = mixColor(color, 255, 0.73);
  const label = fitText(text(back.label) || 'STARFALL', 594, 136, {
    preferred: 58, minimum: 28, weight: 700, maxLines: 2, leading: 1.1,
  });
  const sublabel = fitText(text(back.sublabel), 582, 66, {
    preferred: 23, minimum: 17, maxLines: 3, leading: 1.15,
  });
  const stars = Array.from({ length: 67 }, (_, index) => {
    const x = 48 + index * 113 % 655;
    const y = 45 + index * 173 % 960;
    return index % 6 === 0 ? star(x, y, 4, light, 0.6)
      : `<circle cx="${x}" cy="${y}" r="${index % 3 === 0 ? 1.8 : 1}" fill="${light}" opacity="${index % 4 === 0 ? 0.5 : 0.24}"/>`;
  }).join('');
  let svg = `<g data-studio-back="true">${stars}
    <rect x="17" y="17" width="716" height="1016" rx="17" fill="none" stroke="${light}" stroke-opacity=".5" stroke-width="1.5"/>
    <rect x="30" y="30" width="690" height="990" rx="10" fill="none" stroke="${light}" stroke-opacity=".22" stroke-width="1"/>
    <path d="M49 159V49h110M591 49h110v110M701 891v110H591M159 1001H49V891" fill="none" stroke="${light}" stroke-width="3" stroke-opacity=".75"/>
    <path d="m375 89 279 385-279 384L96 474Z" fill="none" stroke="${light}" stroke-width="1" stroke-opacity=".2"/>
    <circle cx="375" cy="449" r="233" fill="none" stroke="${light}" stroke-width="1" stroke-opacity=".2"/>
    <circle cx="375" cy="449" r="213" fill="none" stroke="${light}" stroke-width="1.5" stroke-dasharray="2 15" stroke-opacity=".55"/>
    <ellipse cx="375" cy="449" rx="253" ry="100" transform="rotate(-32 375 449)" fill="none" stroke="${light}" stroke-width="1.5" stroke-opacity=".6"/>
    <ellipse cx="375" cy="449" rx="253" ry="100" transform="rotate(32 375 449)" fill="none" stroke="${light}" stroke-width="1" stroke-opacity=".35"/>
    <circle cx="375" cy="449" r="143" fill="${color}" stroke="${light}" stroke-width="2"/>
    <circle cx="375" cy="449" r="130" fill="none" stroke="${light}" stroke-opacity=".4"/>
    <path d="m375 292 27 128 126 29-126 28-27 129-27-129-126-28 126-29Z" fill="url(#back-metal)" stroke="${light}" stroke-width="1.5"/>
    <path d="m375 351 17 81 80 17-80 17-17 81-17-81-80-17 80-17Z" fill="${color}" stroke="${light}" stroke-width="1"/>
    <circle cx="375" cy="449" r="23" fill="url(#back-metal)"/>
    ${star(375, 130, 18, light)}${star(375, 926, 18, light)}
    <path d="M183 888h150m84 0h150" stroke="${light}" stroke-width="1" stroke-opacity=".55"/>
    ${star(375, 888, 13, light)}
    <rect x="64" y="630" width="622" height="240" rx="9" fill="${color}" fill-opacity=".85"/>`;
  svg += fittedText(label, 78, 638 + Math.max(0, (136 - label.height) / 2), { fill: '#fff4d8', anchor: 'middle', label: 'Back label does not fit' });
  svg += fittedText(sublabel, 84, 792, { fill: light, anchor: 'middle', label: 'Back sublabel does not fit' });
  return { svg: svg + '</g>', overflow: label.overflow || sublabel.overflow };
}

/** Uploaded backs keep exactly the same image transform with and without bleed. */
export function renderBackSvg(input, { bleed = false, guides = false } = {}) {
  const back = input || {};
  const style = ['studio', 'pokemon', 'yugioh', 'custom'].includes(back.style) ? back.style : 'studio';
  const color = safeColor(back.color);
  const margin = bleed ? BLEED : 0;
  const outside = { x: -margin, y: -margin, width: WIDTH + margin * 2, height: HEIGHT + margin * 2 };
  const trim = { x: 0, y: 0, width: WIDTH, height: HEIGHT };
  const studio = style === 'studio' ? studioBack(back, color) : null;
  const hasArt = safeRaster(back.art);
  const missing = style !== 'studio' && !hasArt;
  let svg = svgOpen(bleed, `role="img" aria-labelledby="back-title back-description" data-back-style="${style}" data-overflow="${studio?.overflow || false}" data-missing-art="${missing}"`);
  svg += `<title id="back-title">${escapeXml(style === 'studio' ? text(back.label) || 'STARFALL' : 'Custom trading card back')}</title>
    <desc id="back-description">${missing ? 'Upload back artwork. Only embedded PNG, JPEG, or WebP rasters are accepted; no official artwork is bundled.' : studio?.overflow ? 'Back text does not fit. Shorten it before printing.' : 'An original card back with a fixed trim layout and optional extended bleed.'}</desc>
    <defs>
      <linearGradient id="back-field" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="750" y2="1050"><stop stop-color="${mixColor(color, 0, 0.45)}"/><stop offset=".48" stop-color="${color}"/><stop offset="1" stop-color="${mixColor(color, 0, 0.35)}"/></linearGradient>
      <linearGradient id="back-metal" x2="1" y2="1"><stop stop-color="#f6e5bb"/><stop offset=".5" stop-color="#fff4d8"/><stop offset="1" stop-color="${mixColor(color, 255, 0.45)}"/></linearGradient>
      <clipPath id="back-window">${rect(outside)}</clipPath>
    </defs>`;
  svg += rect(outside, `fill="${style === 'studio' ? 'url(#back-field)' : color}"`);
  if (studio) svg += studio.svg;
  else if (hasArt) svg += image(back.art, trim, { fit: back.fit, x: back.x, y: back.y, zoom: back.zoom }, 'back-window');
  else {
    svg += `<g data-back-placeholder="true">
      <rect x="49" y="49" width="652" height="952" rx="10" fill="none" stroke="#d4e1e9" stroke-opacity=".55" stroke-width="2" stroke-dasharray="12 10"/>
      <rect x="290" y="307" width="170" height="140" rx="12" fill="none" stroke="#e2eaf0" stroke-width="3"/>
      <circle cx="334" cy="350" r="15" fill="#e2eaf0"/>
      <path d="m304 427 45-44 31 27 35-48 31 65M375 485v-45m-16 16 16-16 16 16" fill="none" stroke="#e2eaf0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      ${textLines(['Upload back artwork'], 375, 535, 38, { fill: '#f5f2e7', weight: 700, anchor: 'middle' })}
      ${textLines(['Choose your own PNG, JPEG or WebP.', 'No artwork is bundled for this option.'], 375, 600, 23, { fill: '#d4e1e9', anchor: 'middle', lineHeight: 35 })}
    </g>`;
  }
  if (guides) svg += guidesSvg();
  return svg + '</svg>';
}

export function svgDataUrl(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(String(svg))}`;
}
