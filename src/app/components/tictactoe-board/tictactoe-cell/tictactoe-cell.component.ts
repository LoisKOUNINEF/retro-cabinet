import { Component, html } from '../../../../core/index.js';
import type { Mark } from '../../../games/secret/tictactoe.js';

export interface TicTacToeCell {
  mark: Mark | null;
  label: string;
  // On the winning line.
  win: boolean;
  // Under the keyboard cursor.
  cursor: boolean;
  disabled: boolean;
  onPlay: (index: number) => void;
}

// The catalog adds each item's index.
type IndexedCell = TicTacToeCell & { index: number };

const templateFn = (cell: IndexedCell) => html`__TEMPLATE_PLACEHOLDER__`;

// One cell of TicTacToeBoardComponent: a button playing its index.
export class TicTacToeCellComponent extends Component<HTMLElement, IndexedCell> {
  constructor(mountTarget: HTMLElement, cell: IndexedCell) {
    super({ templateFn, mountTarget, config: cell, props: { className: 'ttt-board__slot' } });
  }

  private _play(): void {
    this.config.onPlay(this.config.index);
  }
}
