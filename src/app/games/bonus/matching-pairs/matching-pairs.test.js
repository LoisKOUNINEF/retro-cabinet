import { MATCHING_PAIRS_OPTIONS, MatchingPairs, matchingPairsGame } from '#root/dist/src/app/games/bonus/matching-pairs/matching-pairs.js';
import { FACES } from '#root/dist/src/app/games/bonus/matching-pairs/faces.js';
import { defaultSettings } from '#root/dist/src/app/games/game.js';

// The default reveal time.
const REVEAL_MS = 1000;
const deal = (options = {}) => new MatchingPairs({ cards: 12, tries: null, revealMs: REVEAL_MS, random: () => 0.3, ...options });
// The two indexes of the pair holding face `face`.
const pairOf = (game, face) => game.cards.flatMap((card, index) => (card.face === face ? [index] : []));
// Two indexes of different faces.
const mismatch = (game) => {
  const first = game.cards.findIndex((card) => card.state === 'hidden');
  const second = game.cards.findIndex((card, i) => card.state === 'hidden' && card.face !== game.cards[first].face && i !== first);
  return [first, second];
};
const states = (game) => game.cards.map((card) => card.state[0]).join('');

describe('Matching Pairs', () => {
  it('defaults to 16 cards, unlimited tries and a 1 s reveal', () => {
    expect(defaultSettings(MATCHING_PAIRS_OPTIONS)).toEqual({ cards: '16', tries: 'unlimited', reveal: '1000' });
  });

  it('deals pairs of distinct faces, enough for every deck size', () => {
    expect(FACES.length).toBeGreaterThan(11);
    [12, 16, 20, 24].forEach((cards) => {
      const game = deal({ cards, random: Math.random });
      expect(game.cards.length).toBe(cards);
      const counts = {};
      game.cards.forEach(({ face }) => (counts[face] = (counts[face] ?? 0) + 1));
      expect(Object.keys(counts).length).toBe(cards / 2);
      expect(Object.values(counts).every((count) => count === 2)).toBeTruthy();
    });
    expect([12, 16, 20, 24].map((cards) => deal({ cards }).columns)).toEqual([4, 4, 5, 6]);
  });

  it('keeps a matching pair face up', () => {
    const game = deal();
    const [a, b] = pairOf(game, game.cards[0].face);
    game.select(a);
    expect(game.status).toBe('Find its pair.');
    game.select(b);
    expect(game.cards[a].state).toBe('found');
    expect(game.cards[b].state).toBe('found');
    expect(game.pairsFound).toBe(1);
    expect(game.misses).toBe(0);
    expect(game.nextTickIn()).toBe(null);
  });

  it('turns a mismatched pair back after a while, counting a miss', () => {
    const game = deal();
    const [a, b] = mismatch(game);
    game.select(a);
    game.select(b);
    expect(game.misses).toBe(1);
    expect(game.status).toBe('No match.');
    expect(game.nextTickIn()).toBe(REVEAL_MS);

    game.tick(REVEAL_MS - 1);
    expect(game.cards[a].state).toBe('shown');
    game.tick(1);
    expect(game.cards[a].state).toBe('hidden');
    expect(game.cards[b].state).toBe('hidden');
    expect(game.nextTickIn()).toBe(null);
  });

  it('only turns a mismatched pair back when another card is picked', () => {
    const game = deal();
    const [a, b] = mismatch(game);
    game.select(a);
    game.select(b);
    expect(game.turningBack).toBe(true);
    const c = game.cards.findIndex((card, i) => card.state === 'hidden' && i !== a && i !== b);
    game.select(c);
    expect(game.cards[a].state).toBe('hidden');
    expect(game.cards[b].state).toBe('hidden');
    expect(game.cards[c].state).toBe('hidden');
    expect(game.turningBack).toBe(false);
    expect(game.nextTickIn()).toBe(null);
    // The next pick turns it.
    game.select(c);
    expect(game.cards[c].state).toBe('shown');
  });

  it('turns a mismatched pair back when one of its cards is picked', () => {
    const game = deal();
    const [a, b] = mismatch(game);
    game.select(a);
    game.select(b);
    game.select(a);
    expect(game.cards[a].state).toBe('hidden');
    expect(game.cards[b].state).toBe('hidden');
    expect(game.misses).toBe(1);
  });

  it('keeps a mismatched pair up until a pick with the "Until click" reveal', () => {
    const game = deal({ revealMs: null });
    const [a, b] = mismatch(game);
    game.select(a);
    game.select(b);
    expect(game.nextTickIn()).toBe(null);
    expect(game.status).toBe('No match. Pick any card to turn them back.');
    game.tick(60_000);
    expect(game.cards[a].state).toBe('shown');
    game.select(b);
    expect(game.cards[a].state).toBe('hidden');
    expect(game.status).toBe('Find the pairs.');
  });

  it('ignores a card picked twice, and face-up cards', () => {
    const game = deal();
    game.select(0);
    game.select(0);
    expect(game.misses).toBe(0);
    expect(game.pairsFound).toBe(0);
    expect(states(game).split('s').length - 1).toBe(1);
  });

  it('wins once every pair is found', () => {
    const game = deal();
    const faces = [...new Set(game.cards.map((card) => card.face))];
    faces.forEach((face) => pairOf(game, face).forEach((index) => game.select(index)));
    expect(game.outcome).toBe('wins');
    expect(game.status).toContain('You found every pair, with 0 misses!');
    expect(game.stats()).toEqual([{ key: 'pairs', label: 'Pairs', value: '6/6' }, { key: 'misses', label: 'Misses', value: 0 }]);
  });

  it('loses on the last try, showing where the pairs were', () => {
    const game = deal({ tries: 5 });
    expect(game.stats().at(-1)).toEqual({ key: 'tries', label: 'Tries left', value: 5 });
    for (let miss = 0; miss < 5; miss++) {
      const [a, b] = mismatch(game);
      game.select(a);
      game.select(b);
      if (miss < 4) game.tick(REVEAL_MS);
    }
    expect(game.outcome).toBe('losses');
    expect(game.triesLeft).toBe(0);
    expect(game.status).toContain('Out of tries.');
    expect(game.cards.filter((card) => card.state === 'shown').length).toBe(2);
    expect(game.cards.filter((card) => card.state === 'revealed').length).toBe(10);
    expect(game.nextTickIn()).toBe(null);
    // Over: nothing turns any more.
    const before = states(game);
    game.select(0);
    expect(states(game)).toBe(before);
  });

  it('moves the cursor across the grid, staying on it; Enter turns the card', () => {
    const game = deal({ cards: 20 });
    expect(game.handleKey('ArrowUp')).toBe(true);
    expect(game.handleKey('ArrowLeft')).toBe(true);
    expect(game.cursor).toBe(0);
    game.handleKey('ArrowDown');
    game.handleKey('ArrowRight');
    expect(game.cursor).toBe(6);
    ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight'].forEach((code) => game.handleKey(code));
    expect(game.cursor).toBe(9);
    ['ArrowDown', 'ArrowDown', 'ArrowDown'].forEach((code) => game.handleKey(code));
    expect(game.cursor).toBe(19);
    expect(game.handleKey('KeyA')).toBe(false);
    game.handleKey('Enter');
    expect(game.cards[19].state).toBe('shown');
  });

  it('is defined for the BonusGameView: results per deck and tries, no draws, best = fewest misses', () => {
    expect(matchingPairsGame.id).toBe('matching-pairs');
    expect(matchingPairsGame.results.key({ cards: '24', tries: '10' })).toBe('24-10');
    expect(matchingPairsGame.results.draws).toBe(false);
    const game = matchingPairsGame.create({ cards: '20', tries: '15' }, () => 0.3);
    expect(game.cards.length).toBe(20);
    expect(game.tries).toBe(15);
    expect(matchingPairsGame.create({ cards: '12', tries: 'unlimited' }, () => 0.3).tries).toBe(null);
    expect(game.revealMs).toBe(REVEAL_MS);
    expect(matchingPairsGame.create({ reveal: '2000' }, () => 0.3).revealMs).toBe(2000);
    expect(matchingPairsGame.create({ reveal: 'click' }, () => 0.3).revealMs).toBe(null);
    game.misses = 4;
    expect(matchingPairsGame.results.best.score(game)).toBe(4);
    const config = matchingPairsGame.board.config(game);
    expect(config.columns).toBe(5);
    expect(config.cards.length).toBe(20);
    expect(config.locked).toBe(false);
    expect(config.turningBack).toBe(false);
  });
});
