import { Component, Navigation, html } from '../../../core/index.js';

// A link to a game (path), or an action (onSelect), e.g. opening a random game.
export interface GameCard {
  title: string;
  path?: string;
  onSelect?: () => void;
  // Pixel art: one string per row, '#' is a lit pixel.
  icon: string[];
}

// Each lit pixel as a 1×1 square of the icon's grid.
export function iconPixels(icon: string[]): { x: number; y: number }[] {
  return icon.flatMap((row, y) => [...row].flatMap((pixel, x) => (pixel === '#' ? [{ x, y }] : [])));
}

// Icon and title, the same for link and button cards.
const cardContent = (card: GameCard) => html`
  <svg class="game-card__icon" viewBox="0 0 ${card.icon[0]?.length ?? 0} ${card.icon.length}" aria-hidden="true" shape-rendering="crispEdges">
    ${iconPixels(card.icon).map(({ x, y }) => html`<rect x="${x}" y="${y}" width="1" height="1"></rect>`)}
  </svg>
  <span class="game-card__title">${card.title}</span>`;

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
