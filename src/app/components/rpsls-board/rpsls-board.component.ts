import { html, nutinFor } from '../../../core/index.js';
import { ICONS } from '../../games/icons.js';
import { BEATS, HANDS, HAND_NAMES, HAND_SPRITES, type Hand } from '../../games/bonus/rpsls/hands.js';
import type { Phase, Side } from '../../games/bonus/rpsls/rpsls.js';
import { pixelArt } from '../pixel-art.js';
import { UpdatableComponent } from '../updatable-component.js';
import { RpslsHandComponent, type RpslsHand } from './rpsls-hand/rpsls-hand.component.js';

export interface RpslsBoardConfig {
  player: Hand | null;
  ai: Hand | null;
  phase: Phase;
  roundWinner: Side | null;
  // The keyboard cursor's hand.
  cursor: number;
  // No hand can be shown (the AI is about to reveal, or the match is over).
  locked: boolean;
}

// Who beats whom, as lines: "Scissors cuts Paper".
const RULES = HANDS.flatMap((winner) => Object.entries(BEATS[winner]).map(([loser, verb]) => `${HAND_NAMES[winner]} ${verb} ${HAND_NAMES[loser as Hand]}`));

// One side of the duel: its hand, or a shaking question mark until it's shown.
function side(label: string, hand: Hand | null, shaking: boolean, outcome: 'win' | 'lose' | 'draw' | null) {
  const art = hand && !shaking ? pixelArt(HAND_SPRITES[hand], 'rpsls-board__art') : pixelArt(ICONS.random, 'rpsls-board__art rpsls-board__art--unknown');
  const name = hand && !shaking ? HAND_NAMES[hand] : '?';
  return html`
    <figure class="rpsls-board__side${shaking ? ' rpsls-board__side--shaking' : ''}${outcome ? ' rpsls-board__side--' + outcome : ''}">
      <figcaption class="rpsls-board__who">${label}</figcaption>
      ${art}
      <span class="rpsls-board__hand-name">${name}</span>
    </figure>`;
}

// How a side came out of the round shown, from its own point of view.
const sideOutcome = (config: RpslsBoardConfig, me: Side) => {
  if (config.phase !== 'shown') return null;
  if (!config.roundWinner) return 'draw';
  return config.roundWinner === me ? 'win' : 'lose';
};

const templateFn = (config: RpslsBoardConfig) => html`__TEMPLATE_PLACEHOLDER__`;

// The duel (the player's hand against the AI's), the five hands to show, and the rules.
// The hands are kept by index: moving the cursor only rebuilds the two hands it changes.
export class RpslsBoardComponent extends UpdatableComponent<RpslsBoardConfig> {
  constructor(
    mountTarget: HTMLElement,
    config: RpslsBoardConfig,
    // Passed to every hand as is, so unchanged hands stay equal and are kept.
    private readonly onSelect: (index: number) => void,
  ) {
    super({ templateFn, mountTarget, config });
  }

  override registerChildren(): Nutin.ComponentConfig[] {
    const { cursor, locked } = this.config;
    return this.createCatalogComponents({
      items: HANDS.map((hand, index): RpslsHand => ({
        hand,
        key: index + 1,
        cursor: index === cursor,
        disabled: locked,
        onSelect: this.onSelect,
      })),
      selector: 'hands',
      elementName: 'rpsls-hand',
      elementTag: 'li',
      component: RpslsHandComponent,
      keepBy: (_hand: RpslsHand, index: number) => index,
    });
  }
}
