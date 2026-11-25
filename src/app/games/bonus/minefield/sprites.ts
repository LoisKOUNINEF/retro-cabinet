import type { Sprite } from '../../sprites.js';

// A round mine with its spikes.
export const MINE: Sprite = [
  '...#...',
  '.#.#.#.',
  '..###..',
  '#######',
  '..###..',
  '.#.#.#.',
  '...#...',
];

export const FLAG: Sprite = [
  '..##...',
  '..####.',
  '..#####',
  '..##...',
  '..#....',
  '..#....',
  '#####..',
];

export const QUESTION: Sprite = [
  '.###.',
  '#...#',
  '...#.',
  '..#..',
  '..#..',
  '.....',
  '..#..',
];

// Over a flag that was wrong, once the round is lost.
export const CROSS: Sprite = [
  '#.....#',
  '.#...#.',
  '..#.#..',
  '...#...',
  '..#.#..',
  '.#...#.',
  '#.....#',
];
