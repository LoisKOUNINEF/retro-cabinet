import type { GameCard } from '../../components/game-card/game-card.component.js';
import { cryptoRandom, pick, type Random } from '../../games/game.js';
import { INVADER_SPRITES } from '../../games/invaders/sprites.js';
import { TETROMINOES } from '../../games/tetris/tetrominoes.js';

// A Tetris shape matrix (1 = block) as pixel rows, without its empty rows.
const fromShape = (shape: number[][]) =>
  shape.filter((row) => row.some(Boolean)).map((row) => row.map((cell) => (cell ? '#' : '.')).join(''));

// Pixel-art icons: one string per row, '#' is a lit pixel. Some reuse the games' own sprites.
const ICONS = {
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
  frog: [
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
  question: [
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
};

// The home page's games, in display order. The secret game is deliberately not listed.
export const GAME_CARDS: GameCard[] = [
  { title: 'Tetris', path: '/games/tetris', icon: fromShape(TETROMINOES.T) },
  { title: 'Pacman', path: '/games/pacman', icon: ICONS.pacman },
  { title: 'Space Invaders', path: '/games/invaders', icon: INVADER_SPRITES.crab[0] },
  { title: 'Snake', path: '/games/snake', icon: ICONS.snake },
  { title: 'Arkanoid', path: '/games/arkanoid', icon: ICONS.arkanoid },
  { title: 'Asteroids', path: '/games/asteroids', icon: ICONS.asteroids },
  { title: 'Columns', path: '/games/columns', icon: ICONS.columns },
  { title: 'Frogger', path: '/games/frogger', icon: ICONS.frog },
  { title: 'Pong', path: '/games/pong', icon: ICONS.pong },
];

// The last card: not a game, it opens one of them at random.
export const RANDOM_CARD: GameCard = { title: 'Random', icon: ICONS.question };

export function randomGamePath(random: Random = cryptoRandom): string {
  return pick(GAME_CARDS, random).path ?? '/';
}
