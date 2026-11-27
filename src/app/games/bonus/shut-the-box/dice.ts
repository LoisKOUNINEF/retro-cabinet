import type { Random } from '../../game.js';
import type { Sprite } from '../../sprites.js';

export const DIE_SIDES = 6;

export const rollDie = (random: Random) => Math.floor(random() * DIE_SIDES) + 1;

const sum = (numbers: readonly number[]) => numbers.reduce((total, n) => total + n, 0);

// Every set of `open` tiles adding up to `total`, each in `open`'s order.
export function combinations(open: readonly number[], total: number): number[][] {
  const found: number[][] = [];
  const walk = (from: number, left: number, chosen: number[]) => {
    if (left === 0) {
      found.push(chosen);
      return;
    }
    for (let i = from; i < open.length; i++) {
      const tile = open[i]!;
      if (tile <= left) walk(i + 1, left - tile, [...chosen, tile]);
    }
  };
  if (total > 0) walk(0, total, []);
  return found;
}

// Whether `tile`, added to the tiles already `selected`, still leads to a set adding up to `total`.
export function canComplete(open: readonly number[], selected: readonly number[], tile: number, total: number): boolean {
  if (!open.includes(tile) || selected.includes(tile)) return false;
  const chosen = [...selected, tile];
  const rest = open.filter((n) => !chosen.includes(n));
  const left = total - sum(chosen);
  return left === 0 || (left > 0 && combinations(rest, left).length > 0);
}

// The chance that a roll of `dice` dice gives a total some open tiles add up to.
export function matchChance(open: readonly number[], dice: 1 | 2): number {
  const faces = Array.from({ length: DIE_SIDES }, (_, i) => i + 1);
  const totals = dice === 1 ? faces : faces.flatMap((a) => faces.map((b) => a + b));
  return totals.filter((total) => combinations(open, total).length > 0).length / totals.length;
}

// Pixel art for the faces 1–6: a lit die with its pips dark, the corners rounded.
const PIPS: Record<string, [number, number]> = {
  topLeft: [2, 2], topRight: [6, 2], left: [2, 4], centre: [4, 4], right: [6, 4], bottomLeft: [2, 6], bottomRight: [6, 6],
};
const FACE_PIPS: (keyof typeof PIPS)[][] = [
  ['centre'],
  ['topRight', 'bottomLeft'],
  ['topRight', 'centre', 'bottomLeft'],
  ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'],
  ['topLeft', 'topRight', 'centre', 'bottomLeft', 'bottomRight'],
  ['topLeft', 'topRight', 'left', 'right', 'bottomLeft', 'bottomRight'],
];
const SIZE = 9;

const face = (pips: (keyof typeof PIPS)[]): Sprite => Array.from({ length: SIZE }, (_, y) => Array.from({ length: SIZE }, (_, x) => {
  const corner = (x === 0 || x === SIZE - 1) && (y === 0 || y === SIZE - 1);
  const pip = pips.some((name) => PIPS[name]![0] === x && PIPS[name]![1] === y);
  return corner || pip ? '.' : '#';
}).join(''));

// DIE_FACES[n - 1] shows n.
export const DIE_FACES: Sprite[] = FACE_PIPS.map(face);
