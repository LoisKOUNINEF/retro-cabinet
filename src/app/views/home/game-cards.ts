import type { GameCard } from '../../components/game-card/game-card.component.js';
import { cryptoRandom, pick, type Random } from '../../games/game.js';
import { INVADER_SPRITES } from '../../games/invaders/sprites.js';
import { GAMES, gamePath, type GameId } from '../../games/registry.js';
import type { Sprite } from '../../games/sprites.js';
import { TETROMINOES } from '../../games/tetris/tetrominoes.js';

// A Tetris shape matrix (1 = block) as pixel rows, without its empty rows.
const fromShape = (shape: number[][]) =>
  shape.filter((row) => row.some(Boolean)).map((row) => row.map((cell) => (cell ? '#' : '.')).join(''));

// Pixel-art icons: one string per row, '#' is a lit pixel. Some reuse the games' own sprites.
const ICONS = {
  tetris: fromShape(TETROMINOES.T),
  invaders: INVADER_SPRITES.crab[0],
  // As in the game: separate body blocks bending towards the food, the head with an eye.
  snake: [
    '........###.###.......',
    '........###.#.#......#',
    '........###.###.......',
    '......................',
    '###.###.###...........',
    '###.###.###...........',
    '###.###.###...........',
    '......................',
    '###...................',
    '###...................',
    '###...................',
  ],
  // Seen from the front: bulging eyes, wide smile, front feet.
  frogger: [
    '.##......##.',
    '####....####',
    '#.##....##.#',
    '############',
    '############',
    '#..........#',
    '.##########.',
    '##..####..##',
  ],
  pacman: [
    '..####......',
    '.######.....',
    '#####.......',
    '####....#..#',
    '####........',
    '#####.......',
    '.######.....',
    '..####......',
  ],
  // A rock and a tiny ship.
  asteroids: [
    '...####.....',
    '..#....#....',
    '.#......##..',
    '.#........#.',
    '..#.......#.',
    '.#.......#..',
    '.#....###...',
    '..####......',
    '.........#..',
    '........###.',
  ],
  // Three jewels stacked: a falling column.
  columns: [
    '..#..',
    '.###.',
    '#####',
    '.###.',
    '..#..',
    '..#..',
    '.###.',
    '#####',
    '.###.',
    '..#..',
    '..#..',
    '.###.',
    '#####',
    '.###.',
    '..#..',
  ],
  // Two paddles and the ball.
  pong: [
    '#..........',
    '#..........',
    '#.....#....',
    '#.........#',
    '..........#',
    '..........#',
    '..........#',
  ],
  // A question mark: any game, who knows which.
  random: [
    '.#####.',
    '##...##',
    '.....##',
    '....##.',
    '...##..',
    '...##..',
    '.......',
    '...##..',
    '...##..',
  ],
  arkanoid: [
    '###.###.###',
    '...........',
    '###.###....',
    '...........',
    '.......#...',
    '...........',
    '...........',
    '...#####...',
  ],
} satisfies Record<GameId | 'random', Sprite>;

// The home page's games, in the registry's order. The secret game is deliberately not listed.
export const GAME_CARDS: GameCard[] = GAMES.map(({ id, title }) => ({ title, path: gamePath(id), icon: ICONS[id] }));

// The last card: not a game, it opens one of them at random.
export const RANDOM_CARD: GameCard = { title: 'Random', icon: ICONS.random };

export function randomGamePath(random: Random = cryptoRandom): string {
  return pick(GAME_CARDS, random).path ?? '/';
}
