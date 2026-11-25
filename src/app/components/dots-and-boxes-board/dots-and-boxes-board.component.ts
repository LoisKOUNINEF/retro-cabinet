import { html } from '../../../core/index.js';
import { Board, type Player } from '../../games/bonus/dots-and-boxes/board.js';
import { UpdatableComponent } from '../updatable-component.js';
import { DotsAndBoxesCellComponent, type DotsAndBoxesCell } from './dots-and-boxes-cell/dots-and-boxes-cell.component.js';

export interface DotsAndBoxesBoardConfig {
  // Boxes per side.
  size: number;
  lines: readonly (Player | null)[];
  boxes: readonly (Player | null)[];
  // The last line drawn, highlighted.
  lastLine: number | null;
  // The keyboard cursor, as a grid cell index (row by row, (2·size + 1) per row).
  cursor: number;
  // Not the player's turn, or the round is over.
  locked: boolean;
}

// Dots are named as on a chessboard turned around: rows A, B, C… from the top, columns 1, 2, 3…
const dotName = (row: number, column: number) => `${String.fromCharCode(65 + row)}${column + 1}`;
const OWNER: Record<Player, string> = { player: 'you', ai: 'your opponent' };

function lineLabel(row: number, column: number, owner: Player | null): string {
  // Grid row/column to dots: a line on an even row is horizontal.
  const [from, to] = row % 2 === 0
    ? [dotName(row / 2, (column - 1) / 2), dotName(row / 2, (column + 1) / 2)]
    : [dotName((row - 1) / 2, column / 2), dotName((row + 1) / 2, column / 2)];
  return `Line ${from}–${to}: ${owner ? `drawn by ${OWNER[owner]}` : 'free'}`;
}

function boxLabel(row: number, column: number, owner: Player | null): string {
  const name = dotName((row - 1) / 2, (column - 1) / 2);
  return `Box ${name}: ${owner === 'player' ? 'yours' : owner === 'ai' ? "your opponent's" : 'open'}`;
}

const templateFn = ({ size }: DotsAndBoxesBoardConfig) => html`__TEMPLATE_PLACEHOLDER__`;

// The grid of dots, lines and boxes, one cell each, kept by index: drawing a line only rebuilds
// that line, the boxes it closes, and the cells the cursor or the highlight leave.
export class DotsAndBoxesBoardComponent extends UpdatableComponent<DotsAndBoxesBoardConfig> {
  constructor(
    mountTarget: HTMLElement,
    config: DotsAndBoxesBoardConfig,
    // Passed to every line as is, so unchanged lines stay equal and are kept.
    private readonly onSelect: (index: number) => void,
  ) {
    super({ templateFn, mountTarget, config });
  }

  override registerChildren(): Nutin.ComponentConfig[] {
    const { size, lines, boxes, lastLine, cursor, locked } = this.config;
    const board = new Board(size);
    const span = board.gridSize;
    const items = Array.from({ length: span * span }, (_, i): DotsAndBoxesCell => {
      const row = Math.floor(i / span);
      const column = i % span;
      const cell = board.cellAt(row, column);
      if (cell.kind === 'dot') return { kind: 'dot', line: -1, owner: null, label: '', last: false, cursor: false, disabled: true, onSelect: this.onSelect };
      if (cell.kind === 'box') {
        const owner = boxes[cell.index] ?? null;
        return { kind: 'box', line: -1, owner, label: boxLabel(row, column, owner), last: false, cursor: false, disabled: true, onSelect: this.onSelect };
      }
      const owner = lines[cell.index] ?? null;
      return {
        kind: row % 2 === 0 ? 'horizontal' : 'vertical',
        line: cell.index,
        owner,
        label: lineLabel(row, column, owner),
        last: cell.index === lastLine,
        cursor: i === cursor,
        disabled: locked || owner !== null,
        onSelect: this.onSelect,
      };
    });
    return this.createCatalogComponents({
      items,
      selector: 'cells',
      elementName: 'dots-and-boxes-cell',
      component: DotsAndBoxesCellComponent,
      keepBy: (_cell: DotsAndBoxesCell, index: number) => index,
    });
  }
}
