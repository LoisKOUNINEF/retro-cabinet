import { chooseLine, components, endgameValue, isSafe } from '#root/dist/src/app/games/bonus/dots-and-boxes/ai.js';
import { Board } from '#root/dist/src/app/games/bonus/dots-and-boxes/board.js';

const withLines = (size, lines, boxes = {}) => {
  const board = new Board(size);
  lines.forEach((line) => (board.lines[line] = 'player'));
  Object.entries(boxes).forEach(([box, owner]) => (board.boxes[box] = owner));
  return board;
};
const LEVELS = ['easy', 'medium', 'hard'];

// 2×2: box 0 alone (both free sides on the edge), boxes 1, 3, 2 in a chain of 3. Nothing safe.
const ONE_AND_THREE = () => withLines(2, [2, 7, 1, 9, 5, 11]);

// 3×3: the AI is taking a chain down column 0 (box 3 open, box 6 behind it, the board's edge
// after), boxes 0–2 make a chain of 3 still to come, the rest is taken.
const HANDOUT = () => withLines(3, [0, 1, 2, 3, 4, 5, 16, 17, 20, 21, 7, 18, 8, 19, 10, 22, 11, 23], { 4: 'player', 5: 'player', 7: 'player', 8: 'player' });

describe('Dots and Boxes AI', () => {
  it('takes a box when one is offered, at every level', () => {
    LEVELS.forEach((level) => expect(chooseLine(withLines(3, [0, 3, 12]), 'ai', level, () => 0.5)).toBe(13));
  });

  it('never gives a box away while a safe line is left (Medium and Hard)', () => {
    const board = withLines(3, [0, 3]);
    ['medium', 'hard'].forEach((level) => {
      for (let i = 0; i < 30; i++) {
        const line = chooseLine(board, 'ai', level, () => 0.11 + (i / 30) * 0.88);
        expect(isSafe(board, line)).toBe(true);
      }
    });
  });

  it('finds the chains and loops left', () => {
    const parts = components(ONE_AND_THREE());
    expect(parts.map(({ boxes, loop }) => [boxes.length, loop]).sort()).toEqual([[1, false], [3, false]]);
    expect(components(new Board(3))).toBe(null);
  });

  it('values an endgame for the player who has to open a component', () => {
    expect(endgameValue([])).toBe(0);
    expect(endgameValue([{ size: 3, loop: false }])).toBe(-3);
    expect(endgameValue([{ size: 1, loop: false }, { size: 3, loop: false }])).toBe(2);
    expect(endgameValue([{ size: 4, loop: true }])).toBe(-4);
  });

  it('opens the smallest chain when it has to give something', () => {
    ['medium', 'hard'].forEach((level) => expect([0, 6]).toContain(chooseLine(ONE_AND_THREE(), 'ai', level, () => 0.5)));
  });

  it('hands the last 2 boxes of a chain back on Hard, to keep the control', () => {
    expect(chooseLine(HANDOUT(), 'ai', 'hard', () => 0.5)).toBe(9);
    expect(chooseLine(HANDOUT(), 'ai', 'medium', () => 0.5)).toBe(6);
  });

  it('only ever draws free lines, to the end of a game', () => {
    LEVELS.forEach((level) => [3, 5].forEach((size) => {
      const board = new Board(size);
      let who = 'player';
      while (!board.isOver) {
        const line = chooseLine(board, who, level, Math.random);
        expect(board.lines[line]).toBe(null);
        if (!board.draw(line, who).length) who = who === 'player' ? 'ai' : 'player';
      }
      expect(board.count('player') + board.count('ai')).toBe(size * size);
    }));
  });
});
