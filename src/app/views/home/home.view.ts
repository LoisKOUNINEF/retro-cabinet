import { Navigation, View, html, nutinFor, nutinIf } from '../../../core/index.js';
import { gameCard } from '../../components/game-card/game-card.js';
import { BONUS_PATH } from '../../games/bonus/registry.js';
import { CUP_ICON } from '../../games/icons.js';
import { hasReward } from '../../services/reward/reward.js';
import { GAME_CARDS, RANDOM_CARD, randomGamePath } from './game-cards.js';

const BONUS_CARD = { title: 'Bonus', path: BONUS_PATH, icon: CUP_ICON, plain: true };
const CARDS = [...GAME_CARDS, RANDOM_CARD];

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

  // The cards' clicks (see gameCard).
  protected _open(path: string): void {
    Navigation.navigateTo(path);
  }

  protected _random(): void {
    Navigation.navigateTo(randomGamePath());
  }
}
