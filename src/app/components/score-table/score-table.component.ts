import { html, nutinFor, nutinIf } from '../../../core/index.js';
import type { ScoreEntry } from '../../services/persistence/persistence.service.js';
import { UpdatableComponent } from '../updatable-component.js';

export interface ScoreTableConfig {
  entries: ScoreEntry[];
  // Index of the entry just added, shown highlighted.
  highlight: number | null;
  // False for games without levels (e.g. Table Tennis); shown by default.
  showLevel?: boolean;
}

// One row: rank, score, level (unless the game has none) and date.
const scoreRow = ({ score, level, date }: ScoreEntry, index: number, isNew: boolean, showLevel: boolean) => html`
  <li class="score-table__row${isNew ? ' score-table__row--new' : ''}">
    <span class="score-table__rank">${index + 1}.</span>
    <span class="score-table__score">${score}</span>
    ${nutinIf(showLevel, () => html`<span class="score-table__level">Lv ${level}</span>`)}
    <span class="score-table__date" data-pipe="date:en-GB,numeric,false,DD/MM/YY">${date}</span>
  </li>`;

const templateFn = ({ entries, highlight, showLevel = true }: ScoreTableConfig) => {
  const listClass = showLevel ? 'score-table__list' : 'score-table__list score-table__list--no-level';
  const rows = nutinFor(entries, (entry, index) => scoreRow(entry, index, index === highlight, showLevel));
  return html`__TEMPLATE_PLACEHOLDER__`;
};

// The best scores. They change once per game, so an update simply renders them all again.
export class ScoreTableComponent extends UpdatableComponent<ScoreTableConfig> {
  constructor(mountTarget: HTMLElement, config: ScoreTableConfig) {
    super({ templateFn, mountTarget, config });
  }
}
