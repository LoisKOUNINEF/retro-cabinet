import { html } from '../../../core/index.js';
import { FACES } from '../../games/bonus/matching-pairs/faces.js';
import type { CardState } from '../../games/bonus/matching-pairs/matching-pairs.js';
import { UpdatableComponent } from '../updatable-component.js';
import { MatchingPairsCardComponent, type MatchingPairsCardItem } from './matching-pairs-card/matching-pairs-card.component.js';

export interface MatchingPairsBoardConfig {
  cards: { face: number; state: CardState }[];
  // Cards per row.
  columns: number;
  // The keyboard cursor's card.
  cursor: number;
  // No turns allowed (the round is over).
  locked: boolean;
}

const STATE_LABEL: Record<CardState, string> = { hidden: 'hidden', shown: '', found: ', found', revealed: ', missed' };

// "Card 3: hidden", "Card 3: Maze Chase", "Card 3: Maze Chase, found".
function cardLabel(index: number, face: number, state: CardState): string {
  return state === 'hidden' ? `Card ${index + 1}: hidden` : `Card ${index + 1}: ${FACES[face]?.name ?? ''}${STATE_LABEL[state]}`;
}

const templateFn = ({ columns, cards }: MatchingPairsBoardConfig) => html`__TEMPLATE_PLACEHOLDER__`;

// The cards, kept by index: turning a card only rebuilds that card.
export class MatchingPairsBoardComponent extends UpdatableComponent<MatchingPairsBoardConfig> {
  constructor(
    mountTarget: HTMLElement,
    config: MatchingPairsBoardConfig,
    // Passed to every card as is, so unchanged cards stay equal and are kept.
    private readonly onSelect: (index: number) => void,
  ) {
    super({ templateFn, mountTarget, config });
  }

  // The cards' states at the last render, to tell which ones just turned; null before the deal.
  private _lastStates: CardState[] | null = null;

  override registerChildren(): Nutin.ComponentConfig[] {
    const { cards, cursor, locked } = this.config;
    const lastStates = this._lastStates;
    this._lastStates = cards.map(({ state }) => state);
    return this.createCatalogComponents({
      items: cards.map(({ face, state }, index): MatchingPairsCardItem => ({
        // The same sprite array every time: a shallow compare sees an unchanged card as equal.
        sprite: FACES[face]?.sprite ?? [],
        state,
        label: cardLabel(index, face, state),
        cursor: index === cursor,
        disabled: locked || state !== 'hidden',
        // Every card on the deal, then only those whose state changed.
        turning: lastStates === null || lastStates[index] !== state,
        onSelect: this.onSelect,
      })),
      selector: 'cards',
      elementName: 'matching-pairs-card',
      component: MatchingPairsCardComponent,
      keepBy: (_card: MatchingPairsCardItem, index: number) => index,
    });
  }
}
