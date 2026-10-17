import { Component, html } from '../../../../core/index.js';
import type { StickDirection } from '../../../games/game.js';
import { DIRECTION_CODES, capture, listenPointer } from '../stick.js';

export interface CrossButton {
  direction: StickDirection;
  press: (code: string) => void;
  release: (code: string) => void;
}

const ARROWS: Record<StickDirection, string> = { up: '▲', down: '▼', left: '◀', right: '▶' };

const templateFn = (button: CrossButton) => html`__TEMPLATE_PLACEHOLDER__`;

// One D-pad button: each tap is one key press, as fast as the player taps.
// It follows each finger on it, so a press always gets its release.
export class CrossButtonComponent extends Component<HTMLElement, CrossButton> {
  private readonly _pointers = new Set<number>();

  constructor(mountTarget: HTMLElement, button: CrossButton) {
    super({ templateFn, mountTarget, config: button });
  }

  protected override onAfterRender(): void {
    super.onAfterRender();
    const button = this.element.querySelector<HTMLElement>('button');
    if (!button) return;
    listenPointer(this.eventListeners, button, 'pointerdown', (event) => this.down(event));
    listenPointer(this.eventListeners, button, 'pointerup', (event) => this.up(event));
    listenPointer(this.eventListeners, button, 'pointercancel', (event) => this.up(event));
  }

  private down(event: PointerEvent): void {
    event.preventDefault();
    capture(event);
    this._pointers.add(event.pointerId);
    this.config.press(DIRECTION_CODES[this.config.direction]);
  }

  private up(event: PointerEvent): void {
    if (!this._pointers.delete(event.pointerId)) return;
    this.config.release(DIRECTION_CODES[this.config.direction]);
  }
}
