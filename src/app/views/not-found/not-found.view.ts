import { Navigation, View, html } from '../../../core/index.js';

const template = html`__TEMPLATE_PLACEHOLDER__`;

export class NotFoundView extends View {
  constructor() {
    super({ template, viewName: 'not-found' });
  }

  override documentTitle(): string {
    return 'Page not found';
  }

  protected _handleHome(): void {
    Navigation.navigateTo('/');
  }

  // Dopefish lives!
  protected _openBonus(): void {
    Navigation.navigateTo('/bonus');
  }
}
