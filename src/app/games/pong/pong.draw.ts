import type { Pong } from './pong.js';
import { AI_X, BALL_SIZE, HEIGHT, PADDLE_HEIGHT, PADDLE_WIDTH, PLAYER_X, WIDTH } from './field.js';

const WHITE = '#ffffff';
const DASH = 6;
const DASH_GAP = 6;

// Pure rendering of the game state, arcade style: white on black.
export function drawPong(ctx: CanvasRenderingContext2D, game: Pong): void {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = WHITE;

  // The dashed net.
  for (let y = 0; y < HEIGHT; y += DASH + DASH_GAP) ctx.fillRect(WIDTH / 2 - 1, y, 2, DASH);

  // Match points, big, at the top of each half.
  ctx.font = 'bold 32px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(String(game.playerPoints), WIDTH / 4, 8);
  ctx.fillText(String(game.aiPoints), (WIDTH * 3) / 4, 8);

  [[PLAYER_X, game.playerY], [AI_X, game.aiY]].forEach(([x = 0, y = 0]) => {
    ctx.fillRect(x - PADDLE_WIDTH / 2, y - PADDLE_HEIGHT / 2, PADDLE_WIDTH, PADDLE_HEIGHT);
  });

  ctx.fillRect(game.ball.x - BALL_SIZE / 2, game.ball.y - BALL_SIZE / 2, BALL_SIZE, BALL_SIZE);
}
