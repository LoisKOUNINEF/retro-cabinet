import { Component, html } from '../../../core/index.js';
import type { StickDirection, TouchLayout } from '../../games/game.js';
import { DIRECTION_CODES, STICK_RADIUS, stickDirection } from './stick.js';

export interface TouchHandlers {
  press(code: string): void;
  release(code: string): void;
  togglePlay(): void;
}

const ARROWS: Record<StickDirection, string> = { up: '▲', down: '▼', left: '◀', right: '▶' };

const templateFn = (layout: TouchLayout) => html`__TEMPLATE_PLACEHOLDER__`;

// Keeps a finger's events on its control even when it slides off. Only a nicety: it can
// fail (a pointer already gone, no support) and must never block the press itself.
function capture(event: PointerEvent): void {
  try {
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
  } catch {
    // Without capture, the control still works while the finger stays on it.
  }
}

// A virtual stick or a D-pad (left thumb), an optional action button (right thumb) and a
// play/pause button. They send the same key codes as the keyboard: games don't know the difference.
// Each control follows its own finger, so moving and firing work at the same time.
export class TouchControlsComponent extends Component<HTMLElement, TouchLayout> {
  private _stickPointer: number | null = null;
  private _direction: StickDirection | null = null;
  private _repeat: ReturnType<typeof setInterval> | null = null;
  private _actionPointer: number | null = null;
  // D-pad buttons held down, by finger.
  private _crossPointers = new Map<number, string>();

  constructor(mountTarget: HTMLElement, layout: TouchLayout, private readonly handlers: TouchHandlers) {
    super({ templateFn, mountTarget, config: layout });
  }

  // Lets go of everything: called when the game pauses, so no key stays held.
  reset(): void {
    this._stickPointer = null;
    this.setDirection(null);
    this.moveKnob(0, 0);
    this.releaseAction();
    this._crossPointers.forEach((code) => this.handlers.release(code));
    this._crossPointers.clear();
  }

  protected override onAfterRender(): void {
    super.onAfterRender();
    // Pointer events need several listeners per element (one data-event each):
    // bound here into eventListeners, which Nutin unbinds on re-render and destroy.
    const stick = this.element.querySelector<HTMLElement>('.touch-controls__stick');
    const action = this.element.querySelector<HTMLElement>('.touch-controls__action');
    if (stick) {
      this.on(stick, 'pointerdown', this.onStickDown);
      this.on(stick, 'pointermove', this.onStickMove);
      this.on(stick, 'pointerup', this.onStickUp);
      this.on(stick, 'pointercancel', this.onStickUp);
    }
    this.element.querySelectorAll<HTMLElement>('.touch-controls__cross-button').forEach((button) => {
      this.on(button, 'pointerdown', this.onCrossDown);
      this.on(button, 'pointerup', this.onCrossUp);
      this.on(button, 'pointercancel', this.onCrossUp);
    });
    if (action) {
      this.on(action, 'pointerdown', this.onActionDown);
      this.on(action, 'pointerup', this.onActionUp);
      this.on(action, 'pointercancel', this.onActionUp);
    }
  }

  protected override onBeforeDestroy(): void {
    this.stopRepeat();
  }

  private _togglePlay(): void {
    this.handlers.togglePlay();
  }

  private on(element: HTMLElement, type: string, handler: (event: PointerEvent) => void): void {
    const listener = (event: Event) => handler.call(this, event as PointerEvent);
    element.addEventListener(type, listener);
    this.eventListeners.push([element, type, listener]);
  }

  private onStickDown(event: PointerEvent): void {
    if (this._stickPointer !== null) return;
    event.preventDefault();
    this._stickPointer = event.pointerId;
    capture(event);
    this.followFinger(event);
  }

  private onStickMove(event: PointerEvent): void {
    if (event.pointerId === this._stickPointer) this.followFinger(event);
  }

  private onStickUp(event: PointerEvent): void {
    if (event.pointerId !== this._stickPointer) return;
    this._stickPointer = null;
    this.setDirection(null);
    this.moveKnob(0, 0);
  }

  // D-pad: each tap is one key press, as fast as the player taps.
  private onCrossDown(event: PointerEvent): void {
    const direction = (event.currentTarget as HTMLElement | null)?.dataset.direction as StickDirection | undefined;
    if (!direction) return;
    event.preventDefault();
    capture(event);
    const code = DIRECTION_CODES[direction];
    this._crossPointers.set(event.pointerId, code);
    this.handlers.press(code);
  }

  private onCrossUp(event: PointerEvent): void {
    const code = this._crossPointers.get(event.pointerId);
    if (!code) return;
    this._crossPointers.delete(event.pointerId);
    this.handlers.release(code);
  }

  private followFinger(event: PointerEvent): void {
    const stick = this.element.querySelector<HTMLElement>('.touch-controls__stick');
    if (!stick) return;
    const rect = stick.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    this.moveKnob(dx, dy);
    this.setDirection(stickDirection(dx, dy, this.config.directions));
  }

  // The knob follows the finger, held inside the base.
  private moveKnob(dx: number, dy: number): void {
    const knob = this.element.querySelector<HTMLElement>('.touch-controls__knob');
    const distance = Math.hypot(dx, dy);
    const scale = distance > STICK_RADIUS ? STICK_RADIUS / distance : 1;
    const [x, y] = [Math.round(dx * scale), Math.round(dy * scale)];
    knob?.style.setProperty('transform', distance ? `translate(${x}px, ${y}px)` : '');
    this.element.querySelector('.touch-controls__stick')?.classList.toggle('touch-controls__stick--active', distance > 0);
  }

  // Key down on entering a direction, key up on leaving it; repeated while held if the game asks.
  private setDirection(direction: StickDirection | null): void {
    if (direction === this._direction) return;
    this.stopRepeat();
    if (this._direction) this.handlers.release(DIRECTION_CODES[this._direction]);
    this._direction = direction;
    if (!direction) return;

    const code = DIRECTION_CODES[direction];
    this.handlers.press(code);
    if (this.config.repeatMs) this._repeat = setInterval(() => this.handlers.press(code), this.config.repeatMs);
  }

  private stopRepeat(): void {
    if (this._repeat !== null) clearInterval(this._repeat);
    this._repeat = null;
  }

  private onActionDown(event: PointerEvent): void {
    const action = this.config.action;
    if (!action || this._actionPointer !== null) return;
    event.preventDefault();
    this._actionPointer = event.pointerId;
    capture(event);
    (event.currentTarget as HTMLElement | null)?.classList.add('touch-controls__action--active');
    this.handlers.press(action.code);
  }

  private onActionUp(event: PointerEvent): void {
    if (event.pointerId === this._actionPointer) this.releaseAction();
  }

  private releaseAction(): void {
    const action = this.config.action;
    if (!action || this._actionPointer === null) return;
    this._actionPointer = null;
    this.element.querySelector('.touch-controls__action')?.classList.remove('touch-controls__action--active');
    this.handlers.release(action.code);
  }
}
