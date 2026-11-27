import { NO_CAPTURE_LIMIT, TO_WIN, initialState, legalMoves, play, resultOf, seedsOn, sow } from '#root/dist/src/app/games/bonus/wari/rules.js';

// A position: the player's pits 0–5 then the AI's 6–11, given as { pit: seeds }.
const position = (seeds, { stores = { player: 0, ai: 0 }, turn = 'player', sinceCapture = 0 } = {}) => ({
  pits: Array.from({ length: 12 }, (_, pit) => seeds[pit] ?? 0),
  stores,
  turn,
  sinceCapture,
  ending: null,
});

describe('Wari rules', () => {
  it('starts with four seeds in each pit, the first side free to sow any', () => {
    const state = initialState('ai');
    expect(state.pits).toEqual(Array(12).fill(4));
    expect(state.stores).toEqual({ player: 0, ai: 0 });
    expect(legalMoves(state)).toEqual([6, 7, 8, 9, 10, 11]);
    expect(legalMoves(initialState('player'))).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('sows anticlockwise, one seed a pit, skipping the starting pit on a full lap', () => {
    expect(sow(initialState('player').pits, 0)).toEqual([1, 2, 3, 4]);
    expect(sow(position({ 10: 4 }).pits, 10)).toEqual([11, 0, 1, 2]);
    expect(sow(position({ 0: 12 }).pits, 0)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 1]);
  });

  it('takes the last pit sown on the opponent\'s side with 2 or 3, and the unbroken run before it', () => {
    const state = position({ 5: 3, 6: 1, 7: 2, 8: 1, 11: 4 });
    const move = play(state, 5);
    expect(move.path).toEqual([6, 7, 8]);
    expect(move.captured).toEqual([8, 7, 6]);
    expect(move.taken).toBe(7);
    expect(move.state.stores).toEqual({ player: 7, ai: 0 });
    expect(move.state.pits.slice(6)).toEqual([0, 0, 0, 0, 0, 4]);
    expect(move.state.turn).toBe('ai');
    expect(move.state.sinceCapture).toBe(0);

    // A 4 breaks the run.
    expect(play(position({ 5: 3, 6: 1, 7: 3, 8: 1, 11: 4 }), 5).captured).toEqual([8]);
    // Nothing taken on the mover's own side, nor from a pit left with 1 or 4+.
    expect(play(position({ 0: 1, 1: 1, 9: 1 }), 0).taken).toBe(0);
    expect(play(position({ 5: 1, 6: 3, 9: 1 }), 5).taken).toBe(0);
  });

  it('takes nothing from a move that would take every seed the opponent has (grand slam)', () => {
    const move = play(position({ 4: 1, 5: 2, 6: 1, 7: 1 }), 5);
    expect(move.grandSlam).toBe(true);
    expect(move.taken).toBe(0);
    expect(move.state.pits[6]).toBe(2);
    expect(move.state.pits[7]).toBe(2);
    expect(move.state.sinceCapture).toBe(1);
  });

  it('only lets a side sow a pit giving seeds to an opponent who has none', () => {
    expect(legalMoves(position({ 0: 1, 3: 2, 5: 1 }))).toEqual([5]);
    expect(legalMoves(position({ 0: 1, 3: 3, 5: 1 }))).toEqual([3, 5]);
    expect(legalMoves(position({ 6: 1, 11: 1, 2: 1 }, { turn: 'ai' }))).toEqual([6, 11]);
  });

  it('ends when the side to move can\'t feed its opponent: each side keeps its own seeds', () => {
    // The player's last seed makes 2 in the AI's only pit: a grand slam, nothing taken.
    // The AI must then feed the player, but its 2 seeds don't reach.
    const move = play(position({ 5: 1, 6: 1 }, { stores: { player: 23, ai: 23 } }), 5);
    expect(move.state.ending).toBe('starved');
    expect(move.state.stores).toEqual({ player: 23, ai: 25 });
    expect(move.state.pits).toEqual(Array(12).fill(0));
    expect(legalMoves(move.state)).toEqual([]);
    expect(resultOf(move.state)).toBe('ai');
  });

  it('is won past half the seeds, the rest staying on the board', () => {
    const move = play(position({ 5: 1, 6: 1, 9: 3 }, { stores: { player: TO_WIN - 2, ai: 18 } }), 5);
    expect(move.state.ending).toBe('won');
    expect(move.state.stores.player).toBe(TO_WIN);
    expect(seedsOn(move.state.pits, 'ai')).toBe(3);
    expect(resultOf(move.state)).toBe('player');
    expect(legalMoves(move.state)).toEqual([]);
  });

  it('stops after too many moves without a capture, each side keeping its seeds', () => {
    const state = position({ 0: 1, 1: 5, 8: 2 }, { stores: { player: 20, ai: 20 }, sinceCapture: NO_CAPTURE_LIMIT - 1 });
    const move = play(state, 0);
    expect(move.state.ending).toBe('stalled');
    expect(move.state.stores).toEqual({ player: 26, ai: 22 });
    expect(resultOf(move.state)).toBe('player');

    expect(play({ ...state, sinceCapture: NO_CAPTURE_LIMIT - 2 }, 0).state.ending).toBe(null);
  });

  it('scores a game still going as null, and equal stores as a draw', () => {
    expect(resultOf(initialState('player'))).toBe(null);
    expect(resultOf({ ...position({}, { stores: { player: 24, ai: 24 } }), ending: 'empty' })).toBe('draw');
  });
});
