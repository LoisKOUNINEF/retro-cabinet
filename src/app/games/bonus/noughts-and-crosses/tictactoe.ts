export type Mark = 'X' | 'O';
// 9 cells, row by row: index = row * 3 + column.
export type Board = (Mark | null)[];
export type Result = Mark | 'draw' | null;

export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6],            // diagonals
];

export const emptyBoard = (): Board => Array<Mark | null>(9).fill(null);

export const other = (mark: Mark): Mark => (mark === 'X' ? 'O' : 'X');

export function freeCells(board: Board): number[] {
  return board.flatMap((cell, index) => (cell === null ? [index] : []));
}

// The three cells of a completed line, if any.
export function winningLine(board: Board): number[] | null {
  return LINES.find(([a, b, c]) => {
    const mark = board[a!];
    return mark !== null && mark === board[b!] && mark === board[c!];
  }) ?? null;
}

export function resultOf(board: Board): Result {
  const line = winningLine(board);
  if (line) return board[line[0]!] ?? null;
  return freeCells(board).length ? null : 'draw';
}

export class TicTacToe {
  board: Board = emptyBoard();
  turn: Mark = 'X';
  result: Result = null;
  winLine: number[] | null = null;

  constructor(first: Mark = 'X') {
    this.reset(first);
  }

  reset(first: Mark): void {
    this.board = emptyBoard();
    this.turn = first;
    this.result = null;
    this.winLine = null;
  }

  // Places the current mark; false if the cell is taken or the round is over.
  play(index: number): boolean {
    if (this.result || this.board[index] !== null || index < 0 || index > 8) return false;
    this.board[index] = this.turn;
    this.winLine = winningLine(this.board);
    this.result = resultOf(this.board);
    if (!this.result) this.turn = other(this.turn);
    return true;
  }
}
