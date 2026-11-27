import { html, nutinIf } from '../../../core/index.js';
import { pixelArt } from '../pixel-art.js';

// A link to a game (path), or, without one, the "Random" action.
export interface GameCard {
  title: string;
  path?: string;
  // Pixel art: one string per row, '#' is a lit pixel.
  icon: string[];
  // Only the icon, no frame: e.g. the bonus games' cup above the home page's title.
  plain?: boolean;
}

const cardClass = (card: GameCard) => (card.plain ? 'game-card game-card--plain' : 'game-card');

// Icon and title, the same for link and button cards.
const cardContent = (card: GameCard) => html`
  ${pixelArt(card.icon, 'game-card__icon')}
  <span class="game-card__title">${card.title}</span>`;

// A card: its pixel-art icon and its title, as a link or a button. Markup for the view that
// lists it, which handles the clicks: it must define `_open(path)` and `_random()`.
// (A template outside a class isn't type-checked: the views' tests click both kinds.)
export const gameCard = (card: GameCard) => nutinIf(card.path !== undefined,
  () => html`<a class="${cardClass(card)}" href="${card.path}" data-event="click:_open:@attr:href">${cardContent(card)}</a>`,
).nutinElse(() => html`<button type="button" class="${cardClass(card)}" data-event="click:_random">${cardContent(card)}</button>`);
