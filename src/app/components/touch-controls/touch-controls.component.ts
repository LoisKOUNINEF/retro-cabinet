import { Component, html } from '../../../core/index.js';
import type { StickDirection, TouchLayout } from '../../games/game.js';
import { CrossButtonComponent, type CrossButton } from './cross-button/cross-button.component.js';
import { DIRECTION_CODES, STICK_RADIUS, capture, listenPointer, stickDirection } from './stick.js';

export interface TouchHandlers {
  press(code: string): void;
  release(code: string): void;
}

const ARROWS: Record<StickDirection, string> = { up: '▲', down: '▼', left: '◀', right: '▶' };

// The right-thumb button: the game's action, unless it sits on the D-pad.
const sideButton = (layout: TouchLayout) => (layout.action?.onPad ? undefined : layout.action);

const templateFn = (layout: TouchLayout, button = sideButton(layout)) => html`__TEMPLATE_PLACEHOLDER__`;

// A D-pad or a virtual stick (left thumb) and an optional action button (right thumb), or the
// pad alone, centred. They send the same key codes as the keyboard: games don't know the difference.
// Each control follows its own finger, so moving and firing work at the same time.
export class TouchControlsComponent extends Component<HTMLElement, TouchLayout> {
  private _stickPointer: number | null = null;
  private _direction: StickDirection | null = null;
  private _repeat: ReturnType<typeof setInterval> | null = null;
  private _actionPointer: number | null = null;
  // Auto-fire is holding the action key down.
  private _firing = false;
  // Keys the D-pad buttons hold down, so a pause can release them.
  private readonly _crossHeld = new Set<string>();
  // Held D-pad keys re-sent every repeatMs, when the game asks.
  private readonly _crossRepeats = new Map<string, ReturnType<typeof setInterval>>();
  // Passed to every D-pad button as is, so the catalog keeps them.
  private readonly crossPress = (code: string): void => {
    this._crossHeld.add(code);
    this.handlers.press(code);
    // Only directions repeat: a held Rotate turns the piece once.
    const { repeatMs, directions } = this.config;
    const isDirection = directions.some((direction) => DIRECTION_CODES[direction] === code);
    if (repeatMs && isDirection && !this._crossRepeats.has(code)) {
      this._crossRepeats.set(code, setInterval(() => this.handlers.press(code), repeatMs));
    }
  };
  private readonly crossRelease = (code: string): void => {
    this.stopCrossRepeat(code);
    // Already released by a reset: the finger only lifts now.
    if (this._crossHeld.delete(code)) this.handlers.release(code);
  };

  constructor(mountTarget: HTMLElement, layout: TouchLayout, private readonly handlers: TouchHandlers) {
    super({ templateFn, mountTarget, config: layout });
  }

  // Called when the game starts or resumes: auto-fire starts firing, unless the button is held.
  resume(): void {
    const action = this.config.action;
    if (!this.config.autoFire || !action || this._actionPointer !== null) return;
    // Pressed again even if already firing: a press made while paused never reached the game.
    this._firing = true;
    this.handlers.press(action.code);
  }

  // Lets go of everything: called when the game pauses, so no key stays held.
  reset(): void {
    this._stickPointer = null;
    this.setDirection(null);
    this.moveKnob(0, 0);
    this.releaseAction();
    this.ceaseFire();
    this._crossRepeats.forEach((_, code) => this.stopCrossRepeat(code));
    this._crossHeld.forEach((code) => this.handlers.release(code));
    this._crossHeld.clear();
  }

  override registerChildren(): Nutin.ComponentConfig[] {
    const { pad, directions, action } = this.config;
    if (pad === 'stick') return [];
    const buttons = directions.map((direction): CrossButton => ({
      direction, code: DIRECTION_CODES[direction], label: ARROWS[direction], name: direction, press: this.crossPress, release: this.crossRelease,
    }));
    if (action?.onPad) buttons.push({
      direction: 'up', code: action.code, label: action.label, name: action.label, isAction: true, press: this.crossPress, release: this.crossRelease,
    });
    return this.createCatalogComponents({
      items: buttons,
      selector: 'cross',
      elementName: 'cross-button',
      component: CrossButtonComponent,
      keepBy: (button: CrossButton) => button.direction,
    });
  }

  protected override onAfterRender(): void {
    super.onAfterRender();
    // The D-pad buttons bind their own (CrossButtonComponent).
    const stick = this.element.querySelector<HTMLElement>('.touch-controls__stick');
    const action = this.element.querySelector<HTMLElement>('.touch-controls__action');
    if (stick) {
      this.on(stick, 'pointerdown', this.onStickDown);
      this.on(stick, 'pointermove', this.onStickMove);
      this.on(stick, 'pointerup', this.onStickUp);
      this.on(stick, 'pointercancel', this.onStickUp);
    }
    if (action) {
      this.on(action, 'pointerdown', this.onActionDown);
      this.on(action, 'pointerup', this.onActionUp);
      this.on(action, 'pointercancel', this.onActionUp);
    }
  }

  protected override onBeforeDestroy(): void {
    this.stopRepeat();
    this._crossRepeats.forEach((_, code) => this.stopCrossRepeat(code));
  }

  private on(element: HTMLElement, type: string, handler: (event: PointerEvent) => void): void {
    listenPointer(this.eventListeners, element, type, (event) => handler.call(this, event));
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

  private stopCrossRepeat(code: string): void {
    clearInterval(this._crossRepeats.get(code));
    this._crossRepeats.delete(code);
  }

  private onActionDown(event: PointerEvent): void {
    const action = this.config.action;
    if (!action || this._actionPointer !== null) return;
    event.preventDefault();
    this._actionPointer = event.pointerId;
    capture(event);
    (event.currentTarget as HTMLElement | null)?.classList.add('touch-controls__action--active');
    // With auto-fire, holding the button holds fire.
    if (this.config.autoFire) this.ceaseFire();
    else this.handlers.press(action.code);
  }

  private onActionUp(event: PointerEvent): void {
    if (event.pointerId !== this._actionPointer) return;
    this.releaseAction();
    this.resume();
  }

  // The finger leaves the button; without auto-fire, its key goes up with it.
  private releaseAction(): void {
    const action = this.config.action;
    if (!action || this._actionPointer === null) return;
    this._actionPointer = null;
    this.element.querySelector('.touch-controls__action')?.classList.remove('touch-controls__action--active');
    if (!this.config.autoFire) this.handlers.release(action.code);
  }

  private ceaseFire(): void {
    const action = this.config.action;
    if (!action || !this._firing) return;
    this._firing = false;
    this.handlers.release(action.code);
  }
}
