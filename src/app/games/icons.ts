import { ALIEN_SPRITES } from './alien-attack/sprites.js';
import type { GameId } from './registry.js';
import type { Sprite } from './sprites.js';
import { TETROMINOES } from './falling-blocks/tetrominoes.js';

// A Falling Blocks shape matrix (1 = block) as pixel rows, without its empty rows.
const fromShape = (shape: number[][]) =>
  shape.filter((row) => row.some(Boolean)).map((row) => row.map((cell) => (cell ? '#' : '.')).join(''));

// Pixel-art icons: one string per row, '#' is a lit pixel. Some reuse the games' own sprites.
export const ICONS = {
  'falling-blocks': fromShape(TETROMINOES.T),
  'alien-attack': ALIEN_SPRITES.crab[0],
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
  'frog-crossing': [
    '.##......##.',
    '####....####',
    '#.##....##.#',
    '############',
    '############',
    '#..........#',
    '.##########.',
    '##..####..##',
  ],
  'maze-chase': [
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
  'space-rocks': [
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
  'jewel-drop': [
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
  'table-tennis': [
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
  'brick-breaker': [
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

// The reward's link on the home page: a cup with its handles, on a stem and a base.
export const CUP_ICON: Sprite = [
  '..############..',
  '##.##########.##',
  '#..##########..#',
  '#..##########..#',
  '#...########...#',
  '.#..########..#.',
  '..##.######.##..',
  '......####......',
  '.......##.......',
  '.......##.......',
  '.....######.....',
  '....########....',
];

// The bonus page's link back to the cabinet: an arcade cabinet, its lit marquee, screen,
// control panel (stick and buttons) and coin door.
export const CABINET_ICON: Sprite = [
  '############',
  '#.##.##.##.#',
  '############',
  '.##......##.',
  '.##......##.',
  '.##......##.',
  '.##......##.',
  '.##########.',
  '############',
  '#.##.#.#.###',
  '############',
  '.##########.',
  '.###....###.',
  '.###....###.',
  '.##########.',
];
