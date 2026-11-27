import { html, nutinIf } from '../../../core/index.js';
import type { KeyHint } from '../../games/game.js';
import { describeKeys } from '../key-labels.js';
import { isTouchDevice } from '../touch-controls/stick.js';
import { UpdatableComponent } from '../updatable-component.js';
import { ListPopover } from '../list-popover/list-popover.js';

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

// What the Rules and Controls buttons list: the game's rules, its keys and its mouse controls.
export interface PlayInfo {
  rules?: string[];
  keyHints?: KeyHint[];
  // Follows the key hints, except on touch devices.
  mouseHint?: string;
  // Follow the key hints on every device (the caller picks the mouse or touch wording).
  clickHints?: string[];
}

// A Rules or Controls button: shown when there are lines to list, and the popover it opens.
interface InfoButton {
  shown: boolean;
  id: string;
  open: boolean;
}

const templateFn = (state: PlayState, info: { rules: InfoButton; controls: InfoButton }) => html`__TEMPLATE_PLACEHOLDER__`;

// Each instance's popovers get their own ids: a recreated component never clashes with the old one's.
let popoverCount = 0;

const infoButton = (popover: ListPopover): InfoButton => ({ shown: popover.lines.length > 0, id: popover.id, open: popover.open });

// The play/pause and New game buttons, the Rules and Controls buttons and the status.
// The game ticks many times a second: re-rendering only on change keeps the buttons
// under the pointer, as WebKit drops a click whose pressed node is gone.
export class PlayControlsComponent extends UpdatableComponent<PlayState> {
  // In <body>, as every overlay: removed in onBeforeDestroy.
  private readonly _rules: ListPopover;
  // Key hints, once the keyboard layout has answered; empty until then (no Controls button).
  private readonly _controls: ListPopover;

  constructor(mountTarget: HTMLElement, state: PlayState, private readonly handlers: PlayHandlers, { rules = [], keyHints, mouseHint, clickHints = [] }: PlayInfo = {}) {
    super({
      templateFn: (config: PlayState) => templateFn(config, { rules: infoButton(this._rules), controls: infoButton(this._controls) }),
      mountTarget,
      config: state,
    });
    const n = ++popoverCount;
    this._rules = new ListPopover(`game-rules-${n}`, 'Rules', () => this.button('.game__rules'));
    this._controls = new ListPopover(`game-controls-${n}`, 'Controls', () => this.button('.game__controls'));
    this._rules.lines = rules;
    const pointer = [...(mouseHint && !isTouchDevice() ? [mouseHint] : []), ...clickHints];
    this._controls.lines = keyHints ? [] : pointer;
    // Labels can depend on the keyboard layout, which the browser reports asynchronously.
    if (keyHints) describeKeys(keyHints).then((lines) => {
      if (this.isDestroyed) return;
      this._controls.lines = [...lines, ...pointer];
      if (this.element.isConnected) this.refresh();
    });
  }

  protected override onAfterRender(): void {
    super.onAfterRender();
    // A new render has new buttons: the popovers follow them.
    this._rules.anchor();
    this._controls.anchor();
  }

  protected override onBeforeDestroy(): void {
    this._rules.remove();
    this._controls.remove();
  }

  private button(selector: string): HTMLElement | null {
    return this.element.querySelector<HTMLElement>(selector);
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

  // One popover at a time: opening one closes the other.
  protected _toggleRules(): void {
    this._controls.close();
    this._rules.toggle();
  }

  protected _toggleControls(): void {
    this._rules.close();
    this._controls.toggle();
  }
}
