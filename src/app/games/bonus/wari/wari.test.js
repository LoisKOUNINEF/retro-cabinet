import { CAPTURE_MS, SOW_MS, WariRound, wariGame } from '#root/dist/src/app/games/bonus/wari/wari.js';
import { AI_DELAY_MS } from '#root/dist/src/app/games/bonus/turns.js';
import { NO_CAPTURE_LIMIT } from '#root/dist/src/app/games/bonus/wari/rules.js';

// Easy with random() = 0 always sows its first legal pit.
const round = (options = {}) => new WariRound({ difficulty: 'easy', aiFirst: false, random: () => 0, ...options });
// The player's turn in a position: their pits 0–5 and the AI's 6–11, given as { pit: seeds }.
const position = (seeds, { stores = { player: 0, ai: 0 }, sinceCapture = 0 } = {}) => ({
  pits: Array.from({ length: 12 }, (_, pit) => seeds[pit] ?? 0),
  stores,
  turn: 'player',
  sinceCapture,
  ending: null,
});
const from = (state) => {
  const game = round();
  game.state = state;
  return game;
};
const again = ' Press Enter or New round to play again.';

describe('Wari', () => {
  it('sows the player\'s seeds one at a time, then lets the AI think and sow its own', () => {
    const game = round();
    expect(game.status).toBe('Your turn: pick a pit.');
    expect(game.legal).toEqual([0, 1, 2, 3, 4, 5]);
    expect(game.nextTickIn()).toBe(null);

    game.select(0);
    expect(game.phase).toBe('sowing');
    expect(game.locked).toBe(true);
    expect(game.legal).toEqual([]);
    expect(game.status).toBe('Sowing…');
    expect(game.nextTickIn()).toBe(SOW_MS);
    expect(game.pits.slice(0, 6)).toEqual([0, 4, 4, 4, 4, 4]);
    expect(game.lastSown).toBe(null);

    game.tick(SOW_MS);
    expect(game.pits.slice(0, 6)).toEqual([0, 5, 4, 4, 4, 4]);
    expect(game.lastSown).toBe(1);
    [1, 2, 3].forEach(() => game.tick(SOW_MS));
    expect(game.phase).toBe('thinking');
    expect(game.status).toBe('Thinking…');
    expect(game.nextTickIn()).toBe(AI_DELAY_MS);
    expect(game.state.turn).toBe('ai');

    game.tick(AI_DELAY_MS);
    expect(game.phase).toBe('sowing');
    // A long wait runs every step it covers.
    game.tick(4 * SOW_MS);
    expect(game.phase).toBe('idle');
    expect(game.pits).toEqual([0, 5, 5, 5, 5, 4, 0, 5, 5, 5, 5, 4]);
    expect(game.status).toBe('Your turn: pick a pit.');
  });

  it('shows the captured pits before they empty into the store', () => {
    const game = from(position({ 5: 3, 6: 1, 7: 2, 8: 1, 11: 4 }));
    game.select(5);
    game.tick(3 * SOW_MS);
    expect(game.phase).toBe('capturing');
    expect(game.capturing).toEqual([8, 7, 6]);
    expect(game.pits.slice(6, 9)).toEqual([2, 3, 2]);
    expect(game.state.stores.player).toBe(0);
    expect(game.nextTickIn()).toBe(CAPTURE_MS);

    game.tick(CAPTURE_MS);
    expect(game.capturing).toEqual([]);
    expect(game.pits.slice(6, 9)).toEqual([0, 0, 0]);
    expect(game.status).toBe('You take 7. Thinking…');
    expect(game.stats()).toEqual([{ key: 'you', label: 'You', value: 7 }, { key: 'ai', label: 'Opponent', value: 0 }]);
  });

  it('ends on a store past half the seeds, then takes no more moves', () => {
    const game = from(position({ 5: 1, 6: 1, 9: 3 }, { stores: { player: 23, ai: 18 } }));
    game.select(5);
    game.tick(SOW_MS + CAPTURE_MS);
    expect(game.isOver).toBe(true);
    expect(game.outcome).toBe('wins');
    expect(game.status).toBe(`You take 2. You win 25 to 18!${again}`);
    expect(game.nextTickIn()).toBe(null);
    expect(game.legal).toEqual([]);
  });

  it('says why a game stopped short: no capture for too long', () => {
    const game = from(position({ 0: 1, 1: 5, 8: 2 }, { stores: { player: 20, ai: 20 }, sinceCapture: NO_CAPTURE_LIMIT - 1 }));
    game.select(0);
    game.tick(SOW_MS);
    expect(game.outcome).toBe('wins');
    expect(game.status).toBe(`No capture in ${NO_CAPTURE_LIMIT} moves: each side keeps its seeds. You win 26 to 22!${again}`);
  });

  it('tells a grand slam took nothing, and an empty opponent must be fed', () => {
    const slam = from(position({ 4: 1, 5: 2, 6: 1, 7: 1 }));
    slam.select(5);
    slam.tick(2 * SOW_MS);
    expect(slam.status).toBe('That would take every seed: nothing taken. Thinking…');

    const starving = from(position({ 0: 1, 5: 1 }));
    expect(starving.status).toBe('Your turn: give your opponent seeds.');
    expect(starving.legal).toEqual([5]);
    starving.select(0);
    expect(starving.phase).toBe('idle');
  });

  it('lets the AI open when chosen', () => {
    const game = round({ aiFirst: true });
    expect(game.locked).toBe(true);
    expect(game.status).toBe('Thinking…');
    expect(game.nextTickIn()).toBe(AI_DELAY_MS);
    game.select(0);
    expect(game.phase).toBe('thinking');
  });

  it('sows with 1–6, or the arrows and Enter', () => {
    const game = round();
    expect(game.handleKey('Digit3')).toBe(true);
    expect(game.cursor).toBe(2);
    expect(game.phase).toBe('sowing');

    const keyed = round();
    Array.from({ length: 8 }, () => keyed.handleKey('ArrowRight'));
    expect(keyed.cursor).toBe(5);
    keyed.handleKey('ArrowLeft');
    keyed.handleKey('Enter');
    expect(keyed.pits[4]).toBe(0);
    expect(keyed.handleKey('Digit7')).toBe(false);
    expect(keyed.handleKey('KeyA')).toBe(false);
  });

  it('is defined for the BonusGameView, tallied per difficulty', () => {
    expect(wariGame.id).toBe('wari');
    expect(wariGame.results.key({ difficulty: 'hard', first: 'ai' })).toBe('hard');
    const game = wariGame.create({ difficulty: 'hard', first: 'you' }, () => 0);
    expect(wariGame.board.config(game, true)).toEqual({
      pits: Array(12).fill(4),
      stores: { player: 0, ai: 0 },
      legal: Array(6).fill(true),
      lastSown: null,
      capturing: [],
      cursor: 0,
      turn: 'player',
    });
    game.select(0);
    game.tick(SOW_MS);
    const sowing = wariGame.board.config(game, true);
    expect(sowing.legal).toEqual(Array(6).fill(false));
    expect(sowing.lastSown).toBe(1);
    expect(wariGame.create({ first: 'ai' }, () => 0).locked).toBe(true);
  });
});
