import { html } from '../../../core/index.js';
import type { KeyHint } from '../../games/game.js';
import { describeKeys } from '../key-labels.js';
import { UpdatableComponent } from '../updatable-component.js';

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

const templateFn = (state: PlayState, keys: string) => html`__TEMPLATE_PLACEHOLDER__`;

// The play/pause and New game buttons, the key hints and the status.
// The game ticks many times a second: re-rendering only on change keeps the buttons
// under the pointer, as WebKit drops a click whose pressed node is gone.
export class PlayControlsComponent extends UpdatableComponent<PlayState> {
  // Key hints, once the keyboard layout has answered; empty until then (no paragraph).
  private _keys = '';

  constructor(mountTarget: HTMLElement, state: PlayState, private readonly handlers: PlayHandlers, hints?: KeyHint[]) {
    super({ templateFn: (config: PlayState) => templateFn(config, this._keys), mountTarget, config: state });
    // Labels can depend on the keyboard layout, which the browser reports asynchronously.
    if (hints) describeKeys(hints).then((text) => {
      this._keys = text;
      if (this.element.isConnected) this.refresh();
    });
  }

  // New game just went away: back to the main button.
  protected override fallbackFocus(): HTMLElement | null {
    return this.element.querySelector<HTMLElement>('.game__toggle');
  }

  private _togglePlay(): void {
    this.handlers.togglePlay();
  }

  private _newGame(): void {
    this.handlers.newGame?.();
  }
}
