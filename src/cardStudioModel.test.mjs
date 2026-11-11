import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FORMAT, VERSION, STORAGE_KEY, MAX_CARDS, MAX_PRINT_COPIES, MAX_PROJECT_BYTES, MAX_IMAGE_BYTES,
  CARD_WIDTH, CARD_HEIGHT, TYPES, TEMPLATES, RARITIES, PAPER_SIZES,
  newId, createCard, createProject, validateProject, parseProject, serializeProject,
  getSheetLayout, getPrintPages, getPackLayout, getImageDpi,
} from './cardStudioModel.mjs';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlE2awAAAAASUVORK5CYII=';
const clone = value => JSON.parse(JSON.stringify(value));
const art = overrides => ({ data: PNG, width: 1, height: 1, name: 'original.png', ...overrides });

function project(quantities = [1], print = {}) {
  const result = createProject();
  result.cards = quantities.map((quantity, index) => createCard({ id: `card-${index}`, quantity }));
  result.selectedId = result.cards[0]?.id ?? 'missing';
  result.print = { ...result.print, ...print };
  return result;
}

function setPath(value, path, replacement, remove = false) {
  const keys = path.split('.');
  const key = keys.pop();
  const parent = keys.reduce((current, part) => current[part], value);
  if (remove) delete parent[key];
  else parent[key] = replacement;
}

