import { html } from '../../../core/index.js';
import type { CellState } from '../../games/bonus/minefield/minefield.js';
import { UpdatableComponent } from '../updatable-component.js';
import { MinefieldCellComponent, type MinefieldCell } from './minefield-cell/minefield-cell.component.js';

// A cell as shown: as played, then once the round is lost, the mines, the one dug and the wrong flags.
export type MinefieldView = CellState | 'mine' | 'exploded' | 'wrong';

// What a tap or a click does.
export type MinefieldMode = 'dig' | 'flag';

export interface MinefieldBoardConfig {
  rows: number;
  columns: number;
  // count: mines around an open cell, 0 otherwise.
  cells: { view: MinefieldView; count: number }[];
  // The keyboard cursor's cell.
  cursor: number;
  // The round is over.
  locked: boolean;
}

// The board's own state on top: the Dig/Flag toggle.
type BoardState = MinefieldBoardConfig & { mode?: MinefieldMode };

const VIEW_LABEL: Record<Exclude<MinefieldView, 'open'>, string> = {
  hidden: 'hidden',
  flag: 'flagged',
  question: 'question mark',
  mine: 'mine',
  exploded: 'mine, dug',
  wrong: 'wrong flag, no mine',
};

// "C4: 3 mines around": rows A, B, C… from the top, columns from 1.
function cellLabel(index: number, columns: number, view: MinefieldView, count: number): string {
  const name = `${String.fromCharCode(65 + Math.floor(index / columns))}${(index % columns) + 1}`;
  if (view !== 'open') return `${name}: ${VIEW_LABEL[view]}`;
  return `${name}: ${count ? `${count} ${count === 1 ? 'mine' : 'mines'} around` : 'empty'}`;
}

const templateFn = (state: BoardState) => html`__TEMPLATE_PLACEHOLDER__`;

// The Dig/Flag toggle, and the cells, kept by index: digging only rebuilds the cells it opens.
// A click digs (or flags, with the toggle on Flag); a right-click or a long press always flags.
export class MinefieldBoardComponent extends UpdatableComponent<BoardState> {
  private _mode: MinefieldMode = 'dig';

  constructor(
    mountTarget: HTMLElement,
    config: MinefieldBoardConfig,
    private readonly onSelect: (index: number, action?: string) => void,
  ) {
    super({ templateFn, mountTarget, config: { ...config, mode: 'dig' } });
  }

  override update(config: BoardState): void {
    super.update({ ...config, mode: this._mode });
  }

  override registerChildren(): Nutin.ComponentConfig[] {
    const { cells, columns, cursor, locked } = this.config;
    return this.createCatalogComponents({
      items: cells.map(({ view, count }, index): MinefieldCell => ({
        view,
        count,
        label: cellLabel(index, columns, view, count),
        cursor: index === cursor,
        disabled: locked,
        onDig: this._dig,
        onFlag: this._flag,
      })),
      selector: 'cells',
      elementName: 'minefield-cell',
      component: MinefieldCellComponent,
      keepBy: (_cell: MinefieldCell, index: number) => index,
    });
  }

  // Passed to every cell as is, so unchanged cells stay equal and are kept.
  private readonly _dig = (index: number): void => this.onSelect(index, this._mode);
  private readonly _flag = (index: number): void => this.onSelect(index, 'flag');

  private _setMode(mode: string): void {
    this._mode = mode === 'flag' ? 'flag' : 'dig';
    this.update(this.config);
  }
}
