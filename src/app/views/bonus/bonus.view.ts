import { Navigation, View, html } from '../../../core/index.js';
import { GameCardComponent } from '../../components/game-card/game-card.component.js';
import { discoverBonus } from '../../components/reward-notices/reward-notices.js';
import { CABINET_ICON } from '../../games/icons.js';
import { BONUS_CARDS, BONUS_RANDOM_CARD, randomBonusPath } from './bonus-cards.js';

const template = html`__TEMPLATE_PLACEHOLDER__`;

// The bonus cabinet (the reward, or found from the 404 page): the bonus games' cards, laid out
// as the home page, under a cabinet leading back to the main games.
export class BonusView extends View {
  constructor() {
    super({ template, viewName: 'bonus' });
  }

  override documentTitle(): string {
    return 'Bonus Games';
  }

  override onEnter(): void {
    discoverBonus();
  }

  override registerChildren(): Nutin.ComponentConfig[] {
    return [{
      selector: 'games-link',
      keep: 'games-link',
      factory: (el) => new GameCardComponent(el, { title: 'Games', path: '/', icon: CABINET_ICON, plain: true }),
    }, ...this.createCatalogComponents({
      items: [...BONUS_CARDS, { ...BONUS_RANDOM_CARD, onSelect: () => Navigation.navigateTo(randomBonusPath()) }],
      selector: 'games',
      elementName: 'game-card',
      elementTag: 'li',
      component: GameCardComponent,
    })];
  }
}
