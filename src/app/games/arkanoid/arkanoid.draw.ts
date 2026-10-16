import type { Arkanoid } from './arkanoid.js';
import { BRICK_HEIGHT, BRICK_WIDTH, CAPSULE_HEIGHT, HEIGHT, PADDLE_HEIGHT, PADDLE_Y, WIDTH, type BrickKind } from './layouts.js';
import { BALL_RADIUS } from './physics.js';

const BRICK_COLOURS: Record<BrickKind, string> = {
  w: '#f0f0f0', o: '#ff8c1a', c: '#3ce0e0', g: '#3cd23c',
  r: '#e03c3c', b: '#3c64ff', p: '#ff6ec8', y: '#f0e03c',
  s: '#a8a8a8', G: '#c8a03c',
};

const CAPSULE_COLOURS = { E: '#3c64ff', S: '#ff8c1a', D: '#3ce0e0', C: '#3cd23c', P: '#a8a8a8' };

// Pure rendering of the game state: no rules in here.
export function drawArkanoid(ctx: CanvasRenderingContext2D, game: Arkanoid): void {
  ctx.fillStyle = '#000030';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  game.bricks.forEach((brick) => {
    ctx.fillStyle = BRICK_COLOURS[brick.kind];
    ctx.fillRect(brick.x, brick.y, brick.width - 1, brick.height - 1);
    // Metal bricks get a highlight line.
    if (brick.kind === 's' || brick.kind === 'G') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(brick.x, brick.y, brick.width - 1, 1);
    }
  });

  // The Vaus: a grey body with red ends.
  const { x, width } = game.paddle;
  ctx.fillStyle = '#c0c0c0';
  ctx.fillRect(x, PADDLE_Y, width, PADDLE_HEIGHT);
  ctx.fillStyle = '#e03c3c';
  ctx.fillRect(x, PADDLE_Y, 4, PADDLE_HEIGHT);
  ctx.fillRect(x + width - 4, PADDLE_Y, 4, PADDLE_HEIGHT);

  ctx.fillStyle = '#ffffff';
  game.balls.forEach((ball) => {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  });

  if (game.capsule) {
    const { x: cx, y: cy, kind } = game.capsule;
    ctx.fillStyle = CAPSULE_COLOURS[kind];
    ctx.fillRect(cx, cy, BRICK_WIDTH, CAPSULE_HEIGHT);
    ctx.fillStyle = '#000000';
    ctx.font = `bold ${BRICK_HEIGHT - 1}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(kind, cx + BRICK_WIDTH / 2, cy + CAPSULE_HEIGHT / 2 + 0.5);
  }
}
