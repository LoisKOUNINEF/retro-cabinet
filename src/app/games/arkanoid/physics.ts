import type { Rect, Velocity } from '../game.js';

export const BALL_RADIUS = 2.5;
// Steepest bounce off the paddle's edges, from vertical.
const MAX_BOUNCE_ANGLE = Math.PI / 3;

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  // Resting on the paddle, `offset` units from its left edge, until launched.
  stuck: boolean;
  offset: number;
}

// Does the ball (as its bounding square) overlap the rect? Returns the side to bounce on:
// 'x' when it came in from the left or right, 'y' from above or below (the smaller overlap).
export function hitRect(ball: Ball, rect: Rect): 'x' | 'y' | null {
  const overlapX = Math.min(ball.x + BALL_RADIUS, rect.x + rect.width) - Math.max(ball.x - BALL_RADIUS, rect.x);
  const overlapY = Math.min(ball.y + BALL_RADIUS, rect.y + rect.height) - Math.max(ball.y - BALL_RADIUS, rect.y);
  if (overlapX <= 0 || overlapY <= 0) return null;
  return overlapX < overlapY ? 'x' : 'y';
}

// Arcade paddle: the further from the centre the ball lands, the wider the angle
// (straight up in the middle, 60° at the edges), always upwards at the given speed.
export function paddleBounce(ballX: number, paddle: Rect, speed: number): Velocity {
  const half = paddle.width / 2;
  const offset = Math.min(Math.max((ballX - (paddle.x + half)) / half, -1), 1);
  const angle = offset * MAX_BOUNCE_ANGLE;
  return { vx: speed * Math.sin(angle), vy: -speed * Math.cos(angle) };
}
