export const FORMAT = 'card-studio-project';
export const VERSION = 1;
export const STORAGE_KEY = 'cardStudio.project';
export const MAX_CARDS = 100;
export const MAX_PRINT_COPIES = 300;
export const MAX_PROJECT_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const CARD_WIDTH = 2.5;
export const CARD_HEIGHT = 3.5;

const freezeOptions = options => Object.freeze(options.map(option => Object.freeze(option)));

export const TYPES = freezeOptions([
  { id: 'grass', label: 'Grass', color: '#478755' },
  { id: 'fire', label: 'Fire', color: '#c95b3d' },
  { id: 'water', label: 'Water', color: '#397fac' },
  { id: 'lightning', label: 'Lightning', color: '#d2aa32' },
  { id: 'psychic', label: 'Psychic', color: '#8b5aa1' },
  { id: 'fighting', label: 'Fighting', color: '#ad714a' },
  { id: 'darkness', label: 'Darkness', color: '#354650' },
  { id: 'metal', label: 'Metal', color: '#829399' },
  { id: 'dragon', label: 'Dragon', color: '#927b38' },
  { id: 'fairy', label: 'Fairy', color: '#c978a2' },
  { id: 'colorless', label: 'Colorless', color: '#9b968b' },
]);

export const TEMPLATES = freezeOptions([
  { id: 'classic', label: 'Classic', description: 'A framed illustration with room for abilities and moves.' },
  { id: 'full-art', label: 'Full art', description: 'An edge-to-edge illustration with layered details.' },
  { id: 'trainer', label: 'Trainer', description: 'A character, item, or place with a story to tell.' },
  { id: 'energy', label: 'Energy', description: 'A bold, elemental design with a simple focal point.' },
]);

export const RARITIES = freezeOptions([
  { id: 'common', label: 'Common' },
  { id: 'uncommon', label: 'Uncommon' },
  { id: 'rare', label: 'Rare' },
  { id: 'double-rare', label: 'Double rare' },
  { id: 'ultra-rare', label: 'Ultra rare' },
  { id: 'secret', label: 'Secret' },
]);

export const PAPER_SIZES = Object.freeze({
  letter: Object.freeze({ width: 8.5, height: 11, label: 'US Letter' }),
  a4: Object.freeze({ width: 210 / 25.4, height: 297 / 25.4, label: 'A4' }),
});

const TYPE_IDS = TYPES.map(type => type.id);
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const EPSILON = 1e-9;
let idSequence = 0;

export function newId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  idSequence += 1;
  return `card-${Date.now().toString(36)}-${idSequence.toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function assertRecord(value, path) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must be an object.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${path} must be a plain object.`);
  }
}

function ownValue(value, key, path) {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) throw new Error(`${path} is required.`);
  if (!Object.hasOwn(descriptor, 'value')) {
    throw new Error(`${path} must be a plain data property, not an accessor.`);
  }
  return descriptor.value;
}

function fields(value, path, rules) {
  assertRecord(value, path);
  return Object.fromEntries(Object.entries(rules).map(([key, validate]) => {
    const fieldPath = `${path}.${key}`;
    return [key, validate(ownValue(value, key, fieldPath), fieldPath)];
  }));
}

function text(maxLength, multiline = false) {
  return (value, path) => {
    if (typeof value !== 'string' || value.length > maxLength) {
      throw new Error(`${path} must be text of at most ${maxLength} characters.`);
    }
    const controls = multiline
      ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/
      : /[\u0000-\u001f\u007f-\u009f]/;
    if (controls.test(value)) throw new Error(`${path} contains unsupported control characters.`);
    return value;
  };
}

function number(min, max, integer = false) {
  return (value, path) => {
    if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      throw new Error(`${path} must be ${integer ? 'an integer' : 'a number'} from ${min} to ${max}.`);
    }
    return value;
  };
}

function oneOf(options) {
  return (value, path) => {
    if (!options.includes(value)) throw new Error(`${path} must be one of: ${options.join(', ')}.`);
    return value;
  };
}

function boolean(value, path) {
  if (typeof value !== 'boolean') throw new Error(`${path} must be true or false.`);
  return value;
}

function id(value, path) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) {
    throw new Error(`${path} must be 1-100 letters, digits, underscores, or hyphens.`);
  }
  return value;
}

