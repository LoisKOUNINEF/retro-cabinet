import type { Invaders } from './invaders.js';
import { CANNON, CANNON_Y, GROUND_Y, HEIGHT, INVADER_SPRITES, UFO, UFO_Y, WIDTH, type Sprite } from './sprites.js';

const WHITE = '#ffffff';
const GREEN = '#3cd23c';
const RED = '#e03c3c';

// One fillRect per lit pixel.
export function drawSprite(ctx: CanvasRenderingContext2D, sprite: Sprite, x: number, y: number, colour: string): void {
  ctx.fillStyle = colour;
  sprite.forEach((row, dy) => [...row].forEach((pixel, dx) => {
    if (pixel === '#') ctx.fillRect(Math.round(x) + dx, Math.round(y) + dy, 1, 1);
  }));
}

// Pure rendering of the game state: no rules in here.
export function drawInvaders(ctx: CanvasRenderingContext2D, game: Invaders): void {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  if (game.ufo) drawSprite(ctx, UFO, game.ufo.x, UFO_Y, RED);

  game.invaders.forEach((invader) => {
    const { x, y } = game.invaderRect(invader);
    drawSprite(ctx, INVADER_SPRITES[invader.type][game.fleet.frame as 0 | 1], x, y, WHITE);
  });

  ctx.fillStyle = GREEN;
  game.shieldChunks.forEach(({ x, y, width, height }) => ctx.fillRect(x, y, width, height));

  if (!game.isOver) drawSprite(ctx, CANNON, game.cannonX, CANNON_Y, GREEN);

  ctx.fillStyle = WHITE;
  if (game.shot) ctx.fillRect(game.shot.x, game.shot.y, game.shot.width, game.shot.height);
  // Bombs zig-zag: the middle pixel swings with height.
  game.bombs.forEach(({ x, y, height }) => {
    for (let dy = 0; dy < height; dy++) {
      const swing = (Math.floor(y / 2) + dy) % 4;
      ctx.fillRect(x + (swing === 1 ? 0 : swing === 3 ? 2 : 1), y + dy, 1, 1);
    }
  });

  ctx.fillStyle = GREEN;
  ctx.fillRect(0, GROUND_Y + 2, WIDTH, 1);
}
