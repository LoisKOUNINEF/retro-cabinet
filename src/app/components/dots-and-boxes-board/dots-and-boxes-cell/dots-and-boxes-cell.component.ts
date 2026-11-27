import { Component, html, nutinIf } from '../../../../core/index.js';
import type { Player } from '../../../games/bonus/dots-and-boxes/board.js';
import type { Sprite } from '../../../games/sprites.js';
import { pixelArt } from '../../pixel-art.js';

export interface DotsAndBoxesCell {
  kind: 'dot' | 'horizontal' | 'vertical' | 'box';
  // The line's index, for lines; -1 otherwise.
  line: number;
  owner: Player | null;
  label: string;
  // The last line drawn.
  last: boolean;
  // Under the keyboard cursor.
  cursor: boolean;
  disabled: boolean;
  onSelect: (index: number) => void;
}

// Each taken box carries its owner's mark (Y for you, O for the opponent), so it reads without its colour.
const MARKS: Record<Player, Sprite> = {
  player: ['#...#', '.#.#.', '..#..', '..#..', '..#..'],
  ai: ['.###.', '#...#', '#...#', '#...#', '.###.'],
};

const ownerClass = (base: string, owner: Player | null) => (owner ? ` ${base}--${owner}` : '');

// The catalog adds each item's index.
type IndexedCell = DotsAndBoxesCell & { index: number };

const templateFn = (cell: IndexedCell) => html`__TEMPLATE_PLACEHOLDER__`;

// One cell of the board's grid: a dot, a line (a button while free) or a box.
export class DotsAndBoxesCellComponent extends Component<HTMLElement, IndexedCell> {
  constructor(mountTarget: HTMLElement, cell: IndexedCell) {
    super({ templateFn, mountTarget, config: cell, props: { className: 'dots-boxes__slot' } });
  }

  protected _select(): void {
    this.config.onSelect(this.config.line);
  }
}
