import { Component, html } from '../../../../core/index.js';

export interface Stat {
  key: string;
  label: string;
  value: number;
}

const templateFn = (stat: Stat) => html`__TEMPLATE_PLACEHOLDER__`;

// One row of StatsComponent: a label and its value.
export class StatComponent extends Component<HTMLElement, Stat> {
  constructor(mountTarget: HTMLElement, stat: Stat) {
    super({ templateFn, mountTarget, config: stat, props: { className: 'game__stat' } });
  }
}
