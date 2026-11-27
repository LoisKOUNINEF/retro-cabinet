import { Navigation, View, html, nutinFor } from '../../../core/index.js';
import { gameCard } from '../../components/game-card/game-card.js';
import { discoverBonus } from '../../components/reward-notices/reward-notices.js';
import { CABINET_ICON } from '../../games/icons.js';
import { BONUS_CARDS, BONUS_RANDOM_CARD, randomBonusPath } from './bonus-cards.js';

const GAMES_CARD = { title: 'Games', path: '/', icon: CABINET_ICON, plain: true };
const CARDS = [...BONUS_CARDS, BONUS_RANDOM_CARD];

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

  // The cards' clicks (see gameCard).
  protected _open(path: string): void {
    Navigation.navigateTo(path);
  }

  protected _random(): void {
    Navigation.navigateTo(randomBonusPath());
  }
}
