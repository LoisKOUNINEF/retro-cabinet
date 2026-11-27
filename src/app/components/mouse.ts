import type { MouseButton } from '../games/game.js';
import { capture } from './touch-controls/stick.js';

// What a board hands the mouse to, in board units (cells or canvas pixels).
export interface MouseHandlers {
  move(x: number, y: number): void;
  down(button: MouseButton, x: number, y: number): void;
  // The pressed button let go; null when the press was cancelled (every button let go).
  up(button: MouseButton | null): void;
}

const BUTTONS: Record<number, MouseButton | undefined> = { 0: 'left', 2: 'right' };

// Mouse controls on a board element: moves and presses, converted from client coordinates
// to board units. A press is captured, so its release counts even off the board (and the
// mouse is followed there, at a position past the edge). Touch and pen are left out, so a tap on the board still does nothing.
// The context menu is suppressed, so right click can play. Each listener is added to a
// component's eventListeners, which Nutin unbinds on re-render and destroy.
export function listenMouse(
  listeners: Array<[EventTarget, string, EventListener]>,
  element: HTMLElement,
  { width, height }: { width: number; height: number },
  handlers: MouseHandlers,
): void {
  const toBoard = (event: PointerEvent) => {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.width ? ((event.clientX - rect.left) / rect.width) * width : 0,
      y: rect.height ? ((event.clientY - rect.top) / rect.height) * height : 0,
    };
  };
  const on = (type: string, listener: (event: Event) => void) => {
    element.addEventListener(type, listener);
    listeners.push([element, type, listener]);
  };

  on('pointermove', (event) => {
    const pointer = event as PointerEvent;
    if (pointer.pointerType !== 'mouse') return;
    const { x, y } = toBoard(pointer);
    handlers.move(x, y);
  });
  on('pointerdown', (event) => {
    const pointer = event as PointerEvent;
    const button = BUTTONS[pointer.button];
    if (pointer.pointerType !== 'mouse' || !button) return;
    // No text selection or focus change from clicking on the board.
    pointer.preventDefault();
    capture(pointer);
    const { x, y } = toBoard(pointer);
    handlers.down(button, x, y);
  });
  on('pointerup', (event) => {
    const pointer = event as PointerEvent;
    const button = BUTTONS[pointer.button];
    if (pointer.pointerType === 'mouse' && button) handlers.up(button);
  });
  on('pointercancel', (event) => {
    if ((event as PointerEvent).pointerType === 'mouse') handlers.up(null);
  });
  on('contextmenu', (event) => event.preventDefault());
}
