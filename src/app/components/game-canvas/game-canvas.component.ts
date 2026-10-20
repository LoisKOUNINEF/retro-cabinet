import { Component, html } from '../../../core/index.js';
import type { CanvasGame } from '../../games/game.js';

export interface GameCanvasConfig {
  width: number;
  height: number;
}

const templateFn = ({ width, height }: GameCanvasConfig) =>
  html`<canvas class="game-canvas" width="${width}" height="${height}"></canvas>`;

// The canvas counterpart of GameBoardComponent: rendered once, then paint()
// clears it and lets the game draw itself.
export class GameCanvasComponent extends Component<HTMLElement, GameCanvasConfig> {
  private _ctx: CanvasRenderingContext2D | null = null;

  constructor(mountTarget: HTMLElement, config: GameCanvasConfig) {
    super({ templateFn, mountTarget, config });
  }

  paint(game: CanvasGame): void {
    if (!this._ctx) return;
    this._ctx.clearRect(0, 0, this.config.width, this.config.height);
    game.draw(this._ctx);
  }

  protected override onAfterRender(): void {
    super.onAfterRender();
    const canvas = this.element.querySelector('canvas');
    canvas?.style.setProperty('--aspect', `${this.config.width} / ${this.config.height}`);
    // null where canvas isn't supported (e.g. jsdom): paint() then draws nothing.
    this._ctx = canvas?.getContext('2d') ?? null;
  }
}
