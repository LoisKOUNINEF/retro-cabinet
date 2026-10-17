import { html } from '../../../core/index.js';
import type { Board } from '../../games/secret/tictactoe.js';
import { UpdatableComponent } from '../updatable-component.js';
import { TicTacToeCellComponent, type TicTacToeCell } from './tictactoe-cell/tictactoe-cell.component.js';

export interface TicTacToeBoardConfig {
  board: Board;
  winLine: number[] | null;
  // The keyboard cursor's cell.
  cursor: number;
  // No moves allowed (the AI is thinking, or the round is over).
  locked: boolean;
}

const cellLabel = (board: Board, index: number) =>
  `Row ${Math.floor(index / 3) + 1}, column ${(index % 3) + 1}: ${board[index] ?? 'empty'}`;

const templateFn = () => html`__TEMPLATE_PLACEHOLDER__`;

// Nine cells, kept by index: a move or a cursor step only rebuilds the cells it changes.
export class TicTacToeBoardComponent extends UpdatableComponent<TicTacToeBoardConfig> {
  constructor(
    mountTarget: HTMLElement,
    config: TicTacToeBoardConfig,
    // Passed to every cell as is, so unchanged cells stay equal and are kept.
    private readonly onPlay: (index: number) => void,
  ) {
    super({ templateFn, mountTarget, config });
  }

  override registerChildren(): Nutin.ComponentConfig[] {
    const { board, winLine, cursor, locked } = this.config;
    return this.createCatalogComponents({
      items: board.map((mark, index): TicTacToeCell => ({
        mark,
        label: cellLabel(board, index),
        win: winLine?.includes(index) ?? false,
        cursor: index === cursor,
        disabled: mark !== null || locked,
        onPlay: this.onPlay,
      })),
      selector: 'cells',
      elementName: 'tictactoe-cell',
      component: TicTacToeCellComponent,
      keepBy: (_cell: TicTacToeCell, index: number) => index,
    });
  }
}
