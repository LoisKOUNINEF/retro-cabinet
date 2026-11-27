import type { Sprite } from '../../sprites.js';

// Pixel art for a pit's seeds: 2×2 seeds on a 4×3 grid, filled from the middle out.
// SEED_SPRITES[n] shows n seeds, up to MAX_DRAWN; more show as a pile (with the count beside).
export const MAX_DRAWN = 12;

const WIDTH = 11;
const HEIGHT = 8;
// Each slot's top-left pixel, in filling order: the middle row, the top, the bottom, then the sides.
const SLOTS: [number, number][] = [
  [3, 3], [6, 3], [3, 0], [6, 0], [3, 6], [6, 6],
  [0, 3], [9, 3], [0, 0], [9, 0], [0, 6], [9, 6],
];

function seeds(count: number): Sprite {
  const rows = Array.from({ length: HEIGHT }, () => Array<string>(WIDTH).fill('.'));
  SLOTS.slice(0, count).forEach(([x, y]) => [0, 1].forEach((dy) => [0, 1].forEach((dx) => (rows[y + dy]![x + dx] = '#'))));
  return rows.map((row) => row.join(''));
}

export const SEED_SPRITES: Sprite[] = Array.from({ length: MAX_DRAWN + 1 }, (_, count) => seeds(count));

// A heap of seeds, for pits holding more than MAX_DRAWN.
export const PILE_SPRITE: Sprite = [
  '....##.....',
  '...####....',
  '..##.###...',
  '..#######..',
  '.###.##.##.',
  '.#########.',
  '###.###.###',
  '###########',
];

export const seedSprite = (count: number): Sprite => SEED_SPRITES[count] ?? PILE_SPRITE;
