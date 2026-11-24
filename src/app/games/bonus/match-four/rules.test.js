import { COLUMNS, LINES, LINES_THROUGH, MatchFour, ROWS, cellIndex, freeColumns, landingRow, winningLineAt } from '#root/dist/src/app/games/bonus/match-four/rules.js';

// Rows from the top, as strings: 'r' red, 'y' yellow, '.' empty.
const board = (rows) => [...rows.join('')].map((c) => (c === 'r' ? 'red' : c === 'y' ? 'yellow' : null));
const play = (columns, first = 'red') => {
  const game = new MatchFour(first);
  columns.forEach((column) => game.drop(column));
  return game;
};

describe('Match four rules', () => {
  it('has the 69 lines of four on a 7×6 board, each cell on 3 to 13 of them', () => {
    expect(COLUMNS * ROWS).toBe(42);
    expect(LINES.length).toBe(69);
    expect(new Set(LINES.map((line) => line.join())).size).toBe(69);
    expect(LINES_THROUGH[cellIndex(0, 0)].length).toBe(3);
    expect(Math.max(...LINES_THROUGH.map((lines) => lines.length))).toBe(13);
  });

  it('drops discs to the lowest free row, and refuses full columns', () => {
    const game = play([3, 3, 3]);
    expect(game.board[cellIndex(5, 3)]).toBe('red');
    expect(game.board[cellIndex(4, 3)]).toBe('yellow');
    expect(game.board[cellIndex(3, 3)]).toBe('red');
    expect(landingRow(game.board, 3)).toBe(2);
    [3, 3, 3].forEach((column) => game.drop(column));
    expect(landingRow(game.board, 3)).toBe(null);
    expect(game.drop(3)).toBe(false);
    expect(game.drop(7)).toBe(false);
    expect(game.drop(-1)).toBe(false);
    expect(freeColumns(game.board)).toEqual([0, 1, 2, 4, 5, 6]);
  });

  it('alternates turns, starting with the chosen disc', () => {
    const game = new MatchFour('yellow');
    expect(game.turn).toBe('yellow');
    game.drop(0);
    expect(game.turn).toBe('red');
  });

  it('wins across, down and on both diagonals', () => {
    const across = play([0, 0, 1, 1, 2, 2, 3]);
    expect(across.result).toBe('red');
    expect(across.winLine).toEqual([35, 36, 37, 38]);

    expect(play([0, 1, 0, 1, 0, 1, 0]).result).toBe('red');

    // Rising to the right: red on (5,0), (4,1), (3,2), (2,3).
    const rising = play([0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]);
    expect(rising.result).toBe('red');
    expect(rising.winLine.sort((a, b) => a - b)).toEqual([cellIndex(2, 3), cellIndex(3, 2), cellIndex(4, 1), cellIndex(5, 0)].sort((a, b) => a - b));

    const falling = board([
      '.......',
      '.......',
      'r......',
      'yr.....',
      'yyr....',
      'yyyr...',
    ]);
    expect(winningLineAt(falling, cellIndex(5, 3))).toEqual([cellIndex(2, 0), cellIndex(3, 1), cellIndex(4, 2), cellIndex(5, 3)]);
  });

  it('ends on a win and refuses drops after it', () => {
    const game = play([0, 1, 0, 1, 0, 1, 0]);
    expect(game.drop(2)).toBe(false);
    expect(game.turn).toBe('red');
  });

  it('calls a full board with no line a draw', () => {
    // Fills the board with pairs of colours swapping every row: no four anywhere.
    const order = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 4, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6];
    const game = play(order);
    expect(game.result).toBe(null);
    game.drop(5);
    expect(game.result).toBe('draw');
    expect(game.winLine).toBe(null);
  });
});
