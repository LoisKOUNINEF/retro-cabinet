import { Component, html } from '../../../../core/index.js';
import { ICONS } from '../../../games/icons.js';
import type { CardState } from '../../../games/bonus/matching-pairs/matching-pairs.js';
import type { Sprite } from '../../../games/sprites.js';
import { pixelArt } from '../../pixel-art.js';

export interface MatchingPairsCardItem {
  sprite: Sprite;
  state: CardState;
  label: string;
  // Under the keyboard cursor.
  cursor: boolean;
  disabled: boolean;
  // Turned on this render: plays the turn animation. False on later renders, so a card
  // rebuilt or put back in the page (Safari has no moveBefore()) doesn't play it again.
  turning: boolean;
  onSelect: (index: number) => void;
}

// The catalog adds each item's index.
type IndexedCard = MatchingPairsCardItem & { index: number };

// A face-down card shows a question mark; a turned one, its picture.
const cardFace = (card: IndexedCard) => card.state === 'hidden'
  ? pixelArt(ICONS.random, 'matching-pairs-board__back')
  : pixelArt(card.sprite, 'matching-pairs-board__face');

const templateFn = (card: IndexedCard) => html`__TEMPLATE_PLACEHOLDER__`;

// One card of MatchingPairsBoardComponent: a button turning it.
export class MatchingPairsCardComponent extends Component<HTMLElement, IndexedCard> {
  constructor(mountTarget: HTMLElement, card: IndexedCard) {
    super({ templateFn, mountTarget, config: card, props: { className: 'matching-pairs-board__slot' } });
  }

  private _select(): void {
    this.config.onSelect(this.config.index);
  }
}
