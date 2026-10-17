import { Asteroids, asteroidsGame, wrappedDistance } from '#root/dist/src/app/games/asteroids/asteroids.js';
import { defaultSettings } from '#root/dist/src/app/games/game.js';

const near = (a, b, tolerance = 1e-6) => Math.abs(a - b) < tolerance;
const speedOf = ({ vx, vy }) => Math.hypot(vx, vy);
const newGame = (options = {}) => new Asteroids({ random: () => 0.5, ...options });

// A single still rock in the far corner: the field isn't empty, and nothing hits the ship.
const quietField = (game) => {
  game.rocks = [{ x: 0, y: 0, vx: 0, vy: 0, size: 'large', shape: Array(10).fill(1) }];
  return game;
};
const rockAt = (x, y, size = 'large') => ({ x, y, vx: 0, vy: 0, size, shape: Array(10).fill(1) });
// A bullet just below `thing`, flying up into it on the next short tick.
const shoot = (game, thing, below) => {
  game.bullets = [{ x: thing.x, y: thing.y + below, vx: 0, vy: -300, life: 900 }];
  game.tick(16);
};

describe('Asteroids', () => {
  it('starts wave 1 with 4 large rocks kept away from the ship', () => {
    const game = newGame();

    expect(game.level).toBe(1);
    expect(game.lives).toBe(3);
    expect(game.rocks.length).toBe(4);
    expect(game.rocks.every((rock) => rock.size === 'large')).toBeTruthy();
    expect(game.rocks.every((rock) => wrappedDistance(rock, game.ship) >= 60)).toBeTruthy();
    expect(game.ship).toEqual({ x: 160, y: 120, vx: 0, vy: 0, angle: 0 });
  });

  it('turns while an arrow is held', () => {
    const game = quietField(newGame());
    game.handleKey('ArrowRight');
    game.tick(1000);
    expect(near(game.ship.angle, 4.5)).toBeTruthy();

    game.handleKeyUp('ArrowRight');
    game.tick(1000);
    expect(near(game.ship.angle, 4.5)).toBeTruthy();
  });

  it('thrusts forward, drifts with drag, and never exceeds its top speed', () => {
    const game = quietField(newGame());
    game.handleKey('ArrowUp');
    game.tick(100);
    expect(game.ship.vy).toBeLessThan(0);
    expect(near(game.ship.vx, 0)).toBeTruthy();
    expect(speedOf(game.ship)).toBeGreaterThan(14);
    expect(speedOf(game.ship)).toBeLessThan(16);
    expect(game.thrusting).toBeTruthy();

    game.handleKeyUp('ArrowUp');
    const before = speedOf(game.ship);
    game.tick(1000);
    expect(near(speedOf(game.ship), before / 2)).toBeTruthy();

    game.handleKey('ArrowUp');
    for (let i = 0; i < 200; i++) game.tick(50);
    expect(speedOf(game.ship)).toBeLessThan(200.0001);
  });

  it('wraps around the edges', () => {
    const game = quietField(newGame());
    Object.assign(game.ship, { x: 319, vx: 100 });
    game.tick(100);
    expect(game.ship.x).toBeLessThan(20);
  });

  it('measures distances across the wrapped edges', () => {
    expect(wrappedDistance({ x: 318, y: 120 }, { x: 2, y: 120 })).toBe(4);
    expect(wrappedDistance({ x: 1, y: 1 }, { x: 319, y: 239 })).toBe(Math.hypot(2, 2));
  });

  it('fires from the nose, inheriting the ship\'s speed, and keeps firing while held', () => {
    const game = quietField(newGame());
    game.ship.vx = 50;

    game.handleKey('KeyZ');
    expect(game.bullets.length).toBe(1);
    expect(game.bullets[0]).toEqual({ x: 160, y: 114, vx: 50, vy: -300, life: 900 });

    game.tick(250);
    expect(game.bullets.length).toBe(2);

    game.handleKeyUp('KeyZ');
    game.tick(250);
    expect(game.bullets.length).toBe(2);

    // W fires too: on QWERTY and AZERTY alike, both letters work.
    game.handleKey('KeyW');
    expect(game.bullets.length).toBe(3);
  });

  it('keeps at most 4 bullets, each fading after 0.9 s', () => {
    const game = quietField(newGame());
    game.bullets = [1, 2, 3, 4].map((i) => ({ x: 10 * i, y: 200, vx: 0, vy: 0, life: 5000 }));
    game.handleKey('KeyZ');
    expect(game.bullets.length).toBe(4);

    game.bullets = [{ x: 160, y: 200, vx: 0, vy: 0, life: 900 }];
    game.handleKeyUp('KeyZ');
    game.tick(899);
    expect(game.bullets.length).toBe(1);
    game.tick(1);
    expect(game.bullets.length).toBe(0);
  });

  it('splits rocks large → medium → small → gone, scoring 20, 50 and 100', () => {
    const game = newGame();
    game.rocks = [rockAt(100, 60, 'large'), rockAt(0, 0)];

    shoot(game, game.rocks[0], 18);
    expect(game.score).toBe(20);
    const mediums = game.rocks.filter((rock) => rock.size === 'medium');
    expect(mediums.length).toBe(2);

    game.rocks = [rockAt(100, 60, 'medium'), rockAt(0, 0)];
    shoot(game, game.rocks[0], 10);
    expect(game.score).toBe(70);
    expect(game.rocks.filter((rock) => rock.size === 'small').length).toBe(2);

    game.rocks = [rockAt(100, 60, 'small'), rockAt(0, 0)];
    shoot(game, game.rocks[0], 6);
    expect(game.score).toBe(170);
    expect(game.rocks.length).toBe(1);
  });

  it('gives each rock its own jagged outline', () => {
    const game = new Asteroids({ random: (() => { let i = 0; return () => ((i++ * 0.37) % 1); })() });
    const shapes = game.rocks.map((rock) => rock.shape.join());
    expect(new Set(shapes).size).toBe(shapes.length);
    game.rocks.forEach((rock) => rock.shape.forEach((f) => expect(f >= 0.75 && f <= 1.15).toBeTruthy()));
  });

  it('loses a life when a rock hits the ship, then respawns protected for 2 s', () => {
    const game = newGame();
    game.rocks = [rockAt(160, 120), rockAt(0, 0)];

    game.tick(16);
    expect(game.lives).toBe(2);
    expect(game.ship).toEqual({ x: 160, y: 120, vx: 0, vy: 0, angle: 0 });
    expect(game.invulnerableMs).toBe(2000);

    game.rocks.push(rockAt(160, 120, 'small'));
    game.tick(16);
    expect(game.lives).toBe(2);
  });

  it('ends the game on the last life', () => {
    const game = newGame();
    game.lives = 1;
    game.rocks = [rockAt(160, 120), rockAt(0, 0)];
    game.tick(16);
    expect(game.isOver).toBeTruthy();
  });

  it('awards an extra life every 10,000 points', () => {
    const game = newGame();
    game.score = 9950;
    game.rocks = [rockAt(100, 60, 'small'), rockAt(0, 0)];
    shoot(game, game.rocks[0], 6);
    expect(game.lives).toBe(4);

    game.score = 19950;
    game.rocks = [rockAt(100, 60, 'small'), rockAt(0, 0)];
    shoot(game, game.rocks[0], 6);
    expect(game.lives).toBe(5);
  });

  it('starts the next, bigger wave 2 s after the field is cleared', () => {
    const game = newGame();
    game.rocks = [];
    game.tick(1999);
    expect(game.level).toBe(1);
    game.tick(1);
    expect(game.level).toBe(2);
    expect(game.rocks.length).toBe(6);
  });

  it('starts at the chosen wave, with at most 11 rocks', () => {
    expect([3, 4, 5].map((firstLevel) => newGame({ firstLevel }).rocks.length)).toEqual([8, 10, 11]);
    expect(newGame({ firstLevel: 10 }).rocks.length).toBe(11);
  });

  it('sends a saucer every 15-25 s when saucers are on', () => {
    const game = quietField(newGame({ saucers: true }));
    // random() = 0.5: the first saucer comes after 20 s, large (not under 1/3), from the right.
    game.tick(19_999);
    expect(game.saucer).toBe(null);
    game.tick(1);
    expect(game.saucer.small).toBeFalsy();
    expect(game.saucer.vx).toBe(-60);
  });

  it('sends no saucer with the option off', () => {
    const game = quietField(newGame());
    game.tick(30_000);
    expect(game.saucer).toBe(null);
  });

  it('sends the small saucer once the score is high', () => {
    const game = quietField(newGame({ saucers: true }));
    game.score = 10_000;
    game.tick(20_000);
    expect(game.saucer.small).toBeTruthy();
  });

  it('aims with the small saucer, and fires anywhere with the large one', () => {
    const game = quietField(newGame({ saucers: true }));
    game.saucer = { small: true, x: 60, y: 120, vx: 0, vy: 0, fireMs: 16, turnMs: 5000 };
    game.tick(16);
    const [shot] = game.saucerBullets;
    // The ship is straight to the right; random() = 0.5 means no aiming error.
    expect(near(shot.vx, 200)).toBeTruthy();
    expect(near(shot.vy, 0)).toBeTruthy();
  });

  it('scores 200 or 1000 for a saucer', () => {
    const game = quietField(newGame({ saucers: true }));
    game.saucer = { small: false, x: 100, y: 60, vx: 0, vy: 0, fireMs: 5000, turnMs: 5000 };
    shoot(game, game.saucer, 12);
    expect(game.score).toBe(200);
    expect(game.saucer).toBe(null);

    game.saucer = { small: true, x: 100, y: 60, vx: 0, vy: 0, fireMs: 5000, turnMs: 5000 };
    shoot(game, game.saucer, 7);
    expect(game.score).toBe(1200);
  });

  it('jumps through hyperspace when enabled, with a cooldown and a risk', () => {
    const game = quietField(newGame({ hyperspace: true }));
    game.random = () => 0.25;

    game.handleKey('ArrowDown');
    expect(game.ship).toEqual({ x: 80, y: 60, vx: 0, vy: 0, angle: 0 });
    expect(game.lives).toBe(3);

    game.ship.x = 10;
    game.handleKey('ArrowDown');
    expect(game.ship.x).toBe(10);

    game.tick(1000);
    game.random = () => 0.05;
    game.handleKey('ArrowDown');
    expect(game.lives).toBe(2);
  });

  it('ignores hyperspace with the option off', () => {
    const game = quietField(newGame());
    game.handleKey('ArrowDown');
    expect(game.ship).toEqual({ x: 160, y: 120, vx: 0, vy: 0, angle: 0 });
  });

  it('adapts touch and key hints to the hyperspace option', () => {
    const plain = newGame();
    expect(plain.touch).toEqual({ directions: ['left', 'right', 'up'], action: { label: 'Fire', code: 'KeyZ' } });
    expect(plain.keyHints.map((h) => h.action)).toEqual(['Turn', 'Thrust', 'Fire']);

    const warping = newGame({ hyperspace: true });
    expect(warping.touch.directions).toContain('down');
    expect(warping.keyHints.map((h) => h.action)).toContain('Hyperspace');
  });

  it('saves and restores its exact state, rock shapes and timers included', () => {
    const options = { saucers: true, hyperspace: true };
    const game = newGame(options);
    game.handleKey('ArrowUp');
    game.handleKey('ArrowLeft');
    game.handleKey('KeyZ');
    for (let i = 0; i < 30; i++) game.tick(16);
    game.releaseKeys();

    const copy = newGame(options);
    copy.restore(JSON.parse(JSON.stringify(game.snapshot())));
    expect(copy.snapshot()).toEqual(game.snapshot());

    for (let i = 0; i < 60; i++) { game.tick(16); copy.tick(16); }
    expect(copy.snapshot()).toEqual(game.snapshot());
  });

  it('builds from its definition, saucers and hyperspace on by default', () => {
    expect(asteroidsGame.options.map((o) => o.key)).toEqual(['level', 'saucers', 'hyperspace']);
    expect(defaultSettings(asteroidsGame.options)).toEqual({ level: '1', saucers: 'on', hyperspace: 'on' });

    const game = asteroidsGame.create({ level: '2', saucers: 'off', hyperspace: 'off' });
    expect(game.level).toBe(2);
    expect(game.touch.directions).not.toContain('down');
  });
});