function color(value, path) {
  if (typeof value !== 'string' || !/^#[a-fA-F0-9]{6}$/.test(value)) {
    throw new Error(`${path} must be a six-digit hex color, such as #223b54.`);
  }
  return value;
}

function arrayOf(validate, min, max) {
  return (value, path) => {
    if (!Array.isArray(value) || value.length < min || value.length > max) {
      throw new Error(`${path} must be an array with ${min}-${max} items.`);
    }
    return Array.from({ length: value.length }, (_, index) => {
      const itemPath = `${path}[${index}]`;
      return validate(ownValue(value, String(index), itemPath), itemPath);
    });
  };
}

function rasterData(value, path) {
  if (typeof value !== 'string') throw new Error(`${path} must be an embedded raster image.`);
  const prefix = /^data:image\/(png|jpeg|webp);base64,/.exec(value);
  if (!prefix) {
    throw new Error(`${path} must be a base64 PNG, JPEG, or WebP data URL; external URLs and SVG are not supported.`);
  }
  const encoded = value.slice(prefix[0].length);
  if (encoded.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) {
    throw new Error(`${path} exceeds the 2 MiB image limit.`);
  }
  if (!encoded.length || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error(`${path} contains invalid base64 image data.`);
  }
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  const lastValue = BASE64.indexOf(encoded[encoded.length - padding - 1]);
  if ((padding === 2 && lastValue % 16 !== 0) || (padding === 1 && lastValue % 4 !== 0)) {
    throw new Error(`${path} contains non-canonical base64 padding.`);
  }
  const byteLength = encoded.length / 4 * 3 - padding;
  if (byteLength > MAX_IMAGE_BYTES) throw new Error(`${path} exceeds the 2 MiB image limit.`);

  // Inspect only the raster signature; browser decoding checks the actual image later.
  const head = [];
  let buffer = 0;
  let bits = 0;
  for (let index = 0; head.length < Math.min(byteLength, 12); index += 1) {
    buffer = (buffer << 6) | BASE64.indexOf(encoded[index]);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      head.push((buffer >> bits) & 255);
    }
  }
  const startsWith = bytes => bytes.every((byte, index) => head[index] === byte);
  const isPng = startsWith([137, 80, 78, 71, 13, 10, 26, 10]);
  const isJpeg = startsWith([255, 216, 255]);
  const isWebp = startsWith([82, 73, 70, 70]) && [87, 69, 66, 80].every((byte, index) => head[index + 8] === byte);
  if (!({ png: isPng, jpeg: isJpeg, webp: isWebp })[prefix[1]]) {
    throw new Error(`${path} does not have the declared raster image signature.`);
  }
  return value;
}

function validateArt(value, path) {
  if (value === null) return null;
  return fields(value, path, {
    data: rasterData,
    width: number(1, 12000, true),
    height: number(1, 12000, true),
    name: text(200),
  });
}

const MOVE_RULES = {
  name: text(60),
  damage: text(8),
  cost: arrayOf(oneOf(TYPE_IDS), 0, 8),
  text: text(700, true),
};

const CARD_RULES = {
  id,
  name: text(70),
  template: oneOf(TEMPLATES.map(template => template.id)),
  type: oneOf(TYPE_IDS),
  hp: text(6),
  stage: text(30),
  evolvesFrom: text(70),
  subtitle: text(120),
  art: validateArt,
  artFit: oneOf(['cover', 'contain']),
  artX: number(0, 100),
  artY: number(0, 100),
  artZoom: number(1, 3),
  abilityName: text(60),
  abilityText: text(700, true),
  moves: arrayOf((value, path) => fields(value, path, MOVE_RULES), 0, 3),
  weakness: oneOf(['', ...TYPE_IDS]),
  weaknessModifier: text(8),
  resistance: oneOf(['', ...TYPE_IDS]),
  resistanceModifier: text(8),
  retreat: number(0, 5, true),
  rarity: oneOf(RARITIES.map(rarity => rarity.id)),
  flavor: text(300, true),
  illustrator: text(70),
  number: text(16),
  setCode: text(16),
  border: oneOf(['gold', 'silver', 'dark']),
  quantity: number(0, 99, true),
};

