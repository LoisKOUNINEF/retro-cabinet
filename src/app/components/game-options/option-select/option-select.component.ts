import { Component, html } from '../../../../core/index.js';
import type { GameOption } from '../../../games/game.js';

export interface OptionSelect extends Omit<GameOption, 'defaultValue'> {
  // The chosen value.
  value: string;
  onChange: (key: string, value: string) => void;
}

const templateFn = (option: OptionSelect) => html`__TEMPLATE_PLACEHOLDER__`;

// One option of GameOptionsComponent: its label and a select showing the chosen value.
export class OptionSelectComponent extends Component<HTMLElement, OptionSelect> {
  constructor(mountTarget: HTMLElement, option: OptionSelect) {
    super({ templateFn, mountTarget, config: option });
  }

  private _change(value: string): void {
    this.config.onChange(this.config.key, value);
  }
}
