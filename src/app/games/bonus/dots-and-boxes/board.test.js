import { Board } from '#root/dist/src/app/games/bonus/dots-and-boxes/board.js';

describe('Dots and Boxes board', () => {
  it('numbers the horizontal lines, then the vertical ones, then the boxes, row by row', () => {
    const board = new Board(3);
    expect(board.lines.length).toBe(24);
    expect(board.boxes.length).toBe(9);
    expect(board.sides(0)).toEqual([0, 3, 12, 13]);
    expect(board.sides(4)).toEqual([4, 7, 17, 18]);
    expect(board.boxesOf(0)).toEqual([0]);
    expect(board.boxesOf(4)).toEqual([1, 4]);
    expect(board.boxesOf(12)).toEqual([0]);
    expect(board.boxesOf(13)).toEqual([0, 1]);
    expect(board.boxesOf(15)).toEqual([2]);
  });

  it('gives a closed box to whoever drew its last side, two at once if so', () => {
    const board = new Board(3);
    [0, 3, 12].forEach((line) => expect(board.draw(line, 'ai')).toEqual([]));
    expect(board.draw(13, 'player')).toEqual([0]);
    expect(board.boxes[0]).toBe('player');
    expect(board.draw(13, 'ai')).toEqual([]);

    [1, 4, 2, 5, 15].forEach((line) => board.draw(line, 'ai'));
    expect(board.draw(14, 'player')).toEqual([1, 2]);
    expect(board.count('player')).toBe(3);
  });

  it('is over once every line is drawn', () => {
    const board = new Board(3);
    board.freeLines().forEach((line) => board.draw(line, 'player'));
    expect(board.isOver).toBe(true);
    expect(board.count('player')).toBe(9);
  });

  it('lays dots, lines and boxes out on a grid', () => {
    const board = new Board(3);
    expect(board.gridSize).toBe(7);
    expect(board.cellAt(0, 0)).toEqual({ kind: 'dot' });
    expect(board.cellAt(0, 1)).toEqual({ kind: 'line', index: 0 });
    expect(board.cellAt(1, 0)).toEqual({ kind: 'line', index: 12 });
    expect(board.cellAt(1, 1)).toEqual({ kind: 'box', index: 0 });
    expect(board.cellAt(5, 5)).toEqual({ kind: 'box', index: 8 });
    expect(board.lineCell(13)).toEqual({ row: 1, column: 2 });
    expect(board.lineCell(4)).toEqual({ row: 2, column: 3 });
    board.lines.forEach((_, line) => {
      const { row, column } = board.lineCell(line);
      expect(board.cellAt(row, column)).toEqual({ kind: 'line', index: line });
    });
  });
});
