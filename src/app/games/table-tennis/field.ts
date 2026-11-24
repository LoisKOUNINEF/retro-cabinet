// The court, in logical units (the canvas scales them). Positions are centres.
export const WIDTH = 320;
export const HEIGHT = 240;
export const PADDLE_WIDTH = 4;
export const PADDLE_HEIGHT = 32;
export const PLAYER_X = 12;
export const AI_X = WIDTH - 16;
export const BALL_SIZE = 4;

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
