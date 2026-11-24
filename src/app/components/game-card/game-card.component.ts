import { Component, Navigation, html } from '../../../core/index.js';
import { pixelArt } from '../pixel-art.js';

// A link to a game (path), or an action (onSelect), e.g. opening a random game.
export interface GameCard {
  title: string;
  path?: string;
  onSelect?: () => void;
  // Pixel art: one string per row, '#' is a lit pixel.
  icon: string[];
  // Only the icon, no frame: e.g. the bonus games' cup above the home page's title.
  plain?: boolean;
}

// Icon and title, the same for link and button cards.
const cardContent = (card: GameCard) => html`
  ${pixelArt(card.icon, 'game-card__icon')}
  <span class="game-card__title">${card.title}</span>`;

const cardClass = (card: GameCard) => (card.plain ? 'game-card game-card--plain' : 'game-card');

const templateFn = (card: GameCard) => html`__TEMPLATE_PLACEHOLDER__`;

// A home-page card: its pixel-art icon and its title, as a link or a button.
export class GameCardComponent extends Component<HTMLElement, GameCard> {
  constructor(mountTarget: HTMLElement, card: GameCard) {
    super({ templateFn, mountTarget, config: card });
  }

  private _open(path: string): void {
    Navigation.navigateTo(path);
  }

  private _select(): void {
    this.config.onSelect?.();
  }
}
