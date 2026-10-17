import { html } from '../../../core/index.js';
import type { GameOption, Settings } from '../../games/game.js';
import { UpdatableComponent } from '../updatable-component.js';
import { OptionSelectComponent, type OptionSelect } from './option-select/option-select.component.js';

export interface GameOptionsConfig {
  options: GameOption[];
  settings: Settings;
  // Options only change between games: the whole box is disabled while playing.
  locked: boolean;
  onChange: (key: string, value: string) => void;
}

const templateFn = ({ locked }: GameOptionsConfig) => html`__TEMPLATE_PLACEHOLDER__`;

// The Options box: one select per option, kept by key, so a change rebuilds only its select.
export class GameOptionsComponent extends UpdatableComponent<GameOptionsConfig> {
  constructor(mountTarget: HTMLElement, config: GameOptionsConfig) {
    super({ templateFn, mountTarget, config });
  }

  override registerChildren(): Nutin.ComponentConfig[] {
    const { options, settings, onChange } = this.config;
    return this.createCatalogComponents({
      items: options.map(({ key, label, choices }): OptionSelect => ({ key, label, choices, value: settings[key] ?? '', onChange })),
      selector: 'options',
      elementName: 'option-select',
      component: OptionSelectComponent,
      keepBy: (option: OptionSelect) => option.key,
    });
  }
}
