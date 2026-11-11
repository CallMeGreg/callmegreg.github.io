import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_CARDS, TYPES, TEMPLATES, createCard, createProject, parseProject, serializeProject } from './cardStudioModel.mjs';
import { randomizeCards } from './cardStudioRandomize.mjs';
import { getCardLayout, renderCardSvg } from './cardStudioRender.mjs';

const RANDOMIZED_FIELDS = ['type', 'hp', 'stage', 'abilityName', 'abilityText', 'moves', 'flavor'];
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlE2awAAAAASUVORK5CYII=';

function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

test('randomizes all seven fields on every card without changing unrelated data or the input', () => {
  const cards = freeze(TEMPLATES.map(({ id: template }, index) => createCard({
    id: `design-${index}`, name: `My design ${index}`, template,
    type: 'dragon', hp: '999', stage: 'Custom stage', evolvesFrom: 'Ancestor',
    subtitle: 'My subtitle', abilityName: 'Custom ability', abilityText: 'Custom rules',
    moves: [{ name: 'Custom move', damage: '999', cost: ['dragon'], text: 'Custom effect' }],
    flavor: 'Custom story', quantity: index, rarity: 'secret', border: 'silver',
    illustrator: 'My artist', setCode: 'TEST', number: `0${index}`,
    art: { data: PNG, width: 1, height: 1, name: 'art.png' },
    artFit: 'contain', artX: 25, artY: 75, artZoom: 1.5,
    weakness: 'water', weaknessModifier: 'x3', resistance: 'fire',
    resistanceModifier: '-20', retreat: 4,
  })));
  const before = structuredClone(cards);
  const result = randomizeCards(cards, () => 0);

  assert.notEqual(result, cards);
  assert.equal(result.length, cards.length);
  result.forEach((card, index) => {
    assert.notEqual(card, cards[index]);
    assert.deepEqual(Object.keys(card), Object.keys(cards[index]));
    for (const [field, value] of Object.entries(cards[index])) {
      if (RANDOMIZED_FIELDS.includes(field)) assert.notDeepEqual(card[field], value, field);
      else assert.deepEqual(card[field], value, field);
    }
  });
  assert.deepEqual(cards, before);
});

test('random draws include both endpoints of the supported stats and move counts', () => {
  const card = createCard();
  const [minimum] = randomizeCards([card], () => 0);
  assert.equal(minimum.type, TYPES[0].id);
  assert.equal(minimum.hp, '50');
  assert.equal(minimum.stage, 'Basic');
  assert.equal(minimum.moves.length, 1);
  assert.equal(minimum.moves[0].damage, '10');
  assert.deepEqual(minimum.moves[0].cost, ['grass']);

  const [maximum] = randomizeCards([card], () => 1 - Number.EPSILON);
  assert.equal(maximum.type, TYPES.at(-1).id);
  assert.equal(maximum.hp, '300');
  assert.equal(maximum.stage, 'Stage 2');
  assert.equal(maximum.moves.length, 3);
  assert.equal(new Set(maximum.moves.map(move => move.name)).size, 3);
  for (const move of maximum.moves) {
    assert.equal(move.damage, '120');
    assert.deepEqual(move.cost, ['colorless', 'colorless', 'colorless']);
  }
});

test('a full collection gets varied, valid, portable results while retaining project settings', () => {
  const project = createProject();
  project.cards = Array.from({ length: MAX_CARDS }, (_, index) => createCard({
    id: `card-${index}`, template: TEMPLATES[index % TEMPLATES.length].id,
    moves: [], quantity: index % 4,
  }));
  project.selectedId = project.cards.at(-1).id;
  project.back.label = 'MY COLLECTION';
  project.print.paper = 'a4';
  project.pack.cardCount = 20;
  const result = { ...project, cards: randomizeCards(project.cards, seededRandom(42)) };

  assert.deepEqual(parseProject(serializeProject(result)), result);
  assert.deepEqual({ ...result, cards: project.cards }, project);
  assert.equal(result.cards.length, MAX_CARDS);
  assert.deepEqual(new Set(result.cards.map(card => card.type)), new Set(TYPES.map(type => type.id)));
  assert.deepEqual(new Set(result.cards.map(card => card.stage)), new Set(['Basic', 'Stage 1', 'Stage 2']));
  assert.deepEqual(new Set(result.cards.map(card => card.moves.length)), new Set([1, 2, 3]));
  for (const field of RANDOMIZED_FIELDS) {
    assert.ok(new Set(result.cards.map(card => JSON.stringify(card[field]))).size > 1, field);
  }
  for (const card of result.cards) {
    assert.ok(Number(card.hp) >= 50 && Number(card.hp) <= 300);
    assert.equal(Number(card.hp) % 10, 0);
    assert.ok(card.abilityName && card.abilityText && card.flavor);
    assert.equal(new Set(card.moves.map(move => move.name)).size, card.moves.length);
    for (const move of card.moves) {
      assert.ok(move.name && move.text);
      assert.ok(Number(move.damage) >= 10 && Number(move.damage) <= 120);
      assert.equal(Number(move.damage) % 10, 0);
      assert.equal(move.cost.length, Math.ceil(Number(move.damage) / 40));
      assert.equal(move.cost[0], card.type);
      assert.ok(move.cost.every(type => type === card.type || type === 'colorless'));
    }
    assert.equal(getCardLayout(card).overflow, false, JSON.stringify(card));
  }
});

test('all elements and layouts can render a randomized ability, three moves, and flavor text', () => {
  for (const { id: template } of TEMPLATES) {
    TYPES.forEach(({ id: type }, index) => {
      let draws = 0;
      const [card] = randomizeCards([createCard({ template })],
        () => draws++ === 0 ? (index + 0.5) / TYPES.length : 1 - Number.EPSILON);
      assert.equal(card.type, type);
      assert.equal(card.moves.length, 3);
      const layout = getCardLayout(card);
      assert.equal(layout.overflow, false, `${template}/${type}: ${layout.warnings.join(' ')}`);
      const svg = renderCardSvg(card);
      assert.match(svg, /data-overflow="false"/);
      assert.doesNotMatch(svg, /NaN|undefined/);
    });
  }
});

test('repeated randomization creates independent moves and costs without mutating earlier results', () => {
  const card = createCard();
  const first = randomizeCards([card, card], () => 0);
  const snapshot = structuredClone(first);
  const second = randomizeCards(first, seededRandom(123));
  assert.deepEqual(first, snapshot);
  assert.notDeepEqual(second, first);
  assert.notEqual(first[0].moves, first[1].moves);
  assert.notEqual(first[0].moves[0], first[1].moves[0]);
  assert.notEqual(first[0].moves[0].cost, first[1].moves[0].cost);
  first[0].moves[0].name = 'Edited';
  first[0].moves[0].cost.push('fire');
  assert.deepEqual(first[1], snapshot[1]);
  assert.deepEqual(randomizeCards([card], seededRandom(7)), randomizeCards([card], seededRandom(7)));
});
