// The playing field, in logical units (the canvas scales them). Every edge wraps around.
export const WIDTH = 320;
export const HEIGHT = 240;
export const SHIP_RADIUS = 6;
export const BULLET_RADIUS = 1.5;
// Each rock's outline: this many points around it, at a random share of its radius.
export const ROCK_POINTS = 10;

export type RockSize = 'large' | 'medium' | 'small';

export const ROCKS: Record<RockSize, { radius: number; points: number; minSpeed: number; maxSpeed: number; splitsInto: RockSize | null }> = {
  large: { radius: 16, points: 20, minSpeed: 20, maxSpeed: 40, splitsInto: 'medium' },
  medium: { radius: 8, points: 50, minSpeed: 40, maxSpeed: 70, splitsInto: 'small' },
  small: { radius: 4, points: 100, minSpeed: 70, maxSpeed: 100, splitsInto: null },
};

export const SAUCERS = {
  large: { radius: 10, points: 200, speed: 60 },
  small: { radius: 5, points: 1000, speed: 80 },
};

export interface Mover {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

// angle: radians, 0 points up, growing clockwise.
export interface Ship extends Mover {
  angle: number;
}

// life: ms left before it fades out.
export interface Bullet extends Mover {
  life: number;
}

export interface Rock extends Mover {
  size: RockSize;
  // ROCK_POINTS radius factors, drawn as a jagged outline.
  shape: number[];
}

export interface Saucer extends Mover {
  small: boolean;
  fireMs: number;
  turnMs: number;
}
