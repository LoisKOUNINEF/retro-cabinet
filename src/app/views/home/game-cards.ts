import type { GameCard } from '../../components/game-card/game-card.js';
import { cryptoRandom, pick, type Random } from '../../games/game.js';
import { ICONS } from '../../games/icons.js';
import { GAMES, gamePath } from '../../games/registry.js';

// The home page's games, in the registry's order. The bonus game is deliberately not listed.
export const GAME_CARDS: GameCard[] = GAMES.map(({ id, title }) => ({ title, path: gamePath(id), icon: ICONS[id] }));

// The last card: not a game, it opens one of them at random.
export const RANDOM_CARD: GameCard = { title: 'Random', icon: ICONS.random };

export function randomGamePath(random: Random = cryptoRandom): string {
  return pick(GAME_CARDS, random).path ?? '/';
}
