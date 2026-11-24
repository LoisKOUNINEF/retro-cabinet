import type { GameDefinition } from './games/game.js';
import { GAMES, gamePath } from './games/registry.js';
import type { BonusGameDefinition } from './games/bonus/bonus-game.js';
import { BONUS_GAMES, BONUS_PATH, bonusGamePath } from './games/bonus/registry.js';
import { HomeView } from './views/home/home.view.js';
import { NotFoundView } from './views/not-found/not-found.view.js';

// Lazy route: the game view and the game's own code load on first visit.
const gameRoute = (loadGame: () => Promise<GameDefinition>): Nutin.ViewFactory => () =>
  Promise.all([import('./views/game/game.view.js'), loadGame()])
    .then(([{ GameView }, definition]) => new GameView(definition));

// The same for a bonus game, in the BonusGameView.
const bonusGameRoute = (loadGame: () => Promise<BonusGameDefinition>): Nutin.ViewFactory => () =>
  Promise.all([import('./views/bonus/bonus-game/bonus-game.view.js'), loadGame()])
    .then(([{ BonusGameView }, definition]) => new BonusGameView(definition));

export const appRoutes: Nutin.Routes = {
  '/': () => new HomeView(),
  ...Object.fromEntries(GAMES.map(({ id, load }) => [gamePath(id), gameRoute(load)])),
  // The hidden cabinet: its hub, then each bonus game, every one loaded on first visit.
  [BONUS_PATH]: () => import('./views/bonus/bonus.view.js').then((m) => new m.BonusView()),
  ...Object.fromEntries(BONUS_GAMES.map(({ id, load }) => [bonusGamePath(id), bonusGameRoute(load)])),
  '/404': () => new NotFoundView(),
}
