import { html, nutinFor } from '../../../core/index.js';
import { PITS_PER_SIDE, sidePits, type Side } from '../../games/bonus/wari/rules.js';
import { seedSprite } from '../../games/bonus/wari/seeds.js';
import { pixelArt } from '../pixel-art.js';
import { UpdatableComponent } from '../updatable-component.js';
import { WariPitComponent, type WariPit } from './wari-pit/wari-pit.component.js';

export interface WariBoardConfig {
  // Every pit's seeds, as shown: the player's 0–5, the AI's 6–11.
  pits: number[];
  stores: Record<Side, number>;
  // The player's pits that may be sown now.
  legal: boolean[];
  // The pit the last seed went into, while a move is shown.
  lastSown: number | null;
  // The pits about to be taken.
  capturing: number[];
  // The keyboard cursor's pit.
  cursor: number;
  turn: Side;
}

// The opponent's pits facing the player: from its left (pit 6) on the player's right.
const OPPONENT_PITS = sidePits('ai').reverse();

const pitClass = (config: WariBoardConfig, pit: number) =>
  `${config.lastSown === pit ? ' wari__pit--sown' : ''}${config.capturing.includes(pit) ? ' wari__pit--capturing' : ''}`;

const store = (side: Side, label: string, seeds: number, playing: boolean) => html`
  <div class="wari__store wari__store--${side}${playing ? ' wari__store--playing' : ''}">
    <span class="wari__who">${label}</span>
    <span class="wari__store-count">${seeds}</span>
  </div>`;

const templateFn = (config: WariBoardConfig) => html`__TEMPLATE_PLACEHOLDER__`;

// The two rows of pits and the stores. The player's pits are kept by index: a seed dropped
// only rebuilds the pit it went into.
export class WariBoardComponent extends UpdatableComponent<WariBoardConfig> {
  constructor(
    mountTarget: HTMLElement,
    config: WariBoardConfig,
    // Passed to every pit as is, so unchanged pits stay equal and are kept.
    private readonly onSelect: (index: number) => void,
  ) {
    super({ templateFn, mountTarget, config });
  }

  override registerChildren(): Nutin.ComponentConfig[] {
    const { pits, legal, lastSown, capturing, cursor } = this.config;
    return this.createCatalogComponents({
      items: Array.from({ length: PITS_PER_SIDE }, (_, pit): WariPit => ({
        seeds: pits[pit] ?? 0,
        cursor: pit === cursor,
        disabled: !legal[pit],
        sown: pit === lastSown,
        capturing: capturing.includes(pit),
        onSelect: this.onSelect,
      })),
      selector: 'pits',
      elementName: 'wari-pit',
      elementTag: 'li',
      component: WariPitComponent,
      keepBy: (_pit: WariPit, index: number) => index,
    });
  }

  // A pit sown is disabled: the focus goes on to the first pit left to sow.
  protected override fallbackFocus(): HTMLElement | null {
    return this.element.querySelector<HTMLElement>('.wari__pit-button:not(:disabled)');
  }
}
