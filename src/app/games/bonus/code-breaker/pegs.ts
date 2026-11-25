import type { Sprite } from '../../sprites.js';

const DISC = [
  '..#####..',
  '.#######.',
  '#########',
  '#########',
  '#########',
  '#########',
  '#########',
  '.#######.',
  '..#####..',
];

// The disc with a 5×5 symbol cut out of its middle ('#' = cut), so each colour also reads by its shape.
const cutOut = (symbol: string[]): Sprite => DISC.map((row, y) => [...row].map((pixel, x) => {
  const cut = symbol[y - 2]?.[x - 2] === '#';
  return cut ? '.' : pixel;
}).join(''));

export interface Peg {
  // Its CSS modifier: code-breaker__peg--<id>.
  id: string;
  name: string;
  sprite: Sprite;
}

// The code's colours, then Empty (an empty hole, played as a colour on Hard): a peg is an index here.
export const PEGS: readonly Peg[] = [
  { id: 'red', name: 'Red', sprite: DISC },
  { id: 'orange', name: 'Orange', sprite: cutOut(['..#..', '..#..', '#####', '..#..', '..#..']) },
  { id: 'yellow', name: 'Yellow', sprite: cutOut(['.....', '.....', '#####', '.....', '.....']) },
  { id: 'green', name: 'Green', sprite: cutOut(['#...#', '.#.#.', '..#..', '.#.#.', '#...#']) },
  { id: 'cyan', name: 'Cyan', sprite: cutOut(['#####', '#...#', '#...#', '#...#', '#####']) },
  { id: 'blue', name: 'Blue', sprite: cutOut(['..#..', '.#.#.', '#...#', '.#.#.', '..#..']) },
  { id: 'purple', name: 'Purple', sprite: cutOut(['.....', '..#..', '.###.', '#####', '.....']) },
  { id: 'pink', name: 'Pink', sprite: cutOut(['.....', '.###.', '.###.', '.###.', '.....']) },
  { id: 'empty', name: 'Empty', sprite: cutOut(['#####', '#####', '#####', '#####', '#####']) },
];

export const EMPTY = PEGS.length - 1;

// A hole not filled yet in the row being played, or still to come.
export const HOLE: Sprite = ['.....', '.....', '..#..', '.....', '.....'];

// The feedback: right colour in the right place, right colour in the wrong place, nothing.
export const KEY_EXACT: Sprite = ['.###.', '#####', '#####', '#####', '.###.'];
export const KEY_MISPLACED: Sprite = ['.###.', '#...#', '#...#', '#...#', '.###.'];
export const KEY_NONE: Sprite = ['.....', '.....', '..#..', '.....', '.....'];
