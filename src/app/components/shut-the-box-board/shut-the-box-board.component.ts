import { html, nutinFor, nutinIf } from '../../../core/index.js';
import { ICONS } from '../../games/icons.js';
import { DIE_FACES } from '../../games/bonus/shut-the-box/dice.js';
import type { Side } from '../../games/bonus/shut-the-box/shut-the-box.js';
import { pixelArt } from '../pixel-art.js';
import { UpdatableComponent } from '../updatable-component.js';
import { ShutTheBoxTileComponent, type ShutTheBoxTile, type TileState } from './shut-the-box-tile/shut-the-box-tile.component.js';

export interface ShutTheBoxBoardConfig {
  // The player's tiles, tile n at n - 1.
  tiles: { state: TileState; disabled: boolean }[];
  // The opponent's tiles, shut or not; null solo.
  opponent: boolean[] | null;
  turn: Side;
  // The last roll, 0 for a die still rolling; empty before the first roll.
  dice: number[];
  // The total to shut, while tiles are being picked.
  total: number | null;
  selectedSum: number;
  canRoll: boolean;
  // null: the single-die rule is off, no button for it.
  canRollOne: boolean | null;
  // The keyboard cursor's tile, as an index.
  cursor: number;
}

const die = (value: number) => (value
  ? pixelArt(DIE_FACES[value - 1] ?? [], 'shut-the-box__die')
  : pixelArt(ICONS.random, 'shut-the-box__die shut-the-box__die--rolling'));

// Before the first roll: two question marks, still.
const unknownDice = () => [1, 2].map(() => pixelArt(ICONS.random, 'shut-the-box__die shut-the-box__die--unknown'));

// "Dice: 3 and 5", "Dice rolling".
function diceLabel(dice: readonly number[]): string {
  if (dice.includes(0)) return 'Dice rolling';
  return dice.length === 1 ? `Die: ${dice[0]}` : `Dice: ${dice.join(' and ')}`;
}

// The opponent's box, for show: its open tiles are read out as one label.
function opponentBox(shut: readonly boolean[], playing: boolean) {
  const open = shut.flatMap((isShut, i) => (isShut ? [] : [i + 1]));
  return html`
    <div class="shut-the-box__box shut-the-box__box--opponent${playing ? ' shut-the-box__box--playing' : ''}">
      <p class="shut-the-box__who"><span class="shut-the-box__who-long">Opponent</span><span class="shut-the-box__who-short">Opp.</span></p>
      <div role="img" aria-label="Opponent's open tiles: ${open.length ? open.join(', ') : 'none'}">
        <ul class="shut-the-box__tiles shut-the-box__tiles--small" aria-hidden="true">
          ${nutinFor(shut, (isShut, i) => html`<li class="shut-the-box__tile shut-the-box__tile--small${isShut ? ' shut-the-box__tile--shut' : ''}">${i + 1}</li>`)}
        </ul>
      </div>
    </div>`;
}

const templateFn = (config: ShutTheBoxBoardConfig) => html`__TEMPLATE_PLACEHOLDER__`;

// The player's tiles (and the opponent's, against the AI), the dice and the roll buttons.
// The tiles are kept by index: picking one only rebuilds the tiles that changed.
export class ShutTheBoxBoardComponent extends UpdatableComponent<ShutTheBoxBoardConfig> {
  constructor(
    mountTarget: HTMLElement,
    config: ShutTheBoxBoardConfig,
    // Passed to every tile as is, so unchanged tiles stay equal and are kept.
    private readonly onSelect: (index: number, action?: string) => void,
  ) {
    super({ templateFn, mountTarget, config });
  }

  override registerChildren(): Nutin.ComponentConfig[] {
    const { tiles, cursor } = this.config;
    return this.createCatalogComponents({
      items: tiles.map(({ state, disabled }, i): ShutTheBoxTile => ({
        number: i + 1,
        state,
        cursor: i === cursor,
        disabled,
        onSelect: this.onSelect,
      })),
      selector: 'tiles',
      elementName: 'shut-the-box-tile',
      elementTag: 'li',
      component: ShutTheBoxTileComponent,
      keepBy: (_tile: ShutTheBoxTile, index: number) => index,
    });
  }

  // Roll gets disabled once pressed, a tile once shut: the focus goes on to the first tile left
  // to pick, else to Roll.
  protected override fallbackFocus(): HTMLElement | null {
    return this.element.querySelector<HTMLElement>('.shut-the-box__tile-button:not(:disabled), .shut-the-box__roll:not(:disabled)');
  }

  protected _roll(dice: number | string): void {
    this.onSelect(Number(dice), 'roll');
  }
}
