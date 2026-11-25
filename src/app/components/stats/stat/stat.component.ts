import { Component, html } from '../../../../core/index.js';

export interface Stat {
  key: string;
  label: string;
  // A count, or text such as "3/8" or "—".
  value: number | string;
}

const templateFn = (stat: Stat) => html`__TEMPLATE_PLACEHOLDER__`;

// One row of StatsComponent: a label and its value.
export class StatComponent extends Component<HTMLElement, Stat> {
  constructor(mountTarget: HTMLElement, stat: Stat) {
    super({ templateFn, mountTarget, config: stat, props: { className: 'game__stat' } });
  }
}
