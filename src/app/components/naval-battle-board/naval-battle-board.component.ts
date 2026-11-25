import { html } from '../../../core/index.js';
import { FLEET, GRID, shipType, type Ship, type Shot } from '../../games/bonus/naval-battle/fleet.js';
import type { Phase, Side } from '../../games/bonus/naval-battle/naval-battle.js';
import { UpdatableComponent } from '../updatable-component.js';
import { NavalBattleCellComponent, type NavalBattleCell, type Segment } from './naval-battle-cell/naval-battle-cell.component.js';

export interface NavalBattleBoardConfig {
  phase: Phase;
  // The player's ships (placed so far, while placing).
  ownShips: readonly Ship[];
  // The AI's shots at the player's waters (none while placing).
  ownShots: readonly (Shot | null)[];
  // The AI's ships the player may see: the sunk ones, all of them once the round is lost.
  enemyShips: readonly Ship[];
  enemyShots: readonly (Shot | null)[];
  // The next ship under the cursor while placing, and whether it fits there.
  preview: { cells: readonly number[]; fits: boolean } | null;
  lastShot: { side: Side; cell: number } | null;
  // On the player's grid while placing, on the AI's in battle.
  cursor: number;
  // The player can't act: the AI's turn, or the round over.
  locked: boolean;
}

// Wheel events closer together than this belong to the same gesture: one turn.
export const WHEEL_PAUSE_MS = 250;

const ROWS = Array.from({ length: GRID }, (_, i) => String.fromCharCode(65 + i));
const COLUMNS = Array.from({ length: GRID }, (_, i) => i + 1);
const cellName = (cell: number) => `${ROWS[Math.floor(cell / GRID)]}${(cell % GRID) + 1}`;

const isSunk = (ship: Ship, shots: readonly (Shot | null)[]) => ship.cells.every((cell) => shots[cell] === 'hit');

// Where a cell sits in its ship: its bow, its middle or its stern, along or across the grid.
function segments(ships: readonly Ship[]): Map<number, { ship: Ship; segment: Segment }> {
  const map = new Map<number, { ship: Ship; segment: Segment }>();
  ships.forEach((ship) => {
    const across = ship.cells.length > 1 && ship.cells[1]! - ship.cells[0]! === 1;
    ship.cells.forEach((cell, i) => {
      const part = i === 0 ? 'start' : i === ship.cells.length - 1 ? 'end' : 'mid';
      map.set(cell, { ship, segment: `${across ? 'h' : 'v'}-${part}` as Segment });
    });
  });
  return map;
}

// The fleet, ship by ship: sunk or afloat (or, while placing, placed, next or to come).
function shipList(config: NavalBattleBoardConfig, side: Side) {
  const ships = side === 'player' ? config.ownShips : config.enemyShips;
  const shots = side === 'player' ? config.ownShots : config.enemyShots;
  const nextId = FLEET.find(({ id }) => !config.ownShips.some((ship) => ship.id === id))?.id;
  return FLEET.map(({ id, name, size }) => {
    const ship = ships.find((s) => s.id === id);
    const state = config.phase === 'placing'
      ? (ship ? 'placed' : id === nextId ? 'next' : 'waiting')
      : ship && isSunk(ship, shots) ? 'sunk' : 'afloat';
    return html`<li class="naval__ship naval__ship--${state}">${name} <span class="naval__ship-size">${size}</span><span class="naval__ship-state">${state === 'waiting' || state === 'afloat' ? '' : ` (${state})`}</span></li>`;
  });
}

// Letters down the side, numbers along the top: decoration (each cell names itself).
const columnLabels = () => COLUMNS.map((n) => html`<span>${n}</span>`);
const rowLabels = () => ROWS.map((letter) => html`<span>${letter}</span>`);

const templateFn = (config: NavalBattleBoardConfig) => html`__TEMPLATE_PLACEHOLDER__`;

