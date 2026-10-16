import { Component, html } from '../../../core/index.js';
import type { ScoreEntry } from '../../services/persistence/persistence.service.js';

export interface ScoreTableConfig {
  entries: ScoreEntry[];
  // Index of the entry just added, shown highlighted.
  highlight: number | null;
}

const templateFn = ({ entries, highlight }: ScoreTableConfig) => html`__TEMPLATE_PLACEHOLDER__`;

export class ScoreTableComponent extends Component<HTMLElement, ScoreTableConfig> {
  constructor(mountTarget: HTMLElement, config: ScoreTableConfig) {
    super({ templateFn, mountTarget, config });
  }

  update(entries: ScoreEntry[], highlight: number | null): void {
    this.config = { entries, highlight };
    this.render();
  }
}
