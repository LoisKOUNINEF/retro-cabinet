import { Component, html } from '../../../core/index.js';
import type { Grid } from '../../games/game.js';

export interface GameBoardConfig {
  width: number;
  height: number;
}

const templateFn = ({ width, height }: GameBoardConfig) =>
  html`<div class="game-board">${Array.from({ length: width * height }, () => html`<div class="game-board__cell"></div>`)}</div>`;

// Rendered once; every tick, paint() only swaps cell classes. The cells are deliberately
// not a catalog: hundreds of them repaint many times a second, which one component per
// cell (or a re-render) couldn't keep up with.
export class GameBoardComponent extends Component<HTMLElement, GameBoardConfig> {
  private _cells: HTMLElement[] = [];

  constructor(mountTarget: HTMLElement, config: GameBoardConfig) {
    super({ templateFn, mountTarget, config });
  }

  paint(grid: Grid): void {
    grid.forEach((row, y) => row.forEach((cell, x) => {
      const element = this._cells[y * this.config.width + x];
      const className = cell ? `game-board__cell game-board__cell--${cell}` : 'game-board__cell';
      if (element && element.className !== className) element.className = className;
    }));
  }

  protected override onAfterRender(): void {
    super.onAfterRender();
    const board = this.element.querySelector<HTMLElement>('.game-board')!;
    board.style.setProperty('--cols', String(this.config.width));
    board.style.setProperty('--rows', String(this.config.height));
    this._cells = Array.from(board.children) as HTMLElement[];
  }
}
