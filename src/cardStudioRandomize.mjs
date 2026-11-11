import { TYPES } from './cardStudioModel.mjs';

const ELEMENT_WORDS = {
  grass: ['Canopy', 'Bramble', 'Petal'],
  fire: ['Ember', 'Cinder', 'Blaze'],
  water: ['Tidal', 'Coral', 'Ripple'],
  lightning: ['Static', 'Storm', 'Spark'],
  psychic: ['Dream', 'Astral', 'Mind'],
  fighting: ['Granite', 'Boulder', 'Summit'],
  darkness: ['Shadow', 'Midnight', 'Dusk'],
  metal: ['Iron', 'Steel', 'Chrome'],
  dragon: ['Ancient', 'Drake', 'Mythic'],
  fairy: ['Moonlit', 'Glimmer', 'Starlight'],
  colorless: ['Cloud', 'Breeze', 'Echo'],
};

const STAGES = ['Basic', 'Stage 1', 'Stage 2'];
const ABILITIES = [
  { name: 'shelter', text: 'This card takes 10 less damage from attacks.' },
  { name: 'renewal', text: 'Once per turn, heal 10 HP from this card.' },
  { name: 'insight', text: 'When you play this card, draw a card.' },
  { name: 'rally', text: 'Your next attack deals 10 more damage.' },
  { name: 'reserve', text: 'Once per turn, move an energy to this card.' },
  { name: 'trail', text: "Once per turn, peek at your deck's top card." },
];
const MOVES = [
  { name: 'rush', text: 'You may switch this card with an ally.' },
  { name: 'pulse', text: 'Heal 10 HP from this card.' },
  { name: 'burst', text: 'Discard an energy from this card.' },
  { name: 'feint', text: 'Ignore resistance for this attack.' },
  { name: 'spiral', text: 'Draw a card, then discard a card.' },
  { name: 'echo', text: 'Flip a coin. On heads, deal 20 more damage.' },
];
const FLAVORS = [
  'It gathers small wonders and leaves them where a friend will find them.',
  'Travelers follow its quiet song when the familiar paths disappear.',
  'Every new dawn brings another adventure worth sharing.',
  'It remembers the kindness of strangers long after their footprints fade.',
  'An unexpected companion, it always arrives when courage is running low.',
  'Legends begin wherever its wandering footsteps come to rest.',
];

export function randomizeCards(cards, random = Math.random) {
  const pick = options => options[Math.floor(random() * options.length)];
  return cards.map(card => {
    const type = pick(TYPES).id;
    const words = ELEMENT_WORDS[type];
    const stage = pick(STAGES);
    const hp = String((5 + Math.floor(random() * 26)) * 10);
    const ability = pick(ABILITIES);
    const abilityName = `${pick(words)} ${ability.name}`;
    const availableMoves = [...MOVES];
    const moves = Array.from({ length: 1 + Math.floor(random() * 3) }, () => {
      const [move] = availableMoves.splice(Math.floor(random() * availableMoves.length), 1);
      const damage = (1 + Math.floor(random() * 12)) * 10;
      return {
        name: `${pick(words)} ${move.name}`,
        damage: String(damage),
        cost: Array.from({ length: Math.ceil(damage / 40) }, (_, index) => index === 0 ? type : pick([type, 'colorless'])),
        text: move.text,
      };
    });
    return {
      ...card,
      type, hp, stage, abilityName, abilityText: ability.text, moves, flavor: pick(FLAVORS),
    };
  });
}
