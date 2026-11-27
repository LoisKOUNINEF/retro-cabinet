import { Component, html } from '../../../../core/index.js';
import { seedSprite } from '../../../games/bonus/wari/seeds.js';
import { pixelArt } from '../../pixel-art.js';

export interface WariPit {
  seeds: number;
  // Under the keyboard cursor.
  cursor: boolean;
  disabled: boolean;
  // The last seed sown went in here.
  sown: boolean;
  // About to be taken.
  capturing: boolean;
  onSelect: (index: number) => void;
}

// The catalog adds each item's index.
type IndexedPit = WariPit & { index: number };

export const seedsLabel = (seeds: number) => `${seeds} ${seeds === 1 ? 'seed' : 'seeds'}`;

const pitClass = (pit: IndexedPit) =>
  `${pit.cursor ? ' wari__pit--cursor' : ''}${pit.sown ? ' wari__pit--sown' : ''}${pit.capturing ? ' wari__pit--capturing' : ''}`;

const templateFn = (pit: IndexedPit) => html`__TEMPLATE_PLACEHOLDER__`;

// One of the player's pits in WariBoardComponent: a button sowing it.
export class WariPitComponent extends Component<HTMLElement, IndexedPit> {
  constructor(mountTarget: HTMLElement, pit: IndexedPit) {
    super({ templateFn, mountTarget, config: pit, props: { className: 'wari__slot' } });
  }

  protected _select(): void {
    this.config.onSelect(this.config.index);
  }
}
