import { Component, html } from '../../../../core/index.js';
import { keyArt, pegArt } from '../peg-art.js';

export interface CodeBreakerRow {
  pegs: readonly number[];
  exact: number;
  misplaced: number;
  // Read as a whole: "Guess 2: Red, Blue, Blue, Green: 1 in place, 2 misplaced".
  label: string;
}

// The catalog adds each item's index.
type IndexedRow = CodeBreakerRow & { index: number };

const templateFn = (row: IndexedRow) => html`__TEMPLATE_PLACEHOLDER__`;

// A guess already played, with its feedback.
export class CodeBreakerRowComponent extends Component<HTMLElement, IndexedRow> {
  constructor(mountTarget: HTMLElement, row: IndexedRow) {
    super({ templateFn, mountTarget, config: row, props: { className: 'code-breaker__row-item' } });
  }
}
