import { hitRect, paddleBounce } from '#root/dist/src/app/games/arkanoid/physics.js';
import { rotate, withSpeed } from '#root/dist/src/app/games/game.js';

const ball = (x, y) => ({ x, y, vx: 0, vy: 0, stuck: false, offset: 0 });
const rect = { x: 10, y: 10, width: 16, height: 8 };
const near = (a, b) => Math.abs(a - b) < 1e-9;

describe('Arkanoid physics', () => {
  it('misses a rect the ball does not touch', () => {
    expect(hitRect(ball(0, 0), rect)).toBe(null);
    expect(hitRect(ball(18, 21), rect)).toBe(null);
  });

  it('bounces on y when hitting the top or bottom of a rect', () => {
    expect(hitRect(ball(18, 8), rect)).toBe('y');
    expect(hitRect(ball(18, 20), rect)).toBe('y');
  });

  it('bounces on x when hitting the side of a rect', () => {
    expect(hitRect(ball(8, 14), rect)).toBe('x');
    expect(hitRect(ball(28, 14), rect)).toBe('x');
  });

  it('sends the ball straight up from the centre of the paddle', () => {
    const paddle = { x: 0, y: 0, width: 32, height: 6 };
    const { vx, vy } = paddleBounce(16, paddle, 100);
    expect(near(vx, 0)).toBeTruthy();
    expect(near(vy, -100)).toBeTruthy();
  });

  it('bounces up to 60° from the edges, keeping the speed', () => {
    const paddle = { x: 0, y: 0, width: 32, height: 6 };
    const right = paddleBounce(32, paddle, 100);
    expect(near(right.vx, 100 * Math.sin(Math.PI / 3))).toBeTruthy();
    expect(near(right.vy, -50)).toBeTruthy();

    // Past the edge is clamped.
    const left = paddleBounce(-10, paddle, 100);
    expect(near(left.vx, -right.vx)).toBeTruthy();
    expect(near(Math.hypot(left.vx, left.vy), 100)).toBeTruthy();
  });

  it('rescales and rotates velocities', () => {
    const scaled = withSpeed({ vx: 3, vy: 4 }, 10);
    expect(near(scaled.vx, 6) && near(scaled.vy, 8)).toBeTruthy();

    const turned = rotate({ vx: 1, vy: 0 }, Math.PI / 2);
    expect(near(turned.vx, 0) && near(turned.vy, 1)).toBeTruthy();
  });
});
