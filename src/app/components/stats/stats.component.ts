import { html } from '../../../core/index.js';
import { UpdatableComponent } from '../updatable-component.js';
import { StatComponent, type Stat } from './stat/stat.component.js';

export interface StatsConfig {
  items: Stat[];
}

const templateFn = () => html`__TEMPLATE_PLACEHOLDER__`;

// Labelled values (score, level, lines, a tally…): a catalog kept by key, so a tick
// only rebuilds the values that changed.
export class StatsComponent extends UpdatableComponent<StatsConfig> {
  constructor(mountTarget: HTMLElement, config: StatsConfig) {
    super({ templateFn, mountTarget, config });
  }

  override registerChildren(): Nutin.ComponentConfig[] {
    return this.createCatalogComponents({
      items: this.config.items,
      selector: 'stats',
      elementName: 'stat',
      elementTag: 'li',
      component: StatComponent,
      keepBy: (stat: Stat) => stat.key,
    });
  }
}
