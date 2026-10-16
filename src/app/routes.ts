import type { GameDefinition } from './games/game.js';
import { HomeView } from './views/home/home.view.js';
import { NotFoundView } from './views/not-found/not-found.view.js';

// Lazy route: the game view and the game's own code load on first visit.
const gameRoute = (loadGame: () => Promise<GameDefinition>): Nutin.ViewFactory => () =>
  Promise.all([import('./views/game/game.view.js'), loadGame()])
    .then(([{ GameView }, definition]) => new GameView(definition));

export const appRoutes: Nutin.Routes = {
  '/': () => new HomeView(),
  '/games/tetris': gameRoute(() => import('./games/tetris/tetris.js').then((m) => m.tetrisGame)),
  '/games/snake': gameRoute(() => import('./games/snake/snake.js').then((m) => m.snakeGame)),
  '/games/frogger': gameRoute(() => import('./games/frogger/frogger.js').then((m) => m.froggerGame)),
  '/games/pacman': gameRoute(() => import('./games/pacman/pacman.js').then((m) => m.pacmanGame)),
  '/games/arkanoid': gameRoute(() => import('./games/arkanoid/arkanoid.js').then((m) => m.arkanoidGame)),
  '/games/invaders': gameRoute(() => import('./games/invaders/invaders.js').then((m) => m.invadersGame)),
  '/games/asteroids': gameRoute(() => import('./games/asteroids/asteroids.js').then((m) => m.asteroidsGame)),
  '/games/columns': gameRoute(() => import('./games/columns/columns.js').then((m) => m.columnsGame)),
  '/games/pong': gameRoute(() => import('./games/pong/pong.js').then((m) => m.pongGame)),
  '/secret': () => import('./views/secret/secret.view.js').then((m) => new m.SecretView()),
  '/404': () => new NotFoundView(),
}
