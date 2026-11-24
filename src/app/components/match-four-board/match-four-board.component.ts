import { html } from '../../../core/index.js';
import { COLUMNS, ROWS, cellIndex, type Board } from '../../games/bonus/match-four/rules.js';
import { UpdatableComponent } from '../updatable-component.js';
import { MatchFourColumnComponent, type MatchFourColumn } from './match-four-column/match-four-column.component.js';

export interface MatchFourBoardConfig {
  board: Board;
  winLine: number[] | null;
  // The last disc dropped: it falls into place.
  lastCell: number | null;
  // The keyboard cursor's column.
  cursor: number;
  // No moves allowed (the AI is thinking, or the round is over).
  locked: boolean;
}

// What a column holds, as one letter per cell from the top: 'r' red, 'y' yellow, '.' empty.
const columnDiscs = (board: Board, column: number) =>
  Array.from({ length: ROWS }, (_, row) => board[cellIndex(row, column)]?.[0] ?? '.').join('');

// "Column 4: red, yellow, 4 free", from the bottom up.
function columnLabel(board: Board, column: number): string {
  const discs = Array.from({ length: ROWS }, (_, i) => board[cellIndex(ROWS - 1 - i, column)]).filter((disc) => disc !== null);
  const free = ROWS - discs.length;
  const contents = [...discs, ...(free ? [free === ROWS ? 'empty' : `${free} free`] : ['full'])].join(', ');
  return `Column ${column + 1}: ${contents}`;
}

// The cells of `column` among `cells`, as row numbers.
const rowsIn = (cells: number[] | null, column: number) =>
  (cells ?? []).filter((cell) => cell % COLUMNS === column).map((cell) => Math.floor(cell / COLUMNS));

const templateFn = () => html`__TEMPLATE_PLACEHOLDER__`;

// Seven columns, kept by index: a drop or a cursor step only rebuilds the columns it changes.
export class MatchFourBoardComponent extends UpdatableComponent<MatchFourBoardConfig> {
  constructor(
    mountTarget: HTMLElement,
    config: MatchFourBoardConfig,
    // Passed to every column as is, so unchanged columns stay equal and are kept.
    private readonly onDrop: (column: number) => void,
  ) {
    super({ templateFn, mountTarget, config });
  }

  override registerChildren(): Nutin.ComponentConfig[] {
    const { board, winLine, lastCell, cursor, locked } = this.config;
    return this.createCatalogComponents({
      items: Array.from({ length: COLUMNS }, (_, column): MatchFourColumn => {
        const discs = columnDiscs(board, column);
        const dropped = lastCell !== null && lastCell % COLUMNS === column ? Math.floor(lastCell / COLUMNS) : null;
        return {
          discs,
          // Kept as a string: a shallow compare sees an unchanged column as equal.
          winRows: rowsIn(winLine, column).join(','),
          droppedRow: dropped,
          label: columnLabel(board, column),
          cursor: column === cursor,
          disabled: locked || !discs.includes('.'),
          onDrop: this.onDrop,
        };
      }),
      selector: 'columns',
      elementName: 'match-four-column',
      component: MatchFourColumnComponent,
      keepBy: (_column: MatchFourColumn, index: number) => index,
    });
  }
}
