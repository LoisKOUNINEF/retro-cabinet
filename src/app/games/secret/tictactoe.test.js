import { LINES, TicTacToe, freeCells, resultOf, winningLine } from '#root/dist/src/app/games/secret/tictactoe.js';

const board = (rows) => [...rows.join('')].map((c) => (c === '.' ? null : c));

describe('Noughts and crosses rules', () => {
  it('wins on each of the 8 lines', () => {
    LINES.forEach((line) => {
      const cells = Array(9).fill(null);
      line.forEach((i) => { cells[i] = 'O'; });
      expect(winningLine(cells)).toEqual(line);
      expect(resultOf(cells)).toBe('O');
    });
  });

  it('calls a full board with no line a draw', () => {
    expect(resultOf(board(['XOX', 'XOO', 'OXX']))).toBe('draw');
    expect(resultOf(board(['XO.', '...', '...']))).toBe(null);
  });

  it('lists the free cells', () => {
    expect(freeCells(board(['X.O', '.X.', 'O..']))).toEqual([1, 3, 5, 7, 8]);
  });

  it('alternates turns and refuses taken cells', () => {
    const game = new TicTacToe('X');

    expect(game.play(4)).toBeTruthy();
    expect(game.turn).toBe('O');
    expect(game.play(4)).toBeFalsy();
    expect(game.turn).toBe('O');
    expect(game.play(9)).toBeFalsy();
  });

  it('ends on a line and refuses moves after', () => {
    const game = new TicTacToe('X');
    [0, 3, 1, 4, 2].forEach((cell) => game.play(cell));

    expect(game.result).toBe('X');
    expect(game.winLine).toEqual([0, 1, 2]);
    expect(game.play(8)).toBeFalsy();
  });

  it('starts a new round with the chosen first mark', () => {
    const game = new TicTacToe('X');
    game.play(0);
    game.reset('O');

    expect(game.turn).toBe('O');
    expect(game.board.every((cell) => cell === null)).toBeTruthy();
    expect(game.result).toBe(null);
  });
});
