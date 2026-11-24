import { pick, type Random } from '../../game.js';
import type { Difficulty } from '../turns.js';
import { GRID, around, shipCells, sideNeighbours, type Ship, type Shot } from './fleet.js';

// What the AI knows of the player's waters: its own shots, the ships it sank (they are announced),
// and the sizes of those still afloat.
export interface Sight {
  shots: readonly (Shot | null)[];
  sunk: readonly Ship[];
  afloat: readonly number[];
  // Ships may touch: off, nothing lies around a sunk ship.
  touching: boolean;
}

// A placement covering a hit not yet explained by a sunk ship is this much likelier, per hit.
export const HIT_WEIGHT = 20;

const rowOf = (cell: number) => Math.floor(cell / GRID);
const columnOf = (cell: number) => cell % GRID;

// The cells that may still hide a ship: not fired at, and with touching off, not next to a sunk ship.
export function candidates({ shots, sunk, touching }: Sight): number[] {
  const empty = new Set<number>(touching ? [] : sunk.flatMap(({ cells }) => cells.flatMap(around)));
  return shots.flatMap((shot, cell) => (shot === null && !empty.has(cell) ? [cell] : []));
}

// Hits on ships still afloat.
export function openHits({ shots, sunk }: Sight): number[] {
  const sunkCells = new Set(sunk.flatMap(({ cells }) => cells));
  return shots.flatMap((shot, cell) => (shot === 'hit' && !sunkCells.has(cell) ? [cell] : []));
}

// Medium: around the open hits (along their line when two are side by side), else a checkerboard
// spaced by the smallest ship afloat.
function huntAndTarget(sight: Sight, random: Random): number {
  const open = candidates(sight);
  const allowed = new Set(open);
  const hits = openHits(sight);
  const hitSet = new Set(hits);
  if (hits.length) {
    const along = hits.flatMap((hit) => [1, GRID].flatMap((step) => {
      const sameLine = (a: number, b: number) => (step === 1 ? rowOf(a) === rowOf(b) : columnOf(a) === columnOf(b));
      const lined = [hit - step, hit + step].some((next) => hitSet.has(next) && sameLine(hit, next));
      if (!lined) return [];
      // The first cell past each end of the line of hits.
      return [-step, step].flatMap((direction) => {
        let cell = hit;
        while (hitSet.has(cell + direction) && sameLine(cell, cell + direction)) cell += direction;
        const next = cell + direction;
        return next >= 0 && next < GRID * GRID && sameLine(cell, next) && allowed.has(next) ? [next] : [];
      });
    }));
    if (along.length) return pick(along, random);
    const next = hits.flatMap(sideNeighbours).filter((cell) => allowed.has(cell));
    if (next.length) return pick(next, random);
  }
  const spacing = Math.min(...sight.afloat, GRID);
  const checker = open.filter((cell) => (rowOf(cell) + columnOf(cell)) % spacing === 0);
  return pick(checker.length ? checker : open, random);
}

// Hard: every way each ship afloat still fits (not on a miss or a sunk ship, nor next to one with
// touching off), counted on each cell it covers; covering open hits makes a way much likelier.
export function heatMap(sight: Sight): number[] {
  const heat = Array<number>(GRID * GRID).fill(0);
  const open = new Set(candidates(sight));
  const hits = new Set(openHits(sight));
  sight.afloat.forEach((size) => {
    for (let i = 0; i < GRID * GRID * 2; i++) {
      const cells = shipCells(size, { start: i >> 1, horizontal: i % 2 === 0 });
      if (!cells || !cells.every((cell) => open.has(cell) || hits.has(cell))) continue;
      const weight = HIT_WEIGHT ** cells.filter((cell) => hits.has(cell)).length;
      cells.forEach((cell) => open.has(cell) && (heat[cell]! += weight));
    }
  });
  return heat;
}

// The AI's next shot, at a cell it hasn't fired at:
// - Easy: anywhere.
// - Medium: hunts on a checkerboard, then finishes off the ship it hit.
// - Hard: where the ships left most likely are.
export function chooseShot(sight: Sight, difficulty: Difficulty, random: Random): number {
  const untried = sight.shots.flatMap((shot, cell) => (shot === null ? [cell] : []));
  if (difficulty === 'easy') return pick(untried, random);
  const open = candidates(sight);
  if (!open.length) return pick(untried, random);
  if (difficulty === 'medium') return huntAndTarget(sight, random);
  const heat = heatMap(sight);
  const best = Math.max(...open.map((cell) => heat[cell]!));
  return pick(open.filter((cell) => heat[cell] === best), random);
}
