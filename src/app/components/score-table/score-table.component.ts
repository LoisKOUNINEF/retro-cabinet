import { html } from '../../../core/index.js';
import type { ScoreEntry } from '../../services/persistence/persistence.service.js';
import { UpdatableComponent } from '../updatable-component.js';
import { ScoreRowComponent, type ScoreRow } from './score-row/score-row.component.js';

export interface ScoreTableConfig {
  entries: ScoreEntry[];
  // Index of the entry just added, shown highlighted.
  highlight: number | null;
  // False for games without levels (e.g. Pong); shown by default.
  showLevel?: boolean;
}

const templateFn = ({ entries, showLevel = true }: ScoreTableConfig) => {
  const hasEntries = entries.length > 0;
  const listClass = showLevel ? 'score-table__list' : 'score-table__list score-table__list--no-level';
  return html`__TEMPLATE_PLACEHOLDER__`;
};

// The best scores, one catalog row each: a new score only rebuilds the rows it moved.
export class ScoreTableComponent extends UpdatableComponent<ScoreTableConfig> {
  constructor(mountTarget: HTMLElement, config: ScoreTableConfig) {
    super({ templateFn, mountTarget, config });
  }

  override registerChildren(): Nutin.ComponentConfig[] {
    const { entries, highlight, showLevel = true } = this.config;
    return this.createCatalogComponents({
      items: entries.map(({ score, level, date }, i): ScoreRow => ({ rank: i + 1, score, level, date, isNew: i === highlight, showLevel })),
      selector: 'rows',
      elementName: 'score-row',
      elementTag: 'li',
      component: ScoreRowComponent,
      keepBy: (row: ScoreRow) => `${row.rank}:${row.score}:${row.date}`,
    });
  }
}
