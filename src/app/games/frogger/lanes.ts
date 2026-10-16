export const WIDTH = 15;
export const HEIGHT = 13;

export const HOME_ROW = 0;
export const START_ROW = HEIGHT - 1;
// Home slots on the top row; every other cell there is hedge.
export const HOME_COLUMNS = [1, 4, 7, 10, 13];

export type LaneKind = 'log' | 'turtle' | 'car' | 'truck';

export interface Lane {
  row: number;
  kind: LaneKind;
  // Circular, one char per column: '=' is an object, '.' is empty,
  // '~' a turtle that dives when the diving-turtles option is on.
  pattern: string;
  // +1 moves right, -1 moves left.
  direction: 1 | -1;
  // Moves one cell every `period` ticks (50 ms each on level 1: period 20 is 1 cell/s).
  period: number;
}

export const isRiver = (kind: LaneKind) => kind === 'log' || kind === 'turtle';

// Diving turtles (ticks): surfaced, then warn (drawn darker), then under water.
export const DIVE_CYCLE = 80;
export const DIVE_WARNING_AT = 48;
export const DIVE_UNDER_AT = 60;

// Speeds estimated from the arcade game (no lane table is published): about 1 to 1.7
// cells/s on level 1, with a fast long-log row and a fast race car, as in the original.
export const LANES: Lane[] = [
  // River (rows 1-5): the frog must stand on a log or turtle.
  { row: 1, kind: 'log',    pattern: '===....====....', direction: 1,  period: 12 },
  { row: 2, kind: 'turtle', pattern: '==...~~~..==...', direction: -1, period: 14 },
  { row: 3, kind: 'log',    pattern: '======.....===.', direction: 1,  period: 8 },
  { row: 4, kind: 'turtle', pattern: '..~~~...===....', direction: -1, period: 16 },
  { row: 5, kind: 'log',    pattern: '====...====....', direction: 1,  period: 14 },
  // Row 6 is the safe median.
  // Road (rows 7-11): the frog must avoid vehicles.
  { row: 7,  kind: 'truck', pattern: '..==.....==....', direction: -1, period: 16 },
  { row: 8,  kind: 'car',   pattern: '=.....=.....=..', direction: 1,  period: 8 },
  { row: 9,  kind: 'car',   pattern: '...=....=....=.', direction: -1, period: 14 },
  { row: 10, kind: 'car',   pattern: '=....=.....=...', direction: 1,  period: 16 },
  { row: 11, kind: 'car',   pattern: '....=......=...', direction: -1, period: 20 },
];
