import { Arkanoid } from '#root/dist/src/app/games/arkanoid/arkanoid.js';
import { drawArkanoid } from '#root/dist/src/app/games/arkanoid/arkanoid.draw.js';

// Records every drawing call by name.
const fakeContext = () => {
  const calls = [];
  const record = (name) => (...args) => calls.push({ name, args });
  return {
    calls,
    count: (name) => calls.filter((call) => call.name === name).length,
    fillRect: record('fillRect'),
    beginPath: record('beginPath'),
    arc: record('arc'),
    fill: record('fill'),
    fillText: record('fillText'),
  };
};

describe('drawArkanoid', () => {
  it('draws the background, every brick (with metal highlights), the paddle and the ball', () => {
    const game = new Arkanoid();
    const ctx = fakeContext();

    drawArkanoid(ctx, game);

    // Round 1: 78 bricks, 13 of them silver.
    expect(ctx.count('fillRect')).toBe(1 + 78 + 13 + 3);
    expect(ctx.count('arc')).toBe(1);
    expect(ctx.count('fillText')).toBe(0);
  });

  it('draws a falling capsule with its letter', () => {
    const game = new Arkanoid();
    game.capsule = { x: 50, y: 100, kind: 'D' };
    const ctx = fakeContext();

    drawArkanoid(ctx, game);

    const text = ctx.calls.find((call) => call.name === 'fillText');
    expect(text.args[0]).toBe('D');
  });

  it('is what the game draws itself with', () => {
    const game = new Arkanoid();
    const ctx = fakeContext();
    game.draw(ctx);
    expect(ctx.count('fillRect')).toBeGreaterThan(0);
  });
});
