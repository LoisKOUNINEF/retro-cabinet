import type { Rect } from '../game.js';

// Screen layout, in logical units (16px tiles, as in the arcade): the canvas scales them.
export const TILE = 16;
export const COLUMNS = 15;
// Rows 0-12 are played on; the last row is the HUD (lives and time bar).
export const PLAY_ROWS = 13;
export const WIDTH = COLUMNS * TILE;
export const HUD_Y = PLAY_ROWS * TILE;
export const HEIGHT = HUD_Y + TILE;

export const HOME_ROW = 0;
export const MEDIAN_ROW = 6;
export const START_ROW = PLAY_ROWS - 1;

// The arcade's 60 seconds per frog (with the time limit on).
export const TIME_LIMIT = 60_000;

// The five bays in the hedge: a frog lands in one when its centre is inside.
const BAY_WIDTH = 24;
export const BAYS: Rect[] = [1, 4, 7, 10, 13].map((col) => ({
  x: col * TILE + (TILE - BAY_WIDTH) / 2,
  y: 0,
  width: BAY_WIDTH,
  height: TILE,
}));

export type LaneKind = 'log' | 'turtle' | 'car' | 'bulldozer' | 'racer' | 'truck';

export interface Lane {
  row: number;
  kind: LaneKind;
  // One char per tile, looping around: '=' is an object, '.' is empty,
  // '~' turtles that dive when the diving-turtles option is on, 'C' a log that turns
  // into a crocodile on later levels.
  pattern: string;
  // +1 moves right, -1 moves left.
  direction: 1 | -1;
  // px per second on level 1.
  speed: number;
}

export const isRiver = (kind: LaneKind) => kind === 'log' || kind === 'turtle';

// Diving turtles (ms): surfaced, then warn (drawn sinking), then under water.
export const DIVE_CYCLE_MS = 4000;
export const DIVE_WARNING_MS = 2400;
export const DIVE_UNDER_MS = 3000;

// Speeds estimated from the arcade game (no lane table is published): about 1 to 1.7
// tiles/s on level 1, with a fast long-log row and, in the fast lane, a lone race car
// zooming by at three times the speed of the rest of the traffic, as in the original.
export const LANES: Lane[] = [
  // River (rows 1-5): the frog must stand on a log or turtle.
  { row: 1, kind: 'log',    pattern: '===....CCCC....', direction: 1,  speed: 27 },
  { row: 2, kind: 'turtle', pattern: '==...~~~..==...', direction: -1, speed: 23 },
  { row: 3, kind: 'log',    pattern: '======.....===.', direction: 1,  speed: 40 },
  { row: 4, kind: 'turtle', pattern: '..~~~...===....', direction: -1, speed: 20 },
  { row: 5, kind: 'log',    pattern: '====...====....', direction: 1,  speed: 23 },
  // Row 6 is the median: safe, until a snake slithers along it (level 2).
  // Road (rows 7-11): the frog must avoid vehicles.
  { row: 7,  kind: 'truck',     pattern: '..==.....==....', direction: -1, speed: 20 },
  { row: 8,  kind: 'racer',     pattern: '=..............', direction: 1,  speed: 120 },
  { row: 9,  kind: 'car',       pattern: '...=....=....=.', direction: -1, speed: 23 },
  { row: 10, kind: 'bulldozer', pattern: '=....=.....=...', direction: 1,  speed: 20 },
  { row: 11, kind: 'car',       pattern: '....=......=...', direction: -1, speed: 16 },
];

// One log, vehicle or group of turtles, at its position before the lane moves.
export interface LaneObject {
  x: number;
  width: number;
  // A group of '~' turtles: dives with the option on.
  diving: boolean;
  // A 'C' log: a crocodile on later levels.
  crocodile: boolean;
}

// Each run of the same char ('=', '~' or 'C') in the pattern is one object.
export function laneObjects(lane: Lane): LaneObject[] {
  const objects: LaneObject[] = [];
  [...lane.pattern].forEach((char, col) => {
    if (char === '.') return;
    const last = objects[objects.length - 1];
    if (last && lane.pattern[col - 1] === char) last.width += TILE;
    else objects.push({ x: col * TILE, width: TILE, diving: char === '~', crocodile: char === 'C' });
  });
  return objects;
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

// Where an object is drawn once its lane has moved by offset px. Lanes loop around: an
// object crossing an edge is in two places at once, half on each side.
export function objectRects(object: LaneObject, row: number, offset: number): Rect[] {
  const x = mod(object.x + offset, WIDTH);
  const rect = { x, y: row * TILE, width: object.width, height: TILE };
  return x + object.width > WIDTH ? [rect, { ...rect, x: x - WIDTH }] : [rect];
}
