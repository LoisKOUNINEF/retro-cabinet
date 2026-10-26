import { html } from '../../../core/index.js';
import { UpdatableComponent } from '../updatable-component.js';

export interface PlayToggleState {
  running: boolean;
}

const templateFn = (state: PlayToggleState) => html`__TEMPLATE_PLACEHOLDER__`;

// The touch screens' play/pause button, in the game's header: shows what a tap does next
// (⏸ while playing, ▶ otherwise). Keyboards have Space instead.
export class PlayToggleComponent extends UpdatableComponent<PlayToggleState> {
  constructor(mountTarget: HTMLElement, state: PlayToggleState, private readonly onToggle: () => void) {
    super({ templateFn, mountTarget, config: state });
  }

  protected override fallbackFocus(): HTMLElement | null {
    return this.element.querySelector<HTMLElement>('.play-toggle');
  }

  private _toggle(): void {
    this.onToggle();
  }
}
