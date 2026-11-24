import { Component, html } from '../../../../core/index.js';
import { HAND_NAMES, HAND_SPRITES, type Hand } from '../../../games/bonus/rpsls/hands.js';
import { pixelArt } from '../../pixel-art.js';

export interface RpslsHand {
  hand: Hand;
  // Its number key.
  key: number;
  // Under the keyboard cursor.
  cursor: boolean;
  disabled: boolean;
  onSelect: (index: number) => void;
}

// The catalog adds each item's index.
type IndexedHand = RpslsHand & { index: number };

const templateFn = (hand: IndexedHand) => html`__TEMPLATE_PLACEHOLDER__`;

const art = (hand: Hand) => pixelArt(HAND_SPRITES[hand], 'rpsls-board__art');
const name = (hand: Hand) => HAND_NAMES[hand];

// One hand of RpslsBoardComponent: a button showing it.
export class RpslsHandComponent extends Component<HTMLElement, IndexedHand> {
  constructor(mountTarget: HTMLElement, hand: IndexedHand) {
    super({ templateFn, mountTarget, config: hand, props: { className: 'rpsls-board__slot' } });
  }

  private _select(): void {
    this.config.onSelect(this.config.index);
  }
}
