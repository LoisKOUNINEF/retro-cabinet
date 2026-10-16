import { Component, html } from '../../../core/index.js';
import type { Board } from '../../games/secret/tictactoe.js';

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

const templateFn = ({ board, winLine, cursor, locked }: TicTacToeBoardConfig) => html`__TEMPLATE_PLACEHOLDER__`;

// Nine cells, re-rendered after each move: a turn-based board is small enough
// for a plain Nutin render.
export class TicTacToeBoardComponent extends Component<HTMLElement, TicTacToeBoardConfig> {
  constructor(
    mountTarget: HTMLElement,
    config: TicTacToeBoardConfig,
    private readonly onPlay: (index: number) => void,
  ) {
    super({ templateFn, mountTarget, config });
  }

  update(config: TicTacToeBoardConfig): void {
    this.config = config;
    this.render();
  }

  private _play(index: string): void {
    this.onPlay(Number(index));
  }
}
