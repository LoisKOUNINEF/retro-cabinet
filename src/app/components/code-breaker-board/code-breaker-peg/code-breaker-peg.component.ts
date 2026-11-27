import { Component, html, nutinIf } from '../../../../core/index.js';
import { pegArt } from '../peg-art.js';

export interface CodeBreakerPeg {
  // The peg shown (a PEGS index), null for a hole not filled yet.
  peg: number | null;
  // What it is: a hole of the row being played, or a colour of the palette.
  action: 'slot' | 'colour';
  // What onSelect gets: the hole's position, or the colour's peg.
  value: number;
  // Its number key, for the palette's colours.
  key: number | null;
  label: string;
  // Under the keyboard cursor.
  cursor: boolean;
  disabled: boolean;
  onSelect: (index: number, action?: string) => void;
}

// The catalog adds each item's index.
type IndexedPeg = CodeBreakerPeg & { index: number };

const templateFn = (item: IndexedPeg) => html`__TEMPLATE_PLACEHOLDER__`;

// A peg button of CodeBreakerBoardComponent: a hole to aim at (or empty), or a colour to put in.
export class CodeBreakerPegComponent extends Component<HTMLElement, IndexedPeg> {
  constructor(mountTarget: HTMLElement, item: IndexedPeg) {
    super({ templateFn, mountTarget, config: item, props: { className: 'code-breaker__slot' } });
  }

  protected _select(): void {
    this.config.onSelect(this.config.value, this.config.action);
  }
}