// The player's grid (and, while placing, the fleet panel), then in battle the AI's grid too.
// Cells are kept by index: a shot only rebuilds the cells it changes.
export class NavalBattleBoardComponent extends UpdatableComponent<NavalBattleBoardConfig> {
  // When the wheel last turned the ship.
  private _lastWheel = 0;

  constructor(
    mountTarget: HTMLElement,
    config: NavalBattleBoardConfig,
    // Passed to every cell as is, so unchanged cells stay equal and are kept.
    private readonly onSelect: (index: number, action?: string) => void,
  ) {
    super({ templateFn, mountTarget, config });
  }

  override registerChildren(): Nutin.ComponentConfig[] {
    return [...this.grid('player'), ...this.grid('ai')];
  }

  private grid(side: Side): Nutin.ComponentConfig[] {
    const { phase, preview, lastShot, cursor, locked } = this.config;
    const own = side === 'player';
    const ships = own ? this.config.ownShips : this.config.enemyShips;
    const shots = own ? this.config.ownShots : this.config.enemyShots;
    const parts = segments(ships);
    const previewCells = new Set(own ? preview?.cells ?? [] : []);
    // Where the player acts: their own grid while placing, the AI's in battle.
    const active = own ? phase === 'placing' : phase === 'battle';
    const items = Array.from({ length: GRID * GRID }, (_, cell): NavalBattleCell => {
      const part = parts.get(cell);
      const shot = shots[cell] ?? null;
      const sunk = part ? isSunk(part.ship, shots) : false;
      return {
        segment: part?.segment ?? null,
        shot,
        sunk,
        preview: previewCells.has(cell) ? (preview!.fits ? 'fits' : 'blocked') : null,
        last: lastShot?.cell === cell && lastShot.side !== side,
        cursor: active && cell === cursor,
        disabled: !active || locked || (!own && shot !== null),
        label: this.label(cell, side, part?.ship, shot, sunk),
        action: own ? 'place' : 'fire',
        onSelect: this.onSelect,
      };
    });
    return this.createCatalogComponents({
      items,
      selector: own ? 'own' : 'enemy',
      elementName: own ? 'naval-battle-own-cell' : 'naval-battle-enemy-cell',
      component: NavalBattleCellComponent,
      keepBy: (_cell: NavalBattleCell, index: number) => index,
    });
  }

  // "B7: your Cruiser, hit", "B7: miss", "B7: not fired at"…
  private label(cell: number, side: Side, ship: Ship | undefined, shot: Shot | null, sunk: boolean): string {
    const name = cellName(cell);
    const own = side === 'player';
    if (ship) {
      const what = `${own ? 'your' : 'their'} ${shipType(ship.id).name}`;
      return `${name}: ${what}${sunk ? ', sunk' : shot === 'hit' ? ', hit' : ''}`;
    }
    if (shot === 'hit') return `${name}: hit`;
    if (shot === 'miss') return `${name}: miss`;
    if (this.config.phase === 'placing') return `${name}: water`;
    return own ? `${name}: water` : `${name}: not fired at`;
  }

  // While placing, the mouse wheel over the player's grid turns the next ship (once per gesture:
  // a trackpad sends many wheel events) instead of scrolling the page.
  protected override onAfterRender(): void {
    super.onAfterRender();
    const grid = this.element.querySelector('.naval__sea--own .naval__grid');
    if (!grid || this.config.phase !== 'placing') return;
    const onWheel = (event: Event) => {
      event.preventDefault();
      const now = Date.now();
      if (now - this._lastWheel < WHEEL_PAUSE_MS) return;
      this._lastWheel = now;
      this.onSelect(0, 'rotate');
    };
    grid.addEventListener('wheel', onWheel, { passive: false });
    this.eventListeners.push([grid, 'wheel', onWheel]);
  }

  private _action(action: string): void {
    this.onSelect(0, action);
  }
}
