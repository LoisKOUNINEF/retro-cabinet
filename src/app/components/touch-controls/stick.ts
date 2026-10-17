import type { StickDirection } from '../../games/game.js';

// Matches the stick's size in touch-controls.component.scss (112px wide).
export const STICK_RADIUS = 56;
// Below this share of the radius, the stick counts as centred.
const DEAD_ZONE = 0.35;
const TOUCH_CLASS = 'touch';

export const DIRECTION_CODES: Record<StickDirection, string> = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
};

// Where the stick points, given the finger's offset from its centre: the dominant
// axis among the directions the game uses (a left/right stick ignores dy), or null
// inside the dead zone.
export function stickDirection(
  dx: number,
  dy: number,
  allowed: StickDirection[],
  radius = STICK_RADIUS,
): StickDirection | null {
  const horizontal: StickDirection = dx < 0 ? 'left' : 'right';
  const vertical: StickDirection = dy < 0 ? 'up' : 'down';
  const x = allowed.includes(horizontal) ? Math.abs(dx) : 0;
  const y = allowed.includes(vertical) ? Math.abs(dy) : 0;
  if (Math.max(x, y) < radius * DEAD_ZONE) return null;
  return x >= y ? horizontal : vertical;
}

// A finger is the main pointer, or a touch happened during this visit.
export function isTouchDevice(): boolean {
  return document.documentElement.classList.contains(TOUCH_CLASS)
    || (window.matchMedia?.('(pointer: coarse)').matches ?? false);
}

// Flags the page as touch on the first touch (e.g. a laptop with a touchscreen),
// which shows the touch controls from then on. Call once at startup.
export function watchForTouch(): void {
  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return;
    document.documentElement.classList.add(TOUCH_CLASS);
    window.removeEventListener('pointerdown', onPointerDown);
  };
  window.addEventListener('pointerdown', onPointerDown);
}

// Keeps a finger's events on its control even when it slides off. Only a nicety: it can
// fail (a pointer already gone, no support) and must never block the press itself.
export function capture(event: PointerEvent): void {
  try {
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
  } catch {
    // Without capture, the control still works while the finger stays on it.
  }
}

// Pointer events need several listeners per element, where data-event binds one: this adds
// one to a component's eventListeners, which Nutin unbinds on re-render and destroy.
export function listenPointer(
  listeners: Array<[EventTarget, string, EventListener]>,
  element: HTMLElement,
  type: string,
  handler: (event: PointerEvent) => void,
): void {
  const listener = (event: Event) => handler(event as PointerEvent);
  element.addEventListener(type, listener);
  listeners.push([element, type, listener]);
}