export function normalizeBackStyle(value, path = 'back.style') {
  // Retired presets were upload-only; keep their artwork and crop as a custom back.
  const style = value === 'pokemon' || value === 'yugioh' ? 'custom' : value;
  return oneOf(['studio', 'custom'])(style, path);
}

const BACK_RULES = {
  style: normalizeBackStyle,
  art: validateArt,
  fit: oneOf(['cover', 'contain']),
  x: number(0, 100),
  y: number(0, 100),
  zoom: number(1, 3),
  label: text(40),
  sublabel: text(80),
  color,
};

const PRINT_RULES = {
  paper: oneOf(Object.keys(PAPER_SIZES)),
  orientation: oneOf(['portrait', 'landscape']),
  bleed: boolean,
  cropMarks: boolean,
  sides: oneOf(['both', 'fronts', 'backs']),
  flip: oneOf(['long-edge', 'short-edge']),
  margin: number(0.125, 0.75),
  offsetX: number(-5, 5),
  offsetY: number(-5, 5),
};

const PACK_RULES = {
  name: text(40),
  subtitle: text(100),
  series: text(40),
  cardCount: number(1, 40, true),
  thickness: number(0.008, 0.03),
  allowance: number(0.0625, 0.5),
  seal: number(0.25, 0.75),
  glue: number(0.25, 0.75),
  color,
  art: validateArt,
  showGuides: boolean,
};

export function createCard(overrides = {}) {
  assertRecord(overrides, 'Card overrides');
  const card = {
    id: newId(),
    name: 'Untitled card',
    template: 'classic',
    type: 'grass',
    hp: '120',
    stage: 'Basic',
    evolvesFrom: '',
    subtitle: 'The woodland companion',
    art: null,
    artFit: 'cover',
    artX: 50,
    artY: 50,
    artZoom: 1,
    abilityName: '',
    abilityText: '',
    moves: [{ name: 'Gentle gust', damage: '30', cost: ['grass', 'colorless'], text: '' }],
    weakness: 'fire',
    weaknessModifier: 'x2',
    resistance: '',
    resistanceModifier: '-30',
    retreat: 1,
    rarity: 'rare',
    flavor: '',
    illustrator: 'Your name',
    number: '001',
    setCode: 'STL',
    border: 'gold',
    quantity: 1,
  };
  for (const key of Object.keys(CARD_RULES)) {
    if (Object.hasOwn(overrides, key)) card[key] = ownValue(overrides, key, `card.${key}`);
  }
  return fields(card, 'card', CARD_RULES);
}

export function createProject() {
  const cards = [
    createCard({
      name: 'Mosswhisker',
      type: 'grass',
      abilityName: 'Canopy shelter',
      abilityText: 'A roof of leaves keeps its smallest friends safe from the storm.',
      moves: [
        { name: 'Leaf lantern', damage: '30', cost: ['grass'], text: 'Tiny lights mark a path through the woods.' },
        { name: 'Rootbound leap', damage: '80', cost: ['grass', 'colorless', 'colorless'], text: '' },
      ],
      flavor: 'It carries a seed from every forest it has called home.',
    }),
    createCard({
      name: 'Cinderwing',
      type: 'fire',
      hp: '110',
      subtitle: 'A spark above the treetops',
      abilityName: 'Kindling sky',
      abilityText: 'Its warm feathers turn cold morning mist into a golden sunrise.',
      moves: [
        { name: 'Ember arc', damage: '40', cost: ['fire', 'colorless'], text: '' },
        { name: 'Sunward spiral', damage: '90', cost: ['fire', 'fire', 'colorless'], text: '' },
      ],
      weakness: 'water',
      flavor: 'At dusk, a flock looks like a constellation that has forgotten to rise.',
      number: '002',
    }),
    createCard({
      name: 'Tidekeeper',
      type: 'water',
      hp: '140',
      subtitle: 'Guardian of the quiet reef',
      abilityName: 'Stillwater watch',
      abilityText: 'It listens for distant waves through the shell it wears on its back.',
      moves: [
        { name: 'Pearl current', damage: '50', cost: ['water', 'colorless'], text: '' },
        { name: 'Harbor swell', damage: '100', cost: ['water', 'water', 'colorless'], text: '' },
      ],
      weakness: 'lightning',
      retreat: 2,
      flavor: 'Lost sailors follow its gentle glow all the way to shore.',
      number: '003',
    }),
  ];
  return {
    format: FORMAT,
    version: VERSION,
    name: 'Starlight collection',
    selectedId: cards[0].id,
    cards,
    back: {
      style: 'studio', art: null, fit: 'cover', x: 50, y: 50, zoom: 1,
      label: 'STARFALL', sublabel: 'TRADING CARD GAME', color: '#223b54',
    },
    print: {
      paper: 'letter', orientation: 'portrait', bleed: false, cropMarks: true,
      sides: 'both', flip: 'long-edge', margin: 0.25, offsetX: 0, offsetY: 0,
    },
    pack: {
      name: 'STARFALL', subtitle: 'A LITTLE WORLD. A BIG DISCOVERY.', series: 'FIRST EDITION',
      cardCount: 10, thickness: 0.012, allowance: 0.125, seal: 0.5, glue: 0.375,
      color: '#244c46', art: null, showGuides: true,
    },
  };
}

