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
  // Moves one cell every `period` ticks.
  period: number;
}

export const isRiver = (kind: LaneKind) => kind === 'log' || kind === 'turtle';

// Diving turtles (ticks): surfaced, then warn (drawn darker), then under water.
export const DIVE_CYCLE = 40;
export const DIVE_WARNING_AT = 24;
export const DIVE_UNDER_AT = 30;

export const LANES: Lane[] = [
  // River (rows 1-5): the frog must stand on a log or turtle.
  { row: 1, kind: 'log',    pattern: '===....====....', direction: 1,  period: 3 },
  { row: 2, kind: 'turtle', pattern: '==...~~~..==...', direction: -1, period: 2 },
  { row: 3, kind: 'log',    pattern: '======.....===.', direction: 1,  period: 2 },
  { row: 4, kind: 'turtle', pattern: '..~~~...===....', direction: -1, period: 3 },
  { row: 5, kind: 'log',    pattern: '====...====....', direction: 1,  period: 4 },
  // Row 6 is the safe median.
  // Road (rows 7-11): the frog must avoid vehicles.
  { row: 7,  kind: 'truck', pattern: '..==.....==....', direction: -1, period: 3 },
  { row: 8,  kind: 'car',   pattern: '=.....=.....=..', direction: 1,  period: 2 },
  { row: 9,  kind: 'car',   pattern: '...=....=....=.', direction: -1, period: 4 },
  { row: 10, kind: 'car',   pattern: '=....=.....=...', direction: 1,  period: 3 },
  { row: 11, kind: 'car',   pattern: '....=......=...', direction: -1, period: 2 },
];
