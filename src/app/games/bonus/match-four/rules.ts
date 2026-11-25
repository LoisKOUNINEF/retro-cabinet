export const COLUMNS = 7;
export const ROWS = 6;

export type Disc = 'red' | 'yellow';
// 42 cells, row by row from the top: index = row * COLUMNS + column.
export type Board = (Disc | null)[];
export type Result = Disc | 'draw' | null;

export const other = (disc: Disc): Disc => (disc === 'red' ? 'yellow' : 'red');

export const cellIndex = (row: number, column: number) => row * COLUMNS + column;

export const emptyBoard = (): Board => Array<Disc | null>(ROWS * COLUMNS).fill(null);

// Every run of four cells: across, down and both diagonals (69 on a 7×6 board).
export const LINES: number[][] = (() => {
  const lines: number[][] = [];
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]] as const;
  for (let row = 0; row < ROWS; row++) {
    for (let column = 0; column < COLUMNS; column++) {
      directions.forEach(([dr, dc]) => {
        const endRow = row + 3 * dr;
        const endColumn = column + 3 * dc;
        if (endRow < 0 || endRow >= ROWS || endColumn < 0 || endColumn >= COLUMNS) return;
        lines.push([0, 1, 2, 3].map((i) => cellIndex(row + i * dr, column + i * dc)));
      });
    }
  }
  return lines;
})();

// The lines through each cell: only those can be completed by a disc landing there.
export const LINES_THROUGH: number[][][] = Array.from({ length: ROWS * COLUMNS }, (_, cell) => LINES.filter((line) => line.includes(cell)));

// The row a disc dropped in `column` lands on, or null when the column is full.
export function landingRow(board: Board, column: number): number | null {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[cellIndex(row, column)] === null) return row;
  }
  return null;
}

export function freeColumns(board: Board): number[] {
  return Array.from({ length: COLUMNS }, (_, column) => column).filter((column) => board[column] === null);
}

// The four cells of a line through `cell` completed by its disc, if any.
export function winningLineAt(board: Board, cell: number): number[] | null {
  const disc = board[cell];
  if (!disc) return null;
  return LINES_THROUGH[cell]!.find((line) => line.every((i) => board[i] === disc)) ?? null;
}

export class MatchFour {
  board: Board = emptyBoard();
  turn: Disc = 'red';
  result: Result = null;
  winLine: number[] | null = null;
  // The cell the last disc landed in.
  lastCell: number | null = null;

  constructor(first: Disc = 'red') {
    this.turn = first;
  }

  // Drops the current disc in `column`; false if it's full, out of the board or the round is over.
  drop(column: number): boolean {
    if (this.result || column < 0 || column >= COLUMNS) return false;
    const row = landingRow(this.board, column);
    if (row === null) return false;
    const cell = cellIndex(row, column);
    this.board[cell] = this.turn;
    this.lastCell = cell;
    this.winLine = winningLineAt(this.board, cell);
    if (this.winLine) this.result = this.turn;
    else if (freeColumns(this.board).length === 0) this.result = 'draw';
    else this.turn = other(this.turn);
    return true;
  }
}
