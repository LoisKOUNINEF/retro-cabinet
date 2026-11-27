import { Component, html, nutinFor } from '../../../core/index.js';
import { ALIEN_SPRITES, UFO } from '../../games/alien-attack/sprites.js';
import { HOLE_KEYS, type HoleState, type Target } from '../../games/bonus/alien-smash/alien-smash.js';
import type { Sprite } from '../../games/sprites.js';
import { AlienSmashHoleComponent, type AlienSmashHole } from './alien-smash-hole/alien-smash-hole.component.js';

export interface AlienSmashBoardConfig {
  holes: { target: Target | null; state: HoleState; points: number }[];
  // The keyboard cursor's hole.
  cursor: number;
  // The clock runs: smashes count.
  active: boolean;
}

// Each target's two animation frames (the UFO has one).
const FRAMES: Record<Target, readonly [Sprite, Sprite]> = { ...ALIEN_SPRITES, ufo: [UFO, UFO] };
const NAMES: Record<Target, string> = { squid: 'squid', crab: 'crab', octopus: 'octopus', ufo: 'UFO' };

// "Hole 7: squid, 30 points", named after its number key.
function holeLabel(index: number, target: Target | null, state: HoleState, points: number): string {
  const name = `Hole ${HOLE_KEYS[index]}`;
  if (!target) return `${name}: empty`;
  if (state === 'hit') return `${name}: hit, ${points} points`;
  return state === 'leaving' ? `${name}: ${NAMES[target]} going back down` : `${name}: ${NAMES[target]}, ${points} points`;
}

const templateFn = () => html`__TEMPLATE_PLACEHOLDER__`;

// Nine holes, rendered once and kept: update() hands each hole its own config, and a hole only
// rebuilds when its alien changes (which restarts its animation). The board itself never
// re-renders: it updates on every tick, so it patches its holes instead.
// A smash counts on the press (pointerdown), not the release: an alien leaving between the two
// rebuilds its hole, and a click whose pressed button is gone never fires.
export class AlienSmashBoardComponent extends Component<HTMLElement, AlienSmashBoardConfig> {
  private readonly _holes: AlienSmashHoleComponent[] = [];

  constructor(
    mountTarget: HTMLElement,
    config: AlienSmashBoardConfig,
    // Passed to every hole as is, so unchanged holes stay equal and are kept.
    private readonly onSelect: (index: number) => void,
  ) {
    super({ templateFn, mountTarget, config });
  }

  protected override onAfterRender(): void {
    super.onAfterRender();
    // On the board's own element, which lasts across renders: the holes inside come and go.
    this.eventListeners.push([this.element, 'pointerdown', this._onPointerDown]);
    this.element.addEventListener('pointerdown', this._onPointerDown);
  }

  private readonly _onPointerDown = (event: Event): void => {
    // The main button (or a touch, or a pen) only.
    if ((event as PointerEvent).button > 0) return;
    const hole = (event.target as Element | null)?.closest<HTMLButtonElement>('.alien-smash-board__hole');
    if (!hole || hole.disabled) return;
    this.onSelect(Number(hole.dataset['index']));
  };

  update(config: AlienSmashBoardConfig): void {
    this.config = config;
    this._holes.forEach((hole, index) => hole.update(this.holeConfig(index)));
  }

  // One placeholder per hole (nutinFor in the template), all mounted by this factory: each
  // placeholder carries its hole's index. The holes never move, so keeping by position is right.
  override registerChildren(): Nutin.ComponentConfig[] {
    return [{
      selector: 'hole',
      keep: 'hole',
      factory: (el: HTMLElement) => {
        const index = Number(el.dataset['hole']);
        return (this._holes[index] = new AlienSmashHoleComponent(el, this.holeConfig(index)));
      },
    }];
  }

  private holeConfig(index: number): AlienSmashHole {
    const { holes, cursor, active } = this.config;
    const { target, state, points } = holes[index]!;
    return {
      index,
      key: HOLE_KEYS[index] ?? index + 1,
      target,
      // The same frames every time: an unchanged hole stays equal.
      frames: target ? FRAMES[target] : null,
      state,
      points,
      label: holeLabel(index, target, state, points),
      cursor: index === cursor,
      disabled: !active,
      onSelect: this.onSelect,
    };
  }
}
