import type { GameDefinition } from './game.js';

// The cabinet's games, in home-page order: the one list routes and home cards are built from.
// Each game's code stays behind its import() and loads on the first visit to its page.
// The bonus game isn't one of them: it has its own view and route.
export const GAMES = [
  { id: 'falling-blocks', title: 'Falling Blocks', load: () => import('./falling-blocks/falling-blocks.js').then((m) => m.fallingBlocksGame) },
  { id: 'maze-chase', title: 'Maze Chase', load: () => import('./maze-chase/maze-chase.js').then((m) => m.mazeChaseGame) },
  { id: 'alien-attack', title: 'Alien Attack', load: () => import('./alien-attack/alien-attack.js').then((m) => m.alienAttackGame) },
  { id: 'snake', title: 'Snake', load: () => import('./snake/snake.js').then((m) => m.snakeGame) },
  { id: 'brick-breaker', title: 'Brick Breaker', load: () => import('./brick-breaker/brick-breaker.js').then((m) => m.brickBreakerGame) },
  { id: 'space-rocks', title: 'Space Rocks', load: () => import('./space-rocks/space-rocks.js').then((m) => m.spaceRocksGame) },
  { id: 'jewel-drop', title: 'Jewel Drop', load: () => import('./jewel-drop/jewel-drop.js').then((m) => m.jewelDropGame) },
  { id: 'frog-crossing', title: 'Frog Crossing', load: () => import('./frog-crossing/frog-crossing.js').then((m) => m.frogCrossingGame) },
  { id: 'table-tennis', title: 'Table Tennis', load: () => import('./table-tennis/table-tennis.js').then((m) => m.tableTennisGame) },
] as const satisfies readonly { id: string; title: string; load: () => Promise<GameDefinition> }[];

export type GameId = typeof GAMES[number]['id'];

export const gamePath = (id: GameId) => `/games/${id}`;
