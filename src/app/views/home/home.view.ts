import { Navigation, View, html } from '../../../core/index.js';
import { GameCardComponent } from '../../components/game-card/game-card.component.js';
import { GAME_CARDS, RANDOM_CARD, randomGamePath } from './game-cards.js';

const template = html`__TEMPLATE_PLACEHOLDER__`;

export class HomeView extends View {
  constructor() {
    super({ template, viewName: 'home' });
  }

  override documentTitle(): string {
    return 'Pixels Mansion';
  }

  override registerChildren(): Nutin.ComponentConfig[] {
    return this.createCatalogComponents({
      items: [...GAME_CARDS, { ...RANDOM_CARD, onSelect: () => Navigation.navigateTo(randomGamePath()) }],
      selector: 'games',
      elementName: 'game-card',
      elementTag: 'li',
      component: GameCardComponent,
    });
  }
}
