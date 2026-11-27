import { Component, html } from '../../../../core/index.js';
import { CROSS, FLAG, MINE, QUESTION } from '../../../games/bonus/minefield/sprites.js';
import { pixelArt } from '../../pixel-art.js';
import type { MinefieldView } from '../minefield-board.component.js';

export interface MinefieldCell {
  view: MinefieldView;
  count: number;
  label: string;
  // Under the keyboard cursor.
  cursor: boolean;
  disabled: boolean;
  onDig: (index: number) => void;
  onFlag: (index: number) => void;
}

// A press held this long flags the cell, for touch screens.
export const LONG_PRESS_MS = 450;

// The catalog adds each item's index.
type IndexedCell = MinefieldCell & { index: number };

function content({ view, count }: IndexedCell) {
  switch (view) {
    case 'open': return count ? html`<span class="minefield__count">${count}</span>` : '';
    case 'flag': return pixelArt(FLAG, 'minefield__art minefield__art--flag');
    case 'question': return pixelArt(QUESTION, 'minefield__art');
    case 'mine':
    case 'exploded': return pixelArt(MINE, 'minefield__art minefield__art--mine');
    case 'wrong': return pixelArt(CROSS, 'minefield__art minefield__art--wrong');
    default: return '';
  }
}

const templateFn = (cell: IndexedCell) => html`__TEMPLATE_PLACEHOLDER__`;

// One cell of MinefieldBoardComponent: a click digs it, a right-click or a long press flags it.
export class MinefieldCellComponent extends Component<HTMLElement, IndexedCell> {
  private _pressTimer: ReturnType<typeof setTimeout> | null = null;
  // A long press flagged the cell: the click that ends it, or the context menu, does nothing more.
  private _pressed = false;

  constructor(mountTarget: HTMLElement, cell: IndexedCell) {
    super({ templateFn, mountTarget, config: cell, props: { className: 'minefield__slot' } });
  }

  protected override onAfterRender(): void {
    super.onAfterRender();
    const button = this.element.querySelector('button');
    if (!button) return;
    const cancel = () => this.cancelPress();
    const listeners: [string, EventListener][] = [
      ['pointerdown', (event) => this.startPress(event as PointerEvent)],
      ['pointerup', cancel],
      ['pointercancel', cancel],
      ['pointerleave', cancel],
      ['contextmenu', (event) => this.onContextMenu(event)],
    ];
    listeners.forEach(([name, listener]) => {
      button.addEventListener(name, listener);
      this.eventListeners.push([button, name, listener]);
    });
  }

  protected override onBeforeDestroy(): void {
    this.cancelPress();
  }

  protected _dig(): void {
    if (this._pressed) {
      this._pressed = false;
      return;
    }
    this.config.onDig(this.config.index);
  }

  private startPress(event: PointerEvent): void {
    // The mouse has its right button for flags.
    if (event.pointerType === 'mouse' || this.config.disabled) return;
    this.cancelPress();
    this._pressed = false;
    this._pressTimer = setTimeout(() => {
      this._pressTimer = null;
      this._pressed = true;
      this.config.onFlag(this.config.index);
    }, LONG_PRESS_MS);
  }

  private cancelPress(): void {
    if (this._pressTimer !== null) clearTimeout(this._pressTimer);
    this._pressTimer = null;
  }

  private onContextMenu(event: Event): void {
    event.preventDefault();
    this.cancelPress();
    // After a long press (touch screens open the menu too): already flagged.
    if (this._pressed || this.config.disabled) return;
    this.config.onFlag(this.config.index);
  }
}