export function validateProject(value) {
  const project = fields(value, 'project', {
    format: format => {
      if (format !== FORMAT) throw new Error(`Unsupported project format; expected "${FORMAT}".`);
      return FORMAT;
    },
    version: version => {
      if (version !== VERSION) throw new Error(`Unsupported project version; only version ${VERSION} is supported.`);
      return VERSION;
    },
    name: text(80),
    selectedId: id,
    cards: arrayOf((card, path) => fields(card, path, CARD_RULES), 1, MAX_CARDS),
    back: (back, path) => fields(back, path, BACK_RULES),
    print: (settings, path) => fields(settings, path, PRINT_RULES),
    pack: (pack, path) => fields(pack, path, PACK_RULES),
  });
  const ids = new Set(project.cards.map(card => card.id));
  if (ids.size !== project.cards.length) throw new Error('Card IDs must be unique; duplicate card IDs were found.');
  if (!ids.has(project.selectedId)) throw new Error('project.selectedId must identify an existing card.');
  return project;
}

function projectTooLarge() {
  throw new Error('Project exceeds the 20 MiB limit; remove or reduce embedded images.');
}

function assertProjectSize(textValue) {
  if (textValue.length > MAX_PROJECT_BYTES) projectTooLarge();
  let bytes = 0;
  for (let index = 0; index < textValue.length; index += 1) {
    const code = textValue.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff
      && textValue.charCodeAt(index + 1) >= 0xdc00 && textValue.charCodeAt(index + 1) <= 0xdfff) {
      bytes += 4;
      index += 1;
    } else bytes += 3;
    if (bytes > MAX_PROJECT_BYTES) projectTooLarge();
  }
}

export function parseProject(textValue) {
  if (typeof textValue !== 'string') throw new Error('Project JSON must be supplied as text.');
  assertProjectSize(textValue);
  let value;
  try {
    value = JSON.parse(textValue);
  } catch {
    throw new Error('Invalid project JSON. Choose a JSON project exported from Card Studio.');
  }
  return validateProject(value);
}

export function serializeProject(project) {
  const validated = validateProject(project);
  const assets = [...validated.cards.map(card => card.art), validated.back.art, validated.pack.art];
  // Embedded raster URLs are ASCII: reject oversized assets before allocating a large JSON string.
  if (assets.reduce((bytes, asset) => bytes + (asset?.data.length ?? 0), 0) > MAX_PROJECT_BYTES) {
    projectTooLarge();
  }
  const serialized = JSON.stringify(validated, null, 2);
  assertProjectSize(serialized);
  return serialized;
}

export function getSheetLayout(settings) {
  const print = fields(settings, 'print', PRINT_RULES);
  const paper = PAPER_SIZES[print.paper];
  const width = print.orientation === 'landscape' ? paper.height : paper.width;
  const height = print.orientation === 'landscape' ? paper.width : paper.height;
  const bleed = print.bleed ? 0.125 : 0;
  const cellWidth = CARD_WIDTH + 2 * bleed;
  const cellHeight = CARD_HEIGHT + 2 * bleed;
  const columns = Math.floor((width - 2 * print.margin + EPSILON) / cellWidth);
  const rows = Math.floor((height - 2 * print.margin + EPSILON) / cellHeight);
  if (columns < 1 || rows < 1) throw new Error('No cards fit this paper and printable margin.');
  return {
    width, height, columns, rows, capacity: columns * rows, bleed, cellWidth, cellHeight,
    originX: (width - columns * cellWidth) / 2,
    originY: (height - rows * cellHeight) / 2,
  };
}

