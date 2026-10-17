import { Component, html } from '../../../../core/index.js';

export interface ScoreRow {
  rank: number;
  score: number;
  level: number;
  // ISO date string.
  date: string;
  // The score just added: highlighted.
  isNew: boolean;
}

const templateFn = (row: ScoreRow) => html`__TEMPLATE_PLACEHOLDER__`;

// One row of ScoreTableComponent.
export class ScoreRowComponent extends Component<HTMLElement, ScoreRow> {
  constructor(mountTarget: HTMLElement, row: ScoreRow) {
    super({
      templateFn,
      mountTarget,
      config: row,
      props: { className: row.isNew ? 'score-table__row score-table__row--new' : 'score-table__row' },
    });
  }
}
