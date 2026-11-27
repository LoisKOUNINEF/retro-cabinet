import { Component, html } from '../../../../core/index.js';
import { HIT_SPRITE, MISS_SPRITE, type Shot } from '../../../games/bonus/naval-battle/fleet.js';
import { pixelArt } from '../../pixel-art.js';

// A ship's cell: its bow (start), middle or stern (end), along (h) or across (v) the grid.
export type Segment = `${'h' | 'v'}-${'start' | 'mid' | 'end'}`;

export interface NavalBattleCell {
  segment: Segment | null;
  shot: Shot | null;
  // Its ship is sunk.
  sunk: boolean;
  // Under the next ship's preview, while placing.
  preview: 'fits' | 'blocked' | null;
  // The other side's last shot.
  last: boolean;
  // Under the keyboard cursor.
  cursor: boolean;
  disabled: boolean;
  label: string;
  // What a click does: place (or pick up) a ship, or fire.
  action: 'place' | 'fire';
  onSelect: (index: number, action?: string) => void;
}

// The catalog adds each item's index.
type IndexedCell = NavalBattleCell & { index: number };

const classes = (cell: IndexedCell) => [
  'naval__cell',
  cell.segment ? `naval__cell--ship naval__cell--${cell.segment}` : '',
  cell.shot ? `naval__cell--${cell.shot}` : '',
  cell.sunk ? 'naval__cell--sunk' : '',
  cell.preview ? `naval__cell--preview-${cell.preview}` : '',
  cell.last ? 'naval__cell--last' : '',
  cell.cursor ? 'naval__cell--cursor' : '',
].filter(Boolean).join(' ');

const mark = (shot: Shot | null) => (shot === 'hit' ? pixelArt(HIT_SPRITE, 'naval__mark naval__mark--hit') : shot === 'miss' ? pixelArt(MISS_SPRITE, 'naval__mark naval__mark--miss') : '');

const templateFn = (cell: IndexedCell) => html`__TEMPLATE_PLACEHOLDER__`;

// One cell of a NavalBattleBoardComponent grid: a click places a ship or fires; hovering aims.
export class NavalBattleCellComponent extends Component<HTMLElement, IndexedCell> {
  constructor(mountTarget: HTMLElement, cell: IndexedCell) {
    super({ templateFn, mountTarget, config: cell, props: { className: 'naval__slot' } });
  }

  protected _select(): void {
    this.config.onSelect(this.config.index, this.config.action);
  }

  // The mouse over a cell aims there (the ship's preview follows it while placing).
  protected _aim(): void {
    if (!this.config.disabled && !this.config.cursor) this.config.onSelect(this.config.index, 'aim');
  }
}
