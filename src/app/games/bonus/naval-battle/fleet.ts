import { pick, type Random } from '../../game.js';

// The grid's side: 10 × 10 cells, row by row.
export const GRID = 10;

export interface ShipType {
  id: string;
  name: string;
  size: number;
}

export const FLEET: readonly ShipType[] = [
  { id: 'carrier', name: 'Carrier', size: 5 },
  { id: 'battleship', name: 'Battleship', size: 4 },
  { id: 'cruiser', name: 'Cruiser', size: 3 },
  { id: 'submarine', name: 'Submarine', size: 3 },
  { id: 'destroyer', name: 'Destroyer', size: 2 },
];

export const shipType = (id: string) => FLEET.find((type) => type.id === id)!;

export interface Ship {
  id: string;
  // Its cells, from its bow (top or left).
  cells: number[];
}

export interface Placement {
  start: number;
  horizontal: boolean;
}

// The cells a ship of that size takes from the start cell, or null when it would leave the grid.
export function shipCells(size: number, { start, horizontal }: Placement): number[] | null {
  const row = Math.floor(start / GRID);
  const column = start % GRID;
  if ((horizontal ? column : row) + size > GRID) return null;
  return Array.from({ length: size }, (_, i) => (horizontal ? start + i : start + i * GRID));
}

// The 8 cells around a cell, inside the grid.
export function around(cell: number): number[] {
  const row = Math.floor(cell / GRID);
  const column = cell % GRID;
  const cells: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = row + dr;
      const c = column + dc;
      if ((dr || dc) && r >= 0 && r < GRID && c >= 0 && c < GRID) cells.push(r * GRID + c);
    }
  }
  return cells;
}

// Up, down, left and right, inside the grid.
export function sideNeighbours(cell: number): number[] {
  const row = Math.floor(cell / GRID);
  const column = cell % GRID;
  return [
    ...(row > 0 ? [cell - GRID] : []),
    ...(row < GRID - 1 ? [cell + GRID] : []),
    ...(column > 0 ? [cell - 1] : []),
    ...(column < GRID - 1 ? [cell + 1] : []),
  ];
}

// Where the ship can't go: the other ships' cells, and with `touching` off, the cells around them too.
export function blockedCells(ships: readonly Ship[], touching: boolean): Set<number> {
  const blocked = new Set<number>();
  ships.forEach(({ cells }) => cells.forEach((cell) => {
    blocked.add(cell);
    if (!touching) around(cell).forEach((next) => blocked.add(next));
  }));
  return blocked;
}

// The ship's cells if it fits among the others: inside the grid, on no ship, and (with `touching`
// off) not next to one, corners included. Null otherwise.
export function fit(ships: readonly Ship[], size: number, placement: Placement, touching: boolean): number[] | null {
  const cells = shipCells(size, placement);
  if (!cells) return null;
  const blocked = blockedCells(ships, touching);
  return cells.some((cell) => blocked.has(cell)) ? null : cells;
}

// Lays the ships not placed yet at random among those placed; starts over (from those) in the
// rare case one has nowhere left to go.
// Ships placed by hand that leave no room for the others are dropped after a few tries.
export function randomFleet(random: Random, touching: boolean, placed: readonly Ship[] = [], types: readonly ShipType[] = FLEET.filter(({ id }) => !placed.some((ship) => ship.id === id))): Ship[] {
  for (let attempt = 1; ; attempt++) {
    if (attempt > 20 && placed.length) return randomFleet(random, touching);
    const ships = [...placed];
    const done = types.every(({ id, size }) => {
      const fits = Array.from({ length: GRID * GRID * 2 }, (_, i) => fit(ships, size, { start: i >> 1, horizontal: i % 2 === 0 }, touching))
        .filter((cells): cells is number[] => cells !== null);
      if (!fits.length) return false;
      ships.push({ id, cells: pick(fits, random) });
      return true;
    });
    if (done) return ships;
  }
}

export type Shot = 'miss' | 'hit';

export interface ShotResult {
  result: 'miss' | 'hit' | 'sunk';
  ship?: Ship;
}

// One side's waters: its fleet, and the shots fired at it.
export class Waters {
  readonly shots: (Shot | null)[] = Array<Shot | null>(GRID * GRID).fill(null);

  constructor(readonly ships: readonly Ship[]) {}

  shipAt(cell: number): Ship | undefined {
    return this.ships.find((ship) => ship.cells.includes(cell));
  }

  isSunk(ship: Ship): boolean {
    return ship.cells.every((cell) => this.shots[cell] === 'hit');
  }

  get sunk(): Ship[] {
    return this.ships.filter((ship) => this.isSunk(ship));
  }

  get shipsLeft(): number {
    return this.ships.length - this.sunk.length;
  }

  get allSunk(): boolean {
    return this.ships.every((ship) => this.isSunk(ship));
  }

  get shotCount(): number {
    return this.shots.filter((shot) => shot !== null).length;
  }

  // A shot at a cell not fired at yet (null for one already fired at).
  fire(cell: number): ShotResult | null {
    if (this.shots[cell] !== null || cell < 0 || cell >= GRID * GRID) return null;
    const ship = this.shipAt(cell);
    this.shots[cell] = ship ? 'hit' : 'miss';
    if (!ship) return { result: 'miss' };
    return { result: this.isSunk(ship) ? 'sunk' : 'hit', ship };
  }
}

// Shown on a cell hit, and a cell missed.
export const HIT_SPRITE = [
  '#..#..#',
  '.#.#.#.',
  '..###..',
  '#######',
  '..###..',
  '.#.#.#.',
  '#..#..#',
];
export const MISS_SPRITE = [
  '.....',
  '.###.',
  '.#.#.',
  '.###.',
  '.....',
];
