import { Component, html } from '../../../../core/index.js';

export interface MatchFourColumn {
  // One letter per cell from the top: 'r' red, 'y' yellow, '.' empty.
  discs: string;
  // Rows on the winning line, comma-separated.
  winRows: string;
  // The row of the disc just dropped here, which falls into place.
  droppedRow: number | null;
  label: string;
  // Under the keyboard cursor.
  cursor: boolean;
  disabled: boolean;
  onDrop: (column: number) => void;
}

// The catalog adds each item's index.
type IndexedColumn = MatchFourColumn & { index: number };

const DISC_CLASS: Record<string, string> = { r: ' m4-board__cell--red', y: ' m4-board__cell--yellow' };

const cellClass = (column: IndexedColumn, disc: string, row: number) => {
  const win = column.winRows.split(',').includes(String(row)) ? ' m4-board__cell--win' : '';
  // Falls from above the board: the further down it lands, the longer the fall.
  const dropped = row === column.droppedRow ? ` m4-board__cell--dropped-${row}` : '';
  return `m4-board__cell${DISC_CLASS[disc] ?? ''}${win}${dropped}`;
};

const templateFn = (column: IndexedColumn) => html`__TEMPLATE_PLACEHOLDER__`;

// One column of MatchFourBoardComponent: a button dropping a disc in it.
export class MatchFourColumnComponent extends Component<HTMLElement, IndexedColumn> {
  constructor(mountTarget: HTMLElement, column: IndexedColumn) {
    super({ templateFn, mountTarget, config: column, props: { className: 'm4-board__slot' } });
  }

  private _drop(): void {
    this.config.onDrop(this.config.index);
  }
}
