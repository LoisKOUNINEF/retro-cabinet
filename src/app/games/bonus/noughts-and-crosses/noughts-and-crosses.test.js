import { AI_DELAY_MS, NoughtsCrosses, noughtsCrossesGame } from '#root/dist/src/app/games/bonus/noughts-and-crosses/noughts-and-crosses.js';

const round = (options = {}) => new NoughtsCrosses({ playerMark: 'X', difficulty: 'easy', aiFirst: false, random: () => 0, ...options });
const marks = (game) => game.game.board.map((mark) => mark ?? '.').join('');

describe('Noughts and crosses round', () => {
  it('waits for the player, then asks for a tick while the AI thinks', () => {
    const game = round();
    expect(game.nextTickIn()).toBe(null);
    expect(game.status).toBe('My turn (X).');

    game.select(4);
    expect(game.nextTickIn()).toBe(AI_DELAY_MS);
    expect(game.status).toBe('Evil Me is thinking…');
    game.select(0);
    expect(marks(game)).toBe('....X....');

    game.tick(AI_DELAY_MS / 2);
    expect(marks(game)).toBe('....X....');
    game.tick(AI_DELAY_MS / 2);
    // Easy with random() = 0: the first free cell.
    expect(marks(game)).toBe('O...X....');
    expect(game.nextTickIn()).toBe(null);
  });

  it('lets the AI open when it plays first', () => {
    const game = round({ aiFirst: true, playerMark: 'O' });
    expect(game.nextTickIn()).toBe(AI_DELAY_MS);
    game.tick(AI_DELAY_MS);
    expect(marks(game)).toBe('X........');
    expect(game.status).toBe('My turn (O).');
  });

  it('moves the cursor with the arrows, plays it with Enter, ignores other keys', () => {
    const game = round();
    expect(game.handleKey('ArrowUp')).toBe(true);
    expect(game.handleKey('ArrowLeft')).toBe(true);
    expect(game.handleKey('ArrowLeft')).toBe(true);
    expect(game.cursor).toBe(0);
    expect(game.handleKey('KeyA')).toBe(false);
    expect(game.handleKey('Enter')).toBe(true);
    expect(marks(game)).toBe('X........');
  });

  it('tells the outcome from the player side', () => {
    const game = round();
    [4, 2, 6].forEach((cell) => {
      game.select(cell);
      game.tick(AI_DELAY_MS);
    });
    expect(game.outcome).toBe('wins');
    expect(game.status).toContain('I win!');
    expect(game.nextTickIn()).toBe(null);
  });

  it('is defined for the BonusGameView, keeping its old storage and tallying per difficulty', () => {
    expect(noughtsCrossesGame.id).toBe('noughts-and-crosses');
    expect(noughtsCrossesGame.storageId).toBe('secret');
    expect(noughtsCrossesGame.results.key({ difficulty: 'hard' })).toBe('hard');
    const game = noughtsCrossesGame.create({ difficulty: 'easy', mark: 'O', first: 'ai' }, () => 0);
    expect(game.playerMark).toBe('O');
    expect(game.nextTickIn()).toBe(AI_DELAY_MS);
    expect(noughtsCrossesGame.board.config(game)).toEqual({ board: Array(9).fill(null), winLine: null, cursor: 4, locked: true });
  });
});
