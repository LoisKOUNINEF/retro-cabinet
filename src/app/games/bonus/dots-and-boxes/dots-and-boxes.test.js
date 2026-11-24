import { CHAIN_DELAY_MS, DotsAndBoxes, dotsAndBoxesGame } from '#root/dist/src/app/games/bonus/dots-and-boxes/dots-and-boxes.js';
import { AI_DELAY_MS } from '#root/dist/src/app/games/bonus/turns.js';

const round = (overrides = {}) => new DotsAndBoxes({ size: 3, difficulty: 'medium', aiFirst: false, random: () => 0.5, ...overrides });

describe('Dots and Boxes round', () => {
  it('passes the turn to the AI, which plays after a moment', () => {
    const game = round();
    expect(game.status).toBe('Your turn.');
    game.select(0);
    expect(game.board.lines[0]).toBe('player');
    expect(game.locked).toBe(true);
    expect(game.status).toBe('Thinking…');
    expect(game.nextTickIn()).toBe(AI_DELAY_MS);
    game.select(1);
    expect(game.board.lines[1]).toBe(null);

    game.tick(AI_DELAY_MS);
    expect(game.board.lines.filter((owner) => owner === 'ai').length).toBe(1);
    expect(game.turn).toBe('player');
    expect(game.nextTickIn()).toBe(null);
  });

  it('plays again after closing a box', () => {
    const game = round();
    [0, 3, 12].forEach((line) => (game.board.lines[line] = 'ai'));
    game.select(13);
    expect(game.board.boxes[0]).toBe('player');
    expect(game.turn).toBe('player');
    expect(game.status).toBe('Box! Play again.');
    expect(game.stats()).toEqual([{ key: 'you', label: 'You', value: 1 }, { key: 'ai', label: 'Opponent', value: 0 }]);
  });

  it('lets the AI go first, and play on quicker after taking a box', () => {
    const game = round({ aiFirst: true });
    expect(game.status).toBe('Thinking…');
    [0, 3, 12].forEach((line) => (game.board.lines[line] = 'player'));
    game.tick(AI_DELAY_MS);
    expect(game.board.boxes[0]).toBe('ai');
    expect(game.lastLine).toBe(13);
    expect(game.status).toBe('Your opponent took a box…');
    expect(game.nextTickIn()).toBe(CHAIN_DELAY_MS);
  });

  it('moves the cursor from line to line with the arrows, and draws with Enter', () => {
    const game = round();
    // The middle line: row 2 of the grid, column 3 (line 4).
    expect(game.cursor).toEqual({ row: 2, column: 3 });
    game.handleKey('ArrowRight');
    expect(game.cursor).toEqual({ row: 2, column: 5 });
    game.handleKey('ArrowRight');
    expect(game.cursor).toEqual({ row: 2, column: 5 });
    game.handleKey('ArrowDown');
    expect(game.cursor).toEqual({ row: 3, column: 4 });
    game.handleKey('ArrowLeft');
    game.handleKey('ArrowLeft');
    expect(game.cursor).toEqual({ row: 3, column: 0 });
    game.handleKey('ArrowUp');
    expect(game.cursor).toEqual({ row: 2, column: 1 });
    expect(game.handleKey('Enter')).toBe(true);
    expect(game.board.lines[3]).toBe('player');
    expect(game.handleKey('KeyQ')).toBe(false);
  });

  it('is won by whoever takes the most boxes, and tallied per size and difficulty', () => {
    const game = round();
    game.board.lines.fill('player');
    game.board.boxes.fill('player', 0, 5);
    game.board.boxes.fill('ai', 5);
    expect(game.outcome).toBe('wins');
    expect(game.status).toContain('You win 5–4!');
    expect(dotsAndBoxesGame.results.key({ size: '7', difficulty: 'hard' })).toBe('7-hard');
    expect(dotsAndBoxesGame.results.key({})).toBe('5-medium');
  });
});