function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} should equal ${expected}`);
}

function sizedPng(size) {
  const bytes = Buffer.alloc(size);
  Buffer.from(PNG.split(',')[1], 'base64').copy(bytes);
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

test('public constants and option IDs match the portable project format', () => {
  assert.equal(FORMAT, 'card-studio-project');
  assert.equal(VERSION, 1);
  assert.equal(STORAGE_KEY, 'cardStudio.project');
  assert.equal(MAX_CARDS, 100);
  assert.equal(MAX_PRINT_COPIES, 300);
  assert.equal(MAX_PROJECT_BYTES, 20 * 1024 * 1024);
  assert.equal(MAX_IMAGE_BYTES, 2 * 1024 * 1024);
  assert.equal(CARD_WIDTH, 2.5);
  assert.equal(CARD_HEIGHT, 3.5);
  assert.deepEqual(TYPES.map(({ id }) => id),
    ['grass', 'fire', 'water', 'lightning', 'psychic', 'fighting', 'darkness', 'metal', 'dragon', 'fairy', 'colorless']);
  assert.deepEqual(TEMPLATES.map(({ id }) => id), ['classic', 'full-art', 'trainer', 'energy']);
  assert.deepEqual(RARITIES.map(({ id }) => id), ['common', 'uncommon', 'rare', 'double-rare', 'ultra-rare', 'secret']);
  for (const type of TYPES) {
    assert.ok(type.label);
    assert.match(type.color, /^#[0-9a-f]{6}$/i);
  }
  for (const template of TEMPLATES) assert.ok(template.label && template.description);
  for (const rarity of RARITIES) assert.ok(rarity.label);
  assert.deepEqual(PAPER_SIZES, {
    letter: { width: 8.5, height: 11, label: 'US Letter' },
    a4: { width: 210 / 25.4, height: 297 / 25.4, label: 'A4' },
  });
});

test('IDs are safe and fresh, and a blank card has the complete default schema', () => {
  const ids = Array.from({ length: 200 }, () => newId());
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-zA-Z0-9_-]{1,100}$/);
  const card = createCard();
  assert.deepEqual(card, {
    id: card.id, name: 'Untitled card', template: 'classic', type: 'grass', hp: '120',
    stage: 'Basic', evolvesFrom: '', subtitle: 'The woodland companion', art: null,
    artFit: 'cover', artX: 50, artY: 50, artZoom: 1, abilityName: '', abilityText: '',
    moves: [{ name: 'Gentle gust', damage: '30', cost: ['grass', 'colorless'], text: '' }],
    weakness: 'fire', weaknessModifier: 'x2', resistance: '', resistanceModifier: '-30',
    retreat: 1, rarity: 'rare', flavor: '', illustrator: 'Your name', number: '001',
    setCode: 'STL', border: 'gold', quantity: 1,
  });
});

test('factories create independent nested state and clone override assets, moves, and costs', () => {
  const first = createCard();
  const second = createCard();
  assert.notEqual(first.id, second.id);
  first.moves[0].cost.push('fire');
  first.moves[0].name = 'Changed';
  assert.deepEqual(second.moves[0].cost, ['grass', 'colorless']);
  assert.equal(second.moves[0].name, 'Gentle gust');
  const overrides = { ...second, id: 'overridden-id', art: art(), ignored: true };
  const copied = createCard(overrides);
  assert.equal(copied.id, 'overridden-id');
  assert.equal(Object.hasOwn(copied, 'ignored'), false);
  copied.art.name = 'changed.png';
  copied.moves[0].cost[0] = 'water';
  assert.equal(overrides.art.name, 'original.png');
  assert.equal(overrides.moves[0].cost[0], 'grass');
  const a = createProject();
  const b = createProject();
  a.cards[0].moves[0].cost.push('water');
  a.back.label = 'OTHER';
  a.print.margin = 0.5;
  a.pack.cardCount = 20;
  assert.equal(b.cards[0].moves[0].cost.length, 1);
  assert.equal(b.back.label, 'STARFALL');
  assert.equal(b.print.margin, 0.25);
  assert.equal(b.pack.cardCount, 10);
  assert.notEqual(a.cards[0].id, b.cards[0].id);
  assert.throws(() => createCard({ quantity: '1' }), /quantity/);
});

test('all starter cards and exact collection defaults validate without repair', () => {
  const initial = createProject();
  assert.deepEqual(initial.cards.map(card => [card.name, card.type, card.art]), [
    ['Mosswhisker', 'grass', null], ['Cinderwing', 'fire', null], ['Tidekeeper', 'water', null],
  ]);
  assert.equal(initial.selectedId, initial.cards[0].id);
  assert.equal(initial.name, 'Starlight collection');
  assert.equal(initial.format, FORMAT);
  assert.equal(initial.version, VERSION);
  assert.deepEqual(initial.back, {
    style: 'studio', art: null, fit: 'cover', x: 50, y: 50, zoom: 1,
    label: 'STARFALL', sublabel: 'TRADING CARD GAME', color: '#223b54',
  });
  assert.deepEqual(initial.print, {
    paper: 'letter', orientation: 'portrait', bleed: false, cropMarks: true, sides: 'both',
    flip: 'long-edge', margin: 0.25, offsetX: 0, offsetY: 0,
  });
  assert.deepEqual(initial.pack, {
    name: 'STARFALL', subtitle: 'A LITTLE WORLD. A BIG DISCOVERY.', series: 'FIRST EDITION',
    cardCount: 10, thickness: 0.012, allowance: 0.125, seal: 0.5, glue: 0.375,
    color: '#244c46', art: null, showGuides: true,
  });
  assert.deepEqual(validateProject(initial), initial);
  assert.match(JSON.stringify(initial), /^[\x20-\x7e]*$/);
});

test('JSON is pretty, portable, and lossless with embedded artwork in every location', () => {
  const input = project();
  input.name = 'A collection \u00e9 \ud83c\udf1f';
  input.cards[0].art = art({ width: 1200, height: 800, name: 'forest.png' });
  input.cards[0].abilityText = 'First line.\nSecond line.\tA detail.';
  input.back.art = art({ width: 700, height: 1100, name: 'back.png' });
  input.pack.art = art({ width: 1600, height: 900, name: 'pack.png' });
  const before = clone(input);
  const serialized = serializeProject(input);
  assert.match(serialized, /\n  "format": "card-studio-project"/);
  assert.ok(serialized.includes(PNG));
  const restored = parseProject(serialized);
  assert.deepEqual(restored, input);
  assert.deepEqual(input, before);
  assert.notEqual(restored.cards, input.cards);
  assert.notEqual(restored.cards[0].art, input.cards[0].art);
  assert.notEqual(restored.cards[0].moves[0].cost, input.cards[0].moves[0].cost);
  assert.notEqual(restored.back.art, input.back.art);
  assert.notEqual(restored.pack.art, input.pack.art);
});

test('validation only copies known fields, without prototype pollution or executing accessors', () => {
  const input = project();
  input.cards[0].art = art();
  for (const record of [input, input.cards[0], input.cards[0].moves[0], input.cards[0].art, input.back, input.print, input.pack]) {
    Object.defineProperty(record, '__proto__', { enumerable: true, value: { polluted: true } });
    record.constructor = { prototype: { polluted: true } };
    record.extra = { ignored: true };
  }
  const sanitized = parseProject(JSON.stringify(input));
  for (const record of [sanitized, sanitized.cards[0], sanitized.cards[0].moves[0], sanitized.cards[0].art,
    sanitized.back, sanitized.print, sanitized.pack]) {
    assert.equal(Object.hasOwn(record, '__proto__'), false);
    assert.equal(Object.hasOwn(record, 'constructor'), false);
    assert.equal(Object.hasOwn(record, 'extra'), false);
    assert.equal(record.polluted, undefined);
    assert.equal(Object.getPrototypeOf(record), Object.prototype);
  }
  assert.equal({}.polluted, undefined);
  let called = false;
  Object.defineProperty(input, 'unknownGetter', { get() { called = true; return 1; } });
  validateProject(input);
  assert.equal(called, false);
  Object.defineProperty(input.cards[0], 'name', { get() { called = true; return 'Injected'; } });
  assert.throws(() => validateProject(input), /accessor/);
  assert.equal(called, false);
  const inherited = project();
  inherited.cards[0] = Object.create(inherited.cards[0]);
  assert.throws(() => validateProject(inherited), /plain object/);
  const nullPrototype = Object.assign(Object.create(null), project());
  assert.deepEqual(validateProject(nullPrototype), { ...nullPrototype });
});

test('all schema fields are required, including nested image and array data', () => {
  const input = project();
  input.cards[0].art = art();
  input.back.art = art();
  input.pack.art = art();
  const paths = [];
  function collect(value, prefix = '') {
    if (!value || typeof value !== 'object') return;
    for (const key of Object.keys(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      paths.push(path);
      collect(value[key], path);
    }
  }
  collect(input);
  for (const path of paths) {
    const changed = clone(input);
    setPath(changed, path, undefined, true);
    assert.throws(() => validateProject(changed), /required/, `missing ${path}`);
  }
});

test('invalid format, versions, JSON, object types, IDs, and selections are rejected', () => {
  for (const value of [null, [], 'project', 4, true]) assert.throws(() => validateProject(value), /object/);
  for (const version of [0, 2, '1', null]) {
    const input = project();
    input.version = version;
    assert.throws(() => parseProject(JSON.stringify(input)), /version/);
  }
  const input = project();
  input.format = 'unrelated-project';
  assert.throws(() => validateProject(input), /format/);
  assert.throws(() => parseProject('{broken'), /Invalid project JSON/);
  assert.throws(() => parseProject(undefined), /text/);
  for (const unsafeId of ['', 'a'.repeat(101), 'has spaces', '../card', '<script>', 'x\n', 'x\r', 'x\u2028', '\u00e9', 7]) {
    const changed = project();
    changed.cards[0].id = unsafeId;
    changed.selectedId = unsafeId;
    assert.throws(() => validateProject(changed), /id/i);
  }
  const boundary = project();
  boundary.cards[0].id = 'a'.repeat(100);
  boundary.selectedId = boundary.cards[0].id;
  validateProject(boundary);
  boundary.cards[0].id = '__proto__';
  boundary.selectedId = '__proto__';
  validateProject(boundary);
  boundary.selectedId = 'absent';
  assert.throws(() => validateProject(boundary), /selectedId/);
  const duplicate = project([1, 1]);
  duplicate.cards[1].id = duplicate.cards[0].id;
  assert.throws(() => validateProject(duplicate), /duplicate/i);
});

test('text lengths are enforced on every bounded text field without silently truncating', () => {
  const limits = {
    name: 80, 'cards.0.name': 70, 'cards.0.stage': 30, 'cards.0.evolvesFrom': 70,
    'cards.0.subtitle': 120, 'cards.0.hp': 6, 'cards.0.abilityName': 60, 'cards.0.abilityText': 700,
    'cards.0.moves.0.name': 60, 'cards.0.moves.0.text': 700, 'cards.0.moves.0.damage': 8,
    'cards.0.flavor': 300, 'cards.0.illustrator': 70, 'cards.0.number': 16, 'cards.0.setCode': 16,
    'cards.0.weaknessModifier': 8, 'cards.0.resistanceModifier': 8,
    'back.label': 40, 'back.sublabel': 80, 'pack.name': 40, 'pack.subtitle': 100, 'pack.series': 40,
    'cards.0.art.name': 200, 'back.art.name': 200, 'pack.art.name': 200,
  };
  for (const [path, limit] of Object.entries(limits)) {
    const input = project();
    input.cards[0].art = art();
    input.back.art = art();
    input.pack.art = art();
    setPath(input, path, 'x'.repeat(limit));
    validateProject(input);
    for (const invalid of ['x'.repeat(limit + 1), 123, null, {}, 'bad\u0000text', 'bad\u007ftext']) {
      setPath(input, path, invalid);
      assert.throws(() => validateProject(input), /text|characters/, path);
    }
  }
  const input = project();
  input.cards[0].name = 'line\nbreak';
  assert.throws(() => validateProject(input), /control/);
});

test('retired back presets restore and export as custom without losing artwork or framing', () => {
  for (const style of ['pokemon', 'yugioh']) {
    for (const artwork of [null, art()]) {
      const input = project();
      input.back = { ...input.back, style, art: artwork, fit: 'contain', x: 17, y: 82, zoom: 1.55 };
      const original = clone(input);
      const expected = { ...original, back: { ...original.back, style: 'custom' } };
      assert.deepEqual(validateProject(input), expected);
      assert.deepEqual(parseProject(JSON.stringify(input)), expected);
      assert.deepEqual(JSON.parse(serializeProject(input)), expected);
      assert.deepEqual(input, original);
    }
  }
});

test('enum options, colors, and booleans are strict and type-safe', () => {
  const enums = {
    'cards.0.type': TYPES.map(type => type.id),
    'cards.0.template': TEMPLATES.map(template => template.id),
    'cards.0.rarity': RARITIES.map(rarity => rarity.id),
    'cards.0.border': ['gold', 'silver', 'dark'],
    'cards.0.weakness': ['', ...TYPES.map(type => type.id)],
    'cards.0.resistance': ['', ...TYPES.map(type => type.id)],
    'cards.0.artFit': ['cover', 'contain'],
    'cards.0.moves.0.cost.0': TYPES.map(type => type.id),
    'back.style': ['studio', 'custom'],
    'back.fit': ['cover', 'contain'],
    'print.paper': ['letter', 'a4'],
    'print.orientation': ['portrait', 'landscape'],
    'print.sides': ['both', 'fronts', 'backs'],
    'print.flip': ['long-edge', 'short-edge'],
  };
  for (const [path, options] of Object.entries(enums)) {
    for (const option of options) {
      const input = project();
      setPath(input, path, option);
      validateProject(input);
    }
    for (const invalid of ['unknown', '__proto__', {}, null, true]) {
      const input = project();
      setPath(input, path, invalid);
      assert.throws(() => validateProject(input), /one of/, path);
    }
  }
  for (const path of ['back.color', 'pack.color']) {
    for (const invalid of ['red', '#fff', '#12345678', '#12GGff', '#123456\n', '#123456\r', '#123456\u2028',
      'url(https://example.test)', null]) {
      const input = project();
      setPath(input, path, invalid);
      assert.throws(() => validateProject(input), /hex color/, path);
    }
  }
  for (const path of ['print.bleed', 'print.cropMarks', 'pack.showGuides']) {
    for (const invalid of ['true', 1, 0, null]) {
      const input = project();
      setPath(input, path, invalid);
      assert.throws(() => validateProject(input), /true or false/, path);
    }
  }
});

test('numeric bounds, integrality, and finite number types are validated everywhere', () => {
  const ranges = [
    ['cards.0.quantity', 0, 99, true], ['cards.0.retreat', 0, 5, true],
    ['cards.0.artX', 0, 100], ['cards.0.artY', 0, 100], ['cards.0.artZoom', 1, 3],
    ['back.x', 0, 100], ['back.y', 0, 100], ['back.zoom', 1, 3],
    ['print.margin', 0.125, 0.75], ['print.offsetX', -5, 5], ['print.offsetY', -5, 5],
    ['pack.cardCount', 1, 40, true], ['pack.thickness', 0.008, 0.03],
    ['pack.allowance', 0.0625, 0.5], ['pack.seal', 0.25, 0.75], ['pack.glue', 0.25, 0.75],
    ...['cards.0.art', 'back.art', 'pack.art'].flatMap(prefix =>
      [[`${prefix}.width`, 1, 12000, true], [`${prefix}.height`, 1, 12000, true]]),
  ];
  for (const [path, min, max, integer] of ranges) {
    const input = project();
    input.cards[0].art = art();
    input.back.art = art();
    input.pack.art = art();
    for (const valid of [min, max, integer ? min + 1 : (min + max) / 2]) {
      setPath(input, path, valid);
      validateProject(input);
    }
    const invalids = [min - 0.0001, max + 0.0001, String(min), null, true, NaN, Infinity, -Infinity];
    if (integer) invalids.push(min + 0.5);
    for (const invalid of invalids) {
      setPath(input, path, invalid);
      assert.throws(() => validateProject(input), /number|integer/, path);
    }
  }
});

test('card, move, and cost arrays enforce their bounds and reject sparse or malformed entries', () => {
  validateProject(project(Array(MAX_CARDS).fill(99)));
  assert.throws(() => validateProject(project([])), /1-100/);
  assert.throws(() => validateProject(project(Array(MAX_CARDS + 1).fill(1))), /1-100/);
  const input = project();
  input.cards[0].moves = [];
  validateProject(input);
  input.cards[0].moves = Array.from({ length: 3 }, () => ({
    name: '', damage: '', text: '', cost: Array(8).fill('water'),
  }));
  validateProject(input);
  input.cards[0].moves[0].cost = [];
  validateProject(input);
  for (const invalid of [Array(9).fill('grass'), 'grass', null, Array(2)]) {
    input.cards[0].moves[0].cost = invalid;
    assert.throws(() => validateProject(input), /cost/);
  }
  for (const invalid of [Array(4).fill({}), {}, null, Array(1), [null]]) {
    input.cards[0].moves = invalid;
    assert.throws(() => validateProject(input), /moves/);
  }
  const sparse = project([1, 1]);
  delete sparse.cards[0];
  assert.throws(() => validateProject(sparse), /required/);
});

test('raster data accepts the three supported signatures and valid base64 padding', () => {
  // Full image decoding is a browser responsibility; these fixtures isolate header validation.
  const signatures = [
    ['png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
    ['jpeg', Buffer.from([255, 216, 255, 224])],
    ['webp', Buffer.from([82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80])],
  ];
  for (const [mime, bytes] of signatures) {
    const input = project();
    input.cards[0].art = art({ data: `data:image/${mime};base64,${bytes.toString('base64')}` });
    assert.deepEqual(validateProject(input), input);
  }
  const input = project();
  input.cards[0].art = art({ data: sizedPng(MAX_IMAGE_BYTES) });
  validateProject(input);
  input.cards[0].art.data = sizedPng(MAX_IMAGE_BYTES + 1);
  assert.throws(() => validateProject(input), /2 MiB/);
});

test('external, active, mismatched, oversized, and malformed image payloads are rejected', () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64');
  const invalid = [
    'https://example.test/image.png', '/local.png', 'javascript:alert(1)',
    `data:image/svg+xml;base64,${svg}`, `data:image/png;base64,${svg}`,
    'data:image/gif;base64,R0lGODlh', 'data:image/jpg;base64,/9j/4A==',
    'data:text/html;base64,PHNjcmlwdD4=', 'data:image/png,<svg/>',
    'data:image/png;charset=utf-8;base64,AAAA', 'data:image/png;base64,',
    'data:image/png;base64,AAAAA', 'data:image/png;base64,A===',
    'data:image/png;base64,AA=A', 'data:image/png;base64,AA==AAAA',
    'data:image/png;base64,!!!!', 'data:image/png;base64,AA-_',
    'data:image/png;base64,AB==', 'data:image/png;base64,AAB=',
    `${PNG}\n`, `${PNG}\u0000`, PNG.replace(/=$/, '\n'), PNG.replace(/=$/, '\r'),
    PNG.replace(/=$/, '\u2028'), PNG.replace('base64,', 'base64, '),
    PNG.replace('png', 'jpeg'), PNG.replace('png', 'webp'), 42, null,
  ];
  for (const data of invalid) {
    const input = project();
    input.cards[0].art = art({ data });
    assert.throws(() => validateProject(input), /data|image|base64/, String(data).slice(0, 60));
  }
  for (const invalidArt of [PNG, [], {}, false]) {
    const input = project();
    input.back.art = invalidArt;
    assert.throws(() => validateProject(input), /art/);
  }
});

test('project size limits count UTF-8 bytes before parsing and include embedded exports', () => {
  assert.throws(() => parseProject(' '.repeat(MAX_PROJECT_BYTES + 1)), /20 MiB/);
  assert.throws(() => parseProject(`"${'\u00e9'.repeat(MAX_PROJECT_BYTES / 2)}"`), /20 MiB/);
  assert.throws(() => parseProject(`"${'\ud83c\udf1f'.repeat(MAX_PROJECT_BYTES / 4)}"`), /20 MiB/);
  const input = project(Array(8).fill(1));
  const data = sizedPng(MAX_IMAGE_BYTES);
  for (const card of input.cards) card.art = art({ data });
  validateProject(input);
  assert.throws(() => serializeProject(input), /20 MiB/);
});

test('Letter portrait is exactly nine 2.5 by 3.5 inch trims with shared no-bleed cut lines', () => {
  const layout = getSheetLayout(project().print);
  assert.deepEqual(layout, {
    width: 8.5, height: 11, columns: 3, rows: 3, capacity: 9, bleed: 0,
    cellWidth: 2.5, cellHeight: 3.5, originX: 0.5, originY: 0.25,
  });
  const { pages } = getPrintPages(project([9], { sides: 'fronts' }));
  assert.equal(pages[0].slots.length, 9);
  close(pages[0].slots[0].x + CARD_WIDTH, pages[0].slots[1].x);
  close(pages[0].slots[0].y + CARD_HEIGHT, pages[0].slots[3].y);
});

test('Letter landscape bleed is six-up, and bleed never scales the trim dimensions', () => {
  const layout = getSheetLayout(project([1], { orientation: 'landscape', bleed: true }).print);
  assert.deepEqual(layout, {
    width: 11, height: 8.5, columns: 3, rows: 2, capacity: 6, bleed: 0.125,
    cellWidth: 2.75, cellHeight: 3.75, originX: 1.375, originY: 0.5,
  });
  for (const paper of ['letter', 'a4']) {
    for (const orientation of ['portrait', 'landscape']) {
      for (const bleed of [false, true]) {
        const current = getSheetLayout(project([1], { paper, orientation, bleed }).print);
        assert.equal(current.cellWidth - 2 * current.bleed, CARD_WIDTH);
        assert.equal(current.cellHeight - 2 * current.bleed, CARD_HEIGHT);
        close(current.originX * 2 + current.columns * current.cellWidth, current.width);
        close(current.originY * 2 + current.rows * current.cellHeight, current.height);
      }
    }
  }
});

test('A4 uses exact metric paper dimensions and the expected capacities in each orientation', () => {
  for (const [orientation, bleed, columns, rows] of [
    ['portrait', false, 3, 3], ['portrait', true, 2, 2],
    ['landscape', false, 4, 2], ['landscape', true, 4, 2],
  ]) {
    const layout = getSheetLayout(project([1], { paper: 'a4', orientation, bleed }).print);
    assert.equal(layout.width, (orientation === 'portrait' ? 210 : 297) / 25.4);
    assert.equal(layout.height, (orientation === 'portrait' ? 297 : 210) / 25.4);
    assert.equal(layout.columns, columns);
    assert.equal(layout.rows, rows);
    assert.equal(layout.capacity, columns * rows);
  }
});

test('printable margins change capacity rather than physical card size, and invalid settings fail', () => {
  for (const [margin, capacity] of [[0.125, 9], [0.25, 9], [0.2501, 6], [0.5, 6], [0.5001, 4], [0.75, 4]]) {
    const layout = getSheetLayout(project([1], { margin }).print);
    assert.equal(layout.capacity, capacity);
    assert.ok(layout.originX >= margin - 1e-9);
    assert.ok(layout.originY >= margin - 1e-9);
    assert.equal(layout.cellWidth, 2.5);
    assert.equal(layout.cellHeight, 3.5);
  }
  assert.throws(() => getSheetLayout(project([1], { margin: 5 }).print), /margin/);
  assert.throws(() => getSheetLayout(project([1], { paper: 'poster' }).print), /paper/);
  assert.throws(() => getSheetLayout(project([1], { bleed: 'false' }).print), /bleed/);
  assert.throws(() => getSheetLayout({ paper: 'letter' }), /required/);
});

for (const orientation of ['portrait', 'landscape']) {
  for (const flip of ['long-edge', 'short-edge']) {
    test(`partial ${orientation} ${flip} backs mirror original slots with correct rotation and millimeter offsets`, () => {
      for (const [offsetX, offsetY] of [[0, 0], [3.2, -2.1], [-3.2, 2.1]]) {
        const input = project([2, 1], { orientation, flip, bleed: true, offsetX, offsetY });
        const { layout, pages, totalCopies, sheetCount } = getPrintPages(input);
        assert.equal(totalCopies, 3);
        assert.equal(sheetCount, 1);
        assert.equal(pages.length, 2);
        const [front, back] = pages;
        assert.deepEqual(front.slots.map(slot => [slot.card.id, slot.copy, slot.index]), [
          ['card-0', 0, 0], ['card-0', 1, 1], ['card-1', 0, 2],
        ]);
        assert.equal(back.slots.length, front.slots.length);
        const mirrorColumns = (orientation === 'portrait') === (flip === 'long-edge');
        for (let index = 0; index < front.slots.length; index += 1) {
          const before = front.slots[index];
          const after = back.slots[index];
          close(before.x, layout.originX + (index % layout.columns) * layout.cellWidth);
          close(before.y, layout.originY + Math.floor(index / layout.columns) * layout.cellHeight);
          assert.equal(before.rotation, 0);
          assert.equal(after.index, before.index);
          assert.equal(after.card.id, before.card.id);
          assert.equal(after.copy, before.copy);
          close(after.x, (mirrorColumns ? layout.width - before.x - layout.cellWidth : before.x) + offsetX / 25.4);
          close(after.y, (mirrorColumns ? before.y : layout.height - before.y - layout.cellHeight) + offsetY / 25.4);
          assert.equal(after.rotation, mirrorColumns ? 0 : 180);
        }
      }
    });
  }
}

test('fronts, backs, and interleaved jobs preserve sheet order, copies, and incomplete-sheet blanks', () => {
  for (const sides of ['fronts', 'backs', 'both']) {
    const input = project([0, 8, 2], { sides });
    input.back.style = 'custom';
    const { pages, totalCopies, sheetCount } = getPrintPages(input);
    assert.equal(totalCopies, 10);
    assert.equal(sheetCount, 2);
    assert.deepEqual(pages.map(page => [page.side, page.sheetNumber]), sides === 'both'
      ? [['front', 1], ['back', 1], ['front', 2], ['back', 2]]
      : [[sides === 'fronts' ? 'front' : 'back', 1], [sides === 'fronts' ? 'front' : 'back', 2]]);
    for (const page of pages) {
      assert.equal(page.slots.length, page.sheetNumber === 1 ? 9 : 1);
      assert.equal(page.slots.some(slot => slot.card.id === 'card-0'), false);
      if (page.sheetNumber === 2) {
        assert.equal(page.slots[0].index, 0);
        assert.equal(page.slots[0].copy, 1);
        assert.equal(page.slots[0].card.id, 'card-2');
        close(page.slots[0].x, page.side === 'front' ? 0.5 : 5.5);
        close(page.slots[0].y, 0.25);
      }
    }
  }
});

test('zero and excessive print jobs fail, but importing high total quantities remains valid', () => {
  assert.throws(() => getPrintPages(project([0, 0])), /at least one|zero/);
  const maximum = project([99, 99, 99, 3]);
  assert.equal(getPrintPages(maximum).totalCopies, MAX_PRINT_COPIES);
  const overflow = project([99, 99, 99, 4]);
  assert.deepEqual(parseProject(serializeProject(overflow)), overflow);
  assert.throws(() => getPrintPages(overflow), /300/);
  assert.equal(getPrintPages(project([0, 1, 0])).totalCopies, 1);
});

test('back preflight catches either offset direction and includes bleed, not just trim', () => {
  for (const offsetY of [-1, 1]) {
    assert.throws(() => getPrintPages(project([9], { offsetY })), /Back.*printable margin/);
    assert.equal(getPrintPages(project([9], { sides: 'fronts', offsetY })).pages.length, 1);
  }
  for (const offsetX of [-3, 3]) {
    assert.throws(() => getPrintPages(project([8], {
      paper: 'a4', orientation: 'landscape', bleed: true, offsetX,
    })), /Back.*printable margin/);
  }
  const input = project([6], { orientation: 'landscape', bleed: true, margin: 0.5, offsetY: 1 });
  const layout = getSheetLayout(input.print);
  const trimBottom = layout.originY + layout.rows * layout.cellHeight - layout.bleed + 1 / 25.4;
  assert.ok(trimBottom < layout.height - input.print.margin);
  assert.throws(() => getPrintPages(input), /including bleed/);
  assert.equal(getPrintPages(project([1], { offsetY: 1 })).pages.length, 2);
});

test('pack panels, folds, stack depth, allowance, and seals form the exact wrapper net', () => {
  const pack = createProject().pack;
  const layout = getPackLayout(pack);
  close(layout.bodyWidth, 2.625);
  close(layout.bodyHeight, 3.625);
  close(layout.depth, 0.245);
  close(layout.width, 6.115);
  close(layout.height, 4.625);
  assert.equal(layout.bodyY, 0.5);
  assert.equal(layout.seal, pack.seal);
  assert.equal(layout.glue, pack.glue);
  assert.deepEqual(layout.panels.map(panel => panel.id), ['glue', 'back', 'side-left', 'front', 'side-right']);
  assert.deepEqual(layout.panels.map(panel => panel.width),
    [pack.glue, layout.bodyWidth, layout.depth, layout.bodyWidth, layout.depth]);
  assert.deepEqual(layout.folds, layout.panels.slice(1).map(panel => panel.x));
  for (let index = 0; index < layout.panels.length; index += 1) {
    const panel = layout.panels[index];
    close(panel.x + panel.width, layout.panels[index + 1]?.x ?? layout.width);
  }
  for (const fold of layout.folds) assert.ok(fold > 0 && fold < layout.width);
  const larger = getPackLayout({ ...pack, cardCount: 40, thickness: 0.03, allowance: 0.5, seal: 0.75, glue: 0.75 });
  close(larger.depth, 1.7);
  close(larger.width, 10.15);
  close(larger.height, 5.5);
  assert.throws(() => getPackLayout({ ...pack, cardCount: 0 }), /cardCount/);
  assert.throws(() => getPackLayout({ ...pack, thickness: NaN }), /thickness/);
});

test('effective image DPI uses the actual window, fit mode, aspect ratio, and zoom', () => {
  assert.equal(getImageDpi(null, 2.5, 3.5), null);
  const wide = art({ width: 2048, height: 1024 });
  assert.equal(getImageDpi(wide, 2.5, 1.75), 585);
  assert.equal(getImageDpi(wide, 2.5, 1.75, 'contain'), 819);
  assert.equal(getImageDpi(wide, 2.5, 1.75, 'cover', 2.5), 234);
  assert.equal(getImageDpi(wide, 2.5, 1.75, 'contain', 2.5), 327);
  const tall = art({ width: 1000, height: 2000 });
  assert.equal(getImageDpi(tall, 2, 2, 'cover', 2), 250);
  assert.equal(getImageDpi(tall, 2, 2, 'contain', 2), 500);
  for (const invalid of [0, -1, NaN, Infinity, '2']) {
    assert.throws(() => getImageDpi(wide, invalid, 1), /widthInches/);
    assert.throws(() => getImageDpi(wide, 1, invalid), /heightInches/);
  }
  assert.throws(() => getImageDpi(wide, 2, 1, 'stretch'), /fit/);
  assert.throws(() => getImageDpi(wide, 2, 1, 'cover', 0), /zoom/);
});