export function getPrintPages(value) {
  const project = validateProject(value);
  const layout = getSheetLayout(project.print);
  const totalCopies = project.cards.reduce((total, card) => total + card.quantity, 0);
  if (!totalCopies) throw new Error('Choose at least one card copy to print; all quantities are zero.');
  if (totalCopies > MAX_PRINT_COPIES) {
    throw new Error(`Print jobs support at most ${MAX_PRINT_COPIES} copies; reduce the card quantities.`);
  }
  const copies = project.cards.flatMap(card =>
    Array.from({ length: card.quantity }, (_, copy) => ({ card, copy })));
  const sheetCount = Math.ceil(totalCopies / layout.capacity);
  const pages = [];
  const print = project.print;
  const mirrorColumns = (print.orientation === 'portrait') === (print.flip === 'long-edge');
  const offsetX = print.offsetX / 25.4;
  const offsetY = print.offsetY / 25.4;
  for (let sheet = 0; sheet < sheetCount; sheet += 1) {
    const sheetNumber = sheet + 1;
    // Both copy and index are zero-based; index always identifies the original front cell.
    const fronts = copies.slice(sheet * layout.capacity, (sheet + 1) * layout.capacity).map((entry, index) => ({
      ...entry,
      index,
      x: layout.originX + (index % layout.columns) * layout.cellWidth,
      y: layout.originY + Math.floor(index / layout.columns) * layout.cellHeight,
      rotation: 0,
    }));
    if (print.sides !== 'backs') pages.push({ side: 'front', sheetNumber, slots: fronts });
    if (print.sides !== 'fronts') {
      const backs = fronts.map(slot => {
        const x = (mirrorColumns ? layout.width - slot.x - layout.cellWidth : slot.x) + offsetX;
        const y = (mirrorColumns ? slot.y : layout.height - slot.y - layout.cellHeight) + offsetY;
        if (x < print.margin - EPSILON || y < print.margin - EPSILON
          || x + layout.cellWidth > layout.width - print.margin + EPSILON
          || y + layout.cellHeight > layout.height - print.margin + EPSILON) {
          throw new Error(`Back on sheet ${sheetNumber}, slot ${slot.index + 1} exceeds the printable margin including bleed. Reduce the alignment offsets or change the layout.`);
        }
        return { ...slot, x, y, rotation: mirrorColumns ? 0 : 180 };
      });
      pages.push({ side: 'back', sheetNumber, slots: backs });
    }
  }
  return { layout, pages, totalCopies, sheetCount };
}

export function getPackLayout(value) {
  const pack = fields(value, 'pack', PACK_RULES);
  const bodyWidth = CARD_WIDTH + pack.allowance;
  const bodyHeight = CARD_HEIGHT + pack.allowance;
  const depth = pack.cardCount * pack.thickness + pack.allowance;
  const width = pack.glue + 2 * bodyWidth + 2 * depth;
  const height = bodyHeight + 2 * pack.seal;
  const panels = [
    { id: 'glue', x: 0, width: pack.glue },
    { id: 'back', x: pack.glue, width: bodyWidth },
    { id: 'side-left', x: pack.glue + bodyWidth, width: depth },
    { id: 'front', x: pack.glue + bodyWidth + depth, width: bodyWidth },
    { id: 'side-right', x: pack.glue + 2 * bodyWidth + depth, width: depth },
  ];
  return {
    width, height, bodyWidth, bodyHeight, depth, seal: pack.seal, glue: pack.glue,
    panels, folds: panels.slice(1).map(panel => panel.x), bodyY: pack.seal,
  };
}

export function getImageDpi(art, widthInches, heightInches, fit = 'cover', zoom = 1) {
  if (art === null) return null;
  const image = validateArt(art, 'art');
  for (const [name, value] of Object.entries({ widthInches, heightInches })) {
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number of inches.`);
  }
  oneOf(['cover', 'contain'])(fit, 'fit');
  number(1, 3)(zoom, 'zoom');
  const ratios = [image.width / widthInches, image.height / heightInches];
  return Math.floor((fit === 'cover' ? Math.min(...ratios) : Math.max(...ratios)) / zoom);
}
