import type { GameDefinition } from './games/game.js';
import { GAMES, gamePath } from './games/registry.js';
import { HomeView } from './views/home/home.view.js';
import { NotFoundView } from './views/not-found/not-found.view.js';

// Lazy route: the game view and the game's own code load on first visit.
const gameRoute = (loadGame: () => Promise<GameDefinition>): Nutin.ViewFactory => () =>
  Promise.all([import('./views/game/game.view.js'), loadGame()])
    .then(([{ GameView }, definition]) => new GameView(definition));

export const appRoutes: Nutin.Routes = {
  '/': () => new HomeView(),
  ...Object.fromEntries(GAMES.map(({ id, load }) => [gamePath(id), gameRoute(load)])),
  '/secret': () => import('./views/secret/secret.view.js').then((m) => new m.SecretView()),
  '/404': () => new NotFoundView(),
}
