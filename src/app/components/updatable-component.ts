import { Component } from '../../core/index.js';

// Same value, or arrays holding the same values (shallow-compared items, e.g. catalog rows).
function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((item, i) => Object.is(item, b[i]) || shallowEqual(item, b[i]));
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return Object.is(a, b);
  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const keys = Object.keys(aRecord);
  return keys.length === Object.keys(bRecord).length && keys.every((key) => sameValue(aRecord[key], bRecord[key]));
}

// A component its parent refreshes through update(), e.g. on every game tick.
// It only re-renders when its config changed, so its DOM (a button under the pointer,
// a catalog row) is left alone otherwise; catalogs with keepBy then rebuild only the
// items that changed. The focused control keeps the focus across a re-render: mark
// focusable elements with data-focus-key.
export abstract class UpdatableComponent<T extends object> extends Component<HTMLElement, T> {
  update(config: T): void {
    if (shallowEqual(this.config, config)) return;
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
