import { WARI_OPTIONS, choosePit } from '#root/dist/src/app/games/bonus/wari/ai.js';
import { initialState, legalMoves } from '#root/dist/src/app/games/bonus/wari/rules.js';
import { defaultSettings } from '#root/dist/src/app/games/game.js';

// The AI's turn in a position: its pits 6–11 and the player's 0–5, given as { pit: seeds }.
const position = (seeds, stores = { player: 0, ai: 0 }) => ({
  pits: Array.from({ length: 12 }, (_, pit) => seeds[pit] ?? 0),
  stores,
  turn: 'ai',
  sinceCapture: 0,
  ending: null,
});
// Never slips: above MISTAKE_CHANCE, and the last of any random choice.
const steady = () => 0.99;

describe('Wari AI', () => {
  it('defaults to Medium, the player first', () => {
    expect(defaultSettings(WARI_OPTIONS)).toEqual({ difficulty: 'medium', first: 'you' });
  });

  it('Easy sows any legal pit', () => {
    const state = initialState('ai');
    const pits = new Set();
    for (let r = 0; r < 1; r += 0.05) pits.add(choosePit(state, 'easy', () => r));
    expect([...pits].sort((a, b) => a - b)).toEqual(legalMoves(state));
  });

  ['medium', 'hard'].forEach((difficulty) => {
    it(`${difficulty} takes the biggest capture, and the win when it's there`, () => {
      // Pit 11 (1 seed) makes 2 in the player's pit 0; pit 10 (3 seeds) makes 2 there and 3 in pit 1.
      const capture = position({ 0: 1, 1: 2, 4: 4, 10: 3, 11: 1, 7: 1 });
      expect(choosePit(capture, difficulty, steady)).toBe(10);

      const win = position({ 0: 1, 4: 4, 11: 1, 7: 3 }, { player: 10, ai: 23 });
      expect(choosePit(win, difficulty, steady)).toBe(11);
    });
  });

  it('Medium won\'t leave a pit the player takes straight back, when another move is safe', () => {
    // Sowing pit 6 puts its seed in pit 7, which the player's pit 5 (2 seeds) then makes 2 and
    // takes. Sowing pit 8 leaves pit 7 empty: the player's last seed makes only 1 there.
    const state = position({ 5: 2, 6: 1, 8: 1 });
    expect(choosePit(state, 'medium', steady)).toBe(8);
  });

  it('Hard answers the opening with a legal pit, in good time', () => {
    const started = Date.now();
    expect(legalMoves(initialState('ai'))).toContain(choosePit(initialState('ai'), 'hard', steady));
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
