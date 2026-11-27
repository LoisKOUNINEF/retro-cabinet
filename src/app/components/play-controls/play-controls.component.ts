import { html, nutinIf } from '../../../core/index.js';
import type { KeyHint } from '../../games/game.js';
import { describeKeys } from '../key-labels.js';
import { isTouchDevice } from '../touch-controls/stick.js';
import { UpdatableComponent } from '../updatable-component.js';
import { createControlsPopover, setControlsLines } from '../controls-popover/controls-popover.js';
import type { PopoverElement } from 'a11y-elements/overlays/popover/element';

// What the Play section shows: the main button's label, the status line, and whether
// there is a game New game would drop.
export interface PlayState {
  label: string;
  status: string;
  over: boolean;
  canStartOver: boolean;
  // New game is disabled while playing: pause first.
  running: boolean;
}

export interface PlayHandlers {
  togglePlay(): void;
  // Only needed where New game can show (canStartOver).
  newGame?(): void;
}

// The Controls button: shown once there are controls to list, and the popover it opens.
interface ControlsButton {
  shown: boolean;
  id: string;
  open: boolean;
}

const templateFn = (state: PlayState, controls: ControlsButton) => html`__TEMPLATE_PLACEHOLDER__`;

// Each instance's popover gets its own id: a recreated component never clashes with the old one's.
let popoverCount = 0;

// The play/pause and New game buttons, the Controls button (key and mouse hints) and the status.
// The game ticks many times a second: re-rendering only on change keeps the buttons
// under the pointer, as WebKit drops a click whose pressed node is gone.
export class PlayControlsComponent extends UpdatableComponent<PlayState> {
  // Key hints, once the keyboard layout has answered; empty until then (no Controls button).
  private _lines: string[] = [];
  // In <body>, as every overlay: removed in onBeforeDestroy.
  private readonly _popover: PopoverElement = createControlsPopover(`game-controls-${++popoverCount}`);
  // Escape or a click outside closes the popover too: the button follows.
  private readonly _onPopoverToggle = (): void => {
    this.controlsButton()?.setAttribute('aria-expanded', String(this._popover.open));
  };

  // mouseHint follows the key hints, except on touch devices.
  constructor(mountTarget: HTMLElement, state: PlayState, private readonly handlers: PlayHandlers, hints?: KeyHint[], mouseHint?: string) {
    super({
      templateFn: (config: PlayState) => templateFn(config, { shown: this._lines.length > 0, id: this._popover.id, open: this._popover.open }),
      mountTarget,
      config: state,
    });
    this._popover.addEventListener('a11y-overlay-open', this._onPopoverToggle);
    this._popover.addEventListener('a11y-overlay-close', this._onPopoverToggle);
    const mouse = mouseHint && !isTouchDevice() ? [mouseHint] : [];
    this.setLines(hints ? [] : mouse);
    // Labels can depend on the keyboard layout, which the browser reports asynchronously.
    if (hints) describeKeys(hints).then((lines) => {
      if (this.isDestroyed) return;
      this.setLines([...lines, ...mouse]);
      if (this.element.isConnected) this.refresh();
    });
  }

  protected override onAfterRender(): void {
    super.onAfterRender();
    // A new render has a new button: the popover follows it.
    this._popover.anchorElement = this.controlsButton();
  }

  protected override onBeforeDestroy(): void {
    this._popover.remove();
  }

  private setLines(lines: string[]): void {
    this._lines = lines;
    setControlsLines(this._popover, lines);
  }

  private controlsButton(): HTMLElement | null {
    return this.element.querySelector<HTMLElement>('.game__controls');
  }

  // New game just went away: back to the main button.
  protected override fallbackFocus(): HTMLElement | null {
    return this.element.querySelector<HTMLElement>('.game__toggle');
  }

  protected _togglePlay(): void {
    this.handlers.togglePlay();
  }

  protected _newGame(): void {
    this.handlers.newGame?.();
  }

  protected _toggleControls(): void {
    this._popover.open = !this._popover.open;
    this._onPopoverToggle();
  }
}
