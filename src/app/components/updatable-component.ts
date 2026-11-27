import { Component } from '../../core/index.js';

// Plain data: arrays and object literals. Anything else (class instances, Maps…) is compared by reference.
function isPlainData(value: unknown): value is Record<string, unknown> {
  if (Array.isArray(value)) return true;
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// Equal configs, whatever their depth. Parents rebuild their children's configs on every update
// (e.g. board.config(game) on each tick), so nested arrays and objects are new each time: comparing
// them by reference, as core's catalogs do for one level, would re-render on every update.
// Each level follows core's shallowEqual (children.helper.ts, not exported): an array only equals
// an array, the same own keys, and Object.is for everything else (callbacks by reference).
function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!isPlainData(a) || !isPlainData(b) || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length
    && keys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && sameValue(a[key], b[key]));
}

// A component its parent refreshes through update(), e.g. on every game tick.
// It only re-renders when its config changed, so its DOM (a button under the pointer,
// a catalog row) is left alone otherwise; catalogs with keepBy then rebuild only the
// items that changed. The focused control keeps the focus across a re-render: mark
// focusable elements with data-focus-key.
export abstract class UpdatableComponent<T extends object> extends Component<HTMLElement, T> {
  update(config: T): void {
    if (sameValue(this.config, config)) return;
    this.config = config;
    this.refresh();
  }

  // Re-renders, keeping the focus where it was.
  protected refresh(): void {
    const key = this.focusedKey();
    this.render();
    if (key === null || this.element.contains(document.activeElement)) return;
    const same = this.element.querySelector<HTMLElement>(`[data-focus-key="${key}"]`);
    (same && isFocusable(same) ? same : this.fallbackFocus())?.focus();
  }

  // Where the focus goes when the focused control is gone or disabled; nowhere by default.
  protected fallbackFocus(): HTMLElement | null {
    return null;
  }

  private focusedKey(): string | null {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !this.element.contains(active)) return null;
    return active.closest<HTMLElement>('[data-focus-key]')?.dataset.focusKey ?? null;
  }
}

function isFocusable(element: HTMLElement): boolean {
  return !element.hidden && !element.matches(':disabled');
}
