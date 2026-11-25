import { html } from '../../../../core/index.js';
import type { HoleState, Target } from '../../../games/bonus/alien-smash/alien-smash.js';
import { EXPLOSION } from '../../../games/bonus/alien-smash/sprites.js';
import type { Sprite } from '../../../games/sprites.js';
import { pixelArt } from '../../pixel-art.js';
import { UpdatableComponent } from '../../updatable-component.js';

export interface AlienSmashHole {
  index: number;
  // Its number key (numpad layout).
  key: number;
  target: Target | null;
  frames: readonly [Sprite, Sprite] | null;
  state: HoleState;
  points: number;
  label: string;
  // Under the keyboard cursor.
  cursor: boolean;
  disabled: boolean;
  onSelect: (index: number) => void;
}

// What's up in the hole: an alien (its two frames, swapped by CSS), or its explosion and points.
// Inside the well, whose bottom edge is the pit's: an alien rises out of it and sinks back into it.
function holeContent(hole: AlienSmashHole) {
  if (hole.state === 'hit') {
    return html`<span class="alien-smash-board__well">${pixelArt(EXPLOSION, 'alien-smash-board__explosion')}</span><span class="alien-smash-board__points">+${hole.points}</span>`;
  }
  if (!hole.frames) return '';
  const [first, second] = hole.frames;
  return html`<span class="alien-smash-board__well"><span class="alien-smash-board__target alien-smash-board__target--${hole.target} alien-smash-board__target--${hole.state}">${pixelArt(first, 'alien-smash-board__frame')}${pixelArt(second, 'alien-smash-board__frame alien-smash-board__frame--second')}</span></span>`;
}

const templateFn = (hole: AlienSmashHole) => html`__TEMPLATE_PLACEHOLDER__`;

// One hole of AlienSmashBoardComponent: a button smashing whatever is up in it.
export class AlienSmashHoleComponent extends UpdatableComponent<AlienSmashHole> {
  constructor(mountTarget: HTMLElement, hole: AlienSmashHole) {
    super({ templateFn, mountTarget, config: hole, props: { className: 'alien-smash-board__slot' } });
  }

  // Only a change of alien (popped up, hit, sinking, gone) rebuilds the hole, and restarts its animation.
  // The cursor and the clock patch the button in place: an alien already up keeps rising or marching.
  override update(hole: AlienSmashHole): void {
    const { target, state, points } = this.config;
    if (hole.target !== target || hole.state !== state || hole.points !== points) return super.update(hole);
    this.config = hole;
    const button = this.element.querySelector<HTMLButtonElement>('.alien-smash-board__hole');
    if (!button) return;
    button.classList.toggle('alien-smash-board__hole--cursor', hole.cursor);
    button.disabled = hole.disabled;
  }

  // Mouse, touch and pen smashes are taken on the press, by the board (detail > 0 on their click);
  // this click is the keyboard's or an assistive technology's (detail 0).
  private _select(event: MouseEvent): void {
    if (event.detail > 0) return;
    this.config.onSelect(this.config.index);
  }
}
