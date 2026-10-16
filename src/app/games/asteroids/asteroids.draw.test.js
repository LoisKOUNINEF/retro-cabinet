import { Asteroids } from '#root/dist/src/app/games/asteroids/asteroids.js';
import { drawAsteroids } from '#root/dist/src/app/games/asteroids/asteroids.draw.js';

// Counts drawing calls by name.
const fakeContext = () => {
  const counts = {};
  const ctx = { counts };
  ['fillRect', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'stroke', 'arc', 'fill'].forEach((name) => {
    ctx[name] = () => { counts[name] = (counts[name] ?? 0) + 1; };
  });
  return ctx;
};

describe('drawAsteroids', () => {
  let game;
  let now;

  beforeEach(() => {
    game = new Asteroids({ random: () => 0.5 });
    // An even 50 ms slot: the thrust flame is in its visible phase.
    now = spyOn(Date, 'now').andReturn(0);
  });

  afterEach(() => now.restore());

  it('outlines every rock and the ship, on a black background', () => {
    const ctx = fakeContext();
    drawAsteroids(ctx, game);

    expect(ctx.counts.fillRect).toBe(1);
    // 4 rocks + the ship.
    expect(ctx.counts.stroke).toBe(5);
    // 10 points per rock, 4 for the ship: one moveTo each, the rest lineTo.
    expect(ctx.counts.moveTo).toBe(5);
    expect(ctx.counts.lineTo).toBe(4 * 9 + 3);
  });

  it('adds the flame only while thrusting', () => {
    game.handleKey('ArrowUp');
    const ctx = fakeContext();
    drawAsteroids(ctx, game);
    expect(ctx.counts.stroke).toBe(6);
  });

  it('draws bullets as dots and the saucer as two outlines', () => {
    game.bullets = [{ x: 10, y: 10, vx: 0, vy: 0, life: 500 }];
    game.saucerBullets = [{ x: 20, y: 20, vx: 0, vy: 0, life: 500 }];
    game.saucer = { small: false, x: 100, y: 50, vx: 0, vy: 0, fireMs: 1000, turnMs: 1000 };
    const ctx = fakeContext();
    drawAsteroids(ctx, game);

    expect(ctx.counts.arc).toBe(2);
    expect(ctx.counts.stroke).toBe(5 + 2);
  });

  it('blinks the ship while it is protected after a respawn', () => {
    game.invulnerableMs = 300;
    const ctx = fakeContext();
    drawAsteroids(ctx, game);
    expect(ctx.counts.stroke).toBe(4);
  });

  it('is what the game draws itself with', () => {
    const ctx = fakeContext();
    game.draw(ctx);
    expect(ctx.counts.stroke).toBeGreaterThan(0);
  });
});
