import type { GameCard } from '../../components/game-card/game-card.js';
import { cryptoRandom, pick, type Random } from '../../games/game.js';
import { ICONS } from '../../games/icons.js';
import { BONUS_GAMES, bonusGamePath } from '../../games/bonus/registry.js';

// The hub's games, in the bonus registry's order.
// A short card title where the full one would wrap onto a third line.
const cardTitle = (game: { title: string; cardTitle?: string }) => game.cardTitle ?? game.title;

export const BONUS_CARDS: GameCard[] = BONUS_GAMES.map((game) => ({
  title: cardTitle(game),
  path: bonusGamePath(game.id),
  icon: [...game.icon],
}));

// The last card opens one of the bonus games at random: the main cabinet's are never picked.
export const BONUS_RANDOM_CARD: GameCard = { title: 'Random', icon: ICONS.random };

export function randomBonusPath(random: Random = cryptoRandom): string {
  return pick(BONUS_CARDS, random).path ?? '/bonus';
}
