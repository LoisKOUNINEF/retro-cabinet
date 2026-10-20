import type { GameDefinition } from './game.js';

// The cabinet's games, in home-page order: the one list routes and home cards are built from.
// Each game's code stays behind its import() and loads on the first visit to its page.
// The secret game isn't one of them: it has its own view and route.
export const GAMES = [
  { id: 'tetris', title: 'Tetris', load: () => import('./tetris/tetris.js').then((m) => m.tetrisGame) },
  { id: 'pacman', title: 'Pacman', load: () => import('./pacman/pacman.js').then((m) => m.pacmanGame) },
  { id: 'invaders', title: 'Space Invaders', load: () => import('./invaders/invaders.js').then((m) => m.invadersGame) },
  { id: 'snake', title: 'Snake', load: () => import('./snake/snake.js').then((m) => m.snakeGame) },
  { id: 'arkanoid', title: 'Arkanoid', load: () => import('./arkanoid/arkanoid.js').then((m) => m.arkanoidGame) },
  { id: 'asteroids', title: 'Asteroids', load: () => import('./asteroids/asteroids.js').then((m) => m.asteroidsGame) },
  { id: 'columns', title: 'Columns', load: () => import('./columns/columns.js').then((m) => m.columnsGame) },
  { id: 'frogger', title: 'Frogger', load: () => import('./frogger/frogger.js').then((m) => m.froggerGame) },
  { id: 'pong', title: 'Pong', load: () => import('./pong/pong.js').then((m) => m.pongGame) },
] as const satisfies readonly { id: string; title: string; load: () => Promise<GameDefinition> }[];

export type GameId = typeof GAMES[number]['id'];

export const gamePath = (id: GameId) => `/games/${id}`;
