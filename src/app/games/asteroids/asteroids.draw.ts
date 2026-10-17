import type { Asteroids } from './asteroids.js';
import { BULLET_RADIUS, HEIGHT, ROCKS, SAUCERS, SHIP_RADIUS, WIDTH, type Rock, type Saucer, type Ship } from './field.js';

const LINE = '#ffffff';
// Invulnerable ships blink: visible half of every 200 ms.
const BLINK_MS = 200;

// Pure rendering of the game state, in the arcade's vector style: white outlines on black.
export function drawAsteroids(ctx: CanvasRenderingContext2D, game: Asteroids): void {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = LINE;
  ctx.fillStyle = LINE;
  ctx.lineWidth = 1;

  game.rocks.forEach((rock) => drawRock(ctx, rock));
  if (game.saucer) drawSaucer(ctx, game.saucer);
  [...game.bullets, ...game.saucerBullets].forEach(({ x, y }) => {
    ctx.beginPath();
    ctx.arc(x, y, BULLET_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  });

  const blinkedOut = game.invulnerableMs > 0 && Math.floor(game.invulnerableMs / BLINK_MS) % 2 === 1;
  if (!game.isOver && !blinkedOut) drawShip(ctx, game.ship, game.thrusting);
}

// Points of a shape given around (0, 0), turned by `angle` and moved to (x, y).
function outline(ctx: CanvasRenderingContext2D, points: [number, number][], x: number, y: number, angle = 0): void {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  ctx.beginPath();
  points.forEach(([px, py], i) => {
    const tx = x + px * cos - py * sin;
    const ty = y + px * sin + py * cos;
    if (i === 0) ctx.moveTo(tx, ty);
    else ctx.lineTo(tx, ty);
  });
  ctx.closePath();
  ctx.stroke();
}

function drawShip(ctx: CanvasRenderingContext2D, ship: Ship, thrusting: boolean): void {
  const r = SHIP_RADIUS;
  outline(ctx, [[0, -r * 1.4], [r, r], [0, r * 0.5], [-r, r]], ship.x, ship.y, ship.angle);
  // The flame flickers: drawn on every other 50 ms.
  if (thrusting && Math.floor(Date.now() / 50) % 2 === 0) {
    outline(ctx, [[-r * 0.5, r * 0.75], [0, r * 1.8], [r * 0.5, r * 0.75]], ship.x, ship.y, ship.angle);
  }
}

function drawRock(ctx: CanvasRenderingContext2D, rock: Rock): void {
  const radius = ROCKS[rock.size].radius;
  const step = (Math.PI * 2) / rock.shape.length;
  const points = rock.shape.map((factor, i): [number, number] =>
    [Math.sin(i * step) * radius * factor, -Math.cos(i * step) * radius * factor]);
  outline(ctx, points, rock.x, rock.y);
}

// The classic saucer: a lens with a dome on top.
function drawSaucer(ctx: CanvasRenderingContext2D, saucer: Saucer): void {
  const r = saucer.small ? SAUCERS.small.radius : SAUCERS.large.radius;
  outline(ctx, [[-r, 0], [-r * 0.5, -r * 0.4], [r * 0.5, -r * 0.4], [r, 0], [r * 0.5, r * 0.4], [-r * 0.5, r * 0.4]], saucer.x, saucer.y);
  outline(ctx, [[-r * 0.3, -r * 0.4], [-r * 0.2, -r * 0.8], [r * 0.2, -r * 0.8], [r * 0.3, -r * 0.4]], saucer.x, saucer.y);
}
