export type Player = 'player' | 'ai';

export const other = (who: Player): Player => (who === 'player' ? 'ai' : 'player');

export type Cell = { kind: 'dot' } | { kind: 'line'; index: number } | { kind: 'box'; index: number };

// A square grid of `size` × `size` boxes between (size + 1)² dots.
// Lines: the horizontal ones first, row by row ((size + 1) rows of `size`), then the vertical ones
// (`size` rows of size + 1). Boxes: row by row. Each keeps who drew or took it, null until then.
export class Board {
  readonly lines: (Player | null)[];
  readonly boxes: (Player | null)[];

  constructor(readonly size: number, lines?: readonly (Player | null)[], boxes?: readonly (Player | null)[]) {
    this.lines = lines ? [...lines] : Array<Player | null>(2 * size * (size + 1)).fill(null);
    this.boxes = boxes ? [...boxes] : Array<Player | null>(size * size).fill(null);
  }

  clone(): Board {
    return new Board(this.size, this.lines, this.boxes);
  }

  get horizontalCount(): number {
    return (this.size + 1) * this.size;
  }

  get isOver(): boolean {
    return this.lines.every((line) => line !== null);
  }

  // The top, bottom, left and right lines of a box.
  sides(box: number): number[] {
    const { size } = this;
    const row = Math.floor(box / size);
    const column = box % size;
    const vertical = this.horizontalCount + row * (size + 1) + column;
    return [row * size + column, (row + 1) * size + column, vertical, vertical + 1];
  }

  // The one or two boxes a line borders.
  boxesOf(line: number): number[] {
    const { size } = this;
    if (line < this.horizontalCount) {
      const row = Math.floor(line / size);
      const column = line % size;
      return [...(row > 0 ? [(row - 1) * size + column] : []), ...(row < size ? [row * size + column] : [])];
    }
    const index = line - this.horizontalCount;
    const row = Math.floor(index / (size + 1));
    const column = index % (size + 1);
    return [...(column > 0 ? [row * size + column - 1] : []), ...(column < size ? [row * size + column] : [])];
  }

  sidesDrawn(box: number): number {
    return this.sides(box).filter((line) => this.lines[line] !== null).length;
  }

  freeLines(): number[] {
    return this.lines.flatMap((owner, line) => (owner === null ? [line] : []));
  }

  // Draws a free line; the boxes it closes go to whoever drew it, and are returned.
  draw(line: number, who: Player): number[] {
    if (this.lines[line] !== null) return [];
    this.lines[line] = who;
    const closed = this.boxesOf(line).filter((box) => this.sidesDrawn(box) === 4);
    closed.forEach((box) => (this.boxes[box] = who));
    return closed;
  }

  count(who: Player): number {
    return this.boxes.filter((owner) => owner === who).length;
  }

  // The board as a (2·size + 1)² grid, row by row: dots at even/even, boxes at odd/odd, lines between.
  get gridSize(): number {
    return 2 * this.size + 1;
  }

  cellAt(row: number, column: number): Cell {
    const { size } = this;
    const evenRow = row % 2 === 0;
    const evenColumn = column % 2 === 0;
    if (evenRow && evenColumn) return { kind: 'dot' };
    if (!evenRow && !evenColumn) return { kind: 'box', index: ((row - 1) / 2) * size + (column - 1) / 2 };
    if (evenRow) return { kind: 'line', index: (row / 2) * size + (column - 1) / 2 };
    return { kind: 'line', index: this.horizontalCount + ((row - 1) / 2) * (size + 1) + column / 2 };
  }

  // Where a line sits in the grid.
  lineCell(line: number): { row: number; column: number } {
    const { size } = this;
    if (line < this.horizontalCount) return { row: 2 * Math.floor(line / size), column: 2 * (line % size) + 1 };
    const index = line - this.horizontalCount;
    return { row: 2 * Math.floor(index / (size + 1)) + 1, column: 2 * (index % (size + 1)) };
  }
}
