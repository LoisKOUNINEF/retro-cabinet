import { Component, html } from '../../../../core/index.js';
import type { StickDirection } from '../../../games/game.js';
import { capture, listenPointer } from '../stick.js';

// A direction's arrow, or the game's action in an empty slot (Tetris's Rotate in the up one).
export interface CrossButton {
  direction: StickDirection;
  code: string;
  label: string;
  // Accessible name.
  name: string;
  isAction?: boolean;
  press: (code: string) => void;
  release: (code: string) => void;
}

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
    this.config.press(this.config.code);
  }

  private up(event: PointerEvent): void {
    if (!this._pointers.delete(event.pointerId)) return;
    this.config.release(this.config.code);
  }
}
