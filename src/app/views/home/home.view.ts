import { Navigation, View, html } from '../../../core/index.js';
import { GameCardComponent } from '../../components/game-card/game-card.component.js';
import { BONUS_PATH } from '../../games/bonus/registry.js';
import { CUP_ICON } from '../../games/icons.js';
import { hasReward } from '../../services/reward/reward.js';
import { GAME_CARDS, RANDOM_CARD, randomGamePath } from './game-cards.js';

const templateFn = (rewarded: boolean) => html`__TEMPLATE_PLACEHOLDER__`;

export class HomeView extends View {
  constructor() {
    super({ viewName: 'home' });
  }

  override documentTitle(): string {
    return 'Retro Cabinet';
  }

  // The cup to the bonus games, once they're earned.
  protected override generateTemplate(): Nutin.Template {
    return templateFn(hasReward());
  }

  override registerChildren(): Nutin.ComponentConfig[] {
    return [{
      selector: 'bonus-link',
      keep: 'bonus-link',
      factory: (el) => new GameCardComponent(el, { title: 'Bonus', path: BONUS_PATH, icon: CUP_ICON, plain: true }),
    }, ...this.createCatalogComponents({
      items: [...GAME_CARDS, { ...RANDOM_CARD, onSelect: () => Navigation.navigateTo(randomGamePath()) }],
      selector: 'games',
      elementName: 'game-card',
      elementTag: 'li',
      component: GameCardComponent,
    })];
  }
}
