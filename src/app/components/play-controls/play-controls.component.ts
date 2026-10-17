import { Component, html } from '../../../core/index.js';
import type { KeyHint } from '../../games/game.js';
import { describeKeys } from '../key-labels.js';

// What the Play section shows: the play/pause label, the status line, and whether
// there is a game New game would drop.
export interface PlayState {
  label: string;
  status: string;
  over: boolean;
  canStartOver: boolean;
}

export interface PlayHandlers {
  togglePlay(): void;
  newGame(): void;
}

const templateFn = (state: PlayState, keys: string | null) => html`__TEMPLATE_PLACEHOLDER__`;

// The play/pause and New game buttons, the key hints and the status.
// It only re-renders when what it shows changes: the game ticks many times a second,
// and rewriting the buttons under the pointer would swallow clicks (WebKit drops a click
// whose pressed node is gone).
export class PlayControlsComponent extends Component<HTMLElement, PlayState> {
  // Key hints, once the keyboard layout has answered; "" while waiting.
  private _keys: string | null;

  constructor(mountTarget: HTMLElement, state: PlayState, private readonly handlers: PlayHandlers, hints?: KeyHint[]) {
    super({ templateFn: (config: PlayState) => templateFn(config, this._keys), mountTarget, config: state });
    this._keys = hints ? '' : null;
    // Labels can depend on the keyboard layout, which the browser reports asynchronously.
    if (hints) describeKeys(hints).then((text) => {
      this._keys = text;
      const element = this.element?.querySelector('.game__keys');
      if (element) element.textContent = text;
    });
  }

  update(state: PlayState): void {
    const current = this.config;
    const same = (Object.keys(state) as (keyof PlayState)[]).every((key) => state[key] === current[key]);
    if (same) return;
    // Keyboard players keep their place: a re-render rebuilds the focused button.
    const focused = this.element?.contains(document.activeElement) ? document.activeElement : null;
    this.config = state;
    this.render();
    if (focused) this.refocus(focused);
  }

  // The same button again, or the play button when New game just went away.
  private refocus(previous: Element): void {
    const same = previous.classList.contains('game__new') ? '.game__new:not([hidden])' : '.game__toggle';
    const target = this.element?.querySelector<HTMLElement>(same) ?? this.element?.querySelector<HTMLElement>('.game__toggle');
    target?.focus();
  }

  private _togglePlay(): void {
    this.handlers.togglePlay();
  }

  private _newGame(): void {
    this.handlers.newGame();
  }
}
