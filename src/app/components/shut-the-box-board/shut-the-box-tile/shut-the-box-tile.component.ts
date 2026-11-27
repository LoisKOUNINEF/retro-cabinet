import { Component, html } from '../../../../core/index.js';

export type TileState = 'open' | 'selected' | 'shut';

export interface ShutTheBoxTile {
  number: number;
  state: TileState;
  // Under the keyboard cursor.
  cursor: boolean;
  disabled: boolean;
  onSelect: (index: number, action?: string) => void;
}

// The catalog adds each item's index.
type IndexedTile = ShutTheBoxTile & { index: number };

const STATE_LABEL: Record<TileState, string> = { open: 'open', selected: 'picked', shut: 'shut' };

// "Tile 7: shut".
const tileLabel = ({ number, state }: ShutTheBoxTile) => `Tile ${number}: ${STATE_LABEL[state]}`;

const templateFn = (tile: IndexedTile) => html`__TEMPLATE_PLACEHOLDER__`;

// One tile of ShutTheBoxBoardComponent: a button picking it towards the roll's total.
export class ShutTheBoxTileComponent extends Component<HTMLElement, IndexedTile> {
  constructor(mountTarget: HTMLElement, tile: IndexedTile) {
    super({ templateFn, mountTarget, config: tile, props: { className: 'shut-the-box__slot' } });
  }

  protected _select(): void {
    this.config.onSelect(this.config.index, 'tile');
  }
}
