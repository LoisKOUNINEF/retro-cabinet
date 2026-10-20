import { Arkanoid, arkanoidGame } from '#root/dist/src/app/games/arkanoid/arkanoid.js';
import { PADDLE_Y } from '#root/dist/src/app/games/arkanoid/layouts.js';

const brick = (x, y, kind = 'r', hits = 1) => ({ x, y, width: 16, height: 8, kind, hits });
// A brick out of every ball's way, so clearing the test bricks doesn't end the round.
const SPARE = brick(192, 24, 'w');

// Replaces the layout with the given bricks (+ the spare one) and puts a single free ball in play.
const setUp = (game, bricks, ball) => {
  game.bricks = [...bricks, { ...SPARE }];
  game.balls = [{ vx: 0, vy: 0, stuck: false, offset: 0, ...ball }];
  return game;
};

const speedOf = (ball) => Math.hypot(ball.vx, ball.vy);
const near = (a, b) => Math.abs(a - b) < 1e-6;

describe('Arkanoid', () => {
  it('starts round 1 with the ball resting on the paddle', () => {
    const game = new Arkanoid();

    expect(game.level).toBe(1);
    expect(game.lives).toBe(3);
    expect(game.bricks.length).toBe(13 * 6);
    expect(game.paddle).toEqual({ x: 88, width: 32 });
    expect(game.balls[0].stuck).toBeTruthy();
    expect(game.balls[0].x).toBe(108);
    expect(game.kind).toBe('canvas');
  });

  it('moves the paddle while an arrow is held, carrying a resting ball', () => {
    const game = new Arkanoid();

    game.handleKey('ArrowRight');
    game.tick(100);
    expect(game.paddle.x).toBe(106);
    expect(game.balls[0].x).toBe(126);

    game.handleKeyUp('ArrowRight');
    game.tick(100);
    expect(game.paddle.x).toBe(106);
  });

  it('keeps the paddle between the walls', () => {
    const game = new Arkanoid();
    game.handleKey('ArrowRight');
    game.tick(2000);
    expect(game.paddle.x).toBe(208 - 32);

    game.handleKeyUp('ArrowRight');
    game.handleKey('ArrowLeft');
    game.tick(2000);
    expect(game.paddle.x).toBe(0);
  });

  it('stops the paddle when keys are released on pause', () => {
    const game = new Arkanoid();
    game.handleKey('ArrowLeft');
    game.releaseKeys();
    game.tick(100);
    expect(game.paddle.x).toBe(88);
  });

  it('launches the resting ball upwards with ArrowUp', () => {
    const game = new Arkanoid();
    game.handleKey('ArrowUp');

    const ball = game.balls[0];
    expect(ball.stuck).toBeFalsy();
    expect(ball.vy).toBeLessThan(0);
    // It rested right of centre, so it leaves to the right.
    expect(ball.vx).toBeGreaterThan(0);
    expect(near(speedOf(ball), 140)).toBeTruthy();
  });

  it('bounces off the side and top walls', () => {
    const game = setUp(new Arkanoid(), [], { x: 205, y: 150, vx: 100 });
    game.tick(50);
    expect(game.balls[0].vx).toBeLessThan(0);

    setUp(game, [], { x: 100, y: 3, vy: -100 });
    game.tick(50);
    expect(game.balls[0].vy).toBeGreaterThan(0);
  });

  it('bounces off the paddle', () => {
    const game = setUp(new Arkanoid(), [], { x: 104, y: 215, vy: 140 });
    game.tick(100);

    expect(game.balls[0].vy).toBeLessThan(0);
    expect(near(speedOf(game.balls[0]), 140)).toBeTruthy();
  });

  it('breaks a brick, scores and bounces back', () => {
    const game = setUp(new Arkanoid(), [brick(96, 80, 'r')], { x: 104, y: 100, vy: -140 });

    game.tick(200);

    expect(game.bricks.length).toBe(1);
    expect(game.score).toBe(90);
    expect(game.balls[0].vy).toBeGreaterThan(0);
  });

  it('needs several hits for silver bricks and scores 50 × round', () => {
    const game = setUp(new Arkanoid(), [brick(96, 80, 's', 2)], { x: 104, y: 100, vy: -140 });

    game.tick(200);
    expect(game.bricks.length).toBe(2);
    expect(game.score).toBe(0);

    game.balls[0] = { x: 104, y: 100, vx: 0, vy: -140, stuck: false, offset: 0 };
    game.tick(200);
    expect(game.bricks.length).toBe(1);
    expect(game.score).toBe(50);
  });

  it('never breaks gold bricks', () => {
    const game = setUp(new Arkanoid(), [brick(96, 80, 'G')], { x: 104, y: 100, vy: -140 });

    game.tick(200);

    expect(game.bricks.length).toBe(2);
    expect(game.balls[0].vy).toBeGreaterThan(0);
  });

  it('does not let a fast ball pass through a brick', () => {
    // 2000 u/s for 50 ms: 100 units in one frame, far more than a brick is tall.
    const game = setUp(new Arkanoid(), [brick(96, 80, 'r')], { x: 104, y: 130, vy: -2000 });

    game.tick(50);

    expect(game.bricks.length).toBe(1);
    expect(game.balls[0].vy).toBeGreaterThan(0);
  });

  it('loses a life when the last ball falls, then serves a new one', () => {
    const game = setUp(new Arkanoid(), [], { x: 10, y: 239, vy: 200 });

    game.tick(50);

    expect(game.lives).toBe(2);
    expect(game.balls.length).toBe(1);
    expect(game.balls[0].stuck).toBeTruthy();
  });

  it('ends the game when the last life is lost', () => {
    const game = setUp(new Arkanoid(), [], { x: 10, y: 239, vy: 200 });
    game.lives = 1;

    game.tick(50);

    expect(game.isOver).toBeTruthy();
    game.reset();
    expect(game.isOver).toBeFalsy();
    expect(game.lives).toBe(3);
  });

  it('moves to the next layout once every breakable brick is gone', () => {
    const game = new Arkanoid();
    game.bricks = [brick(96, 80, 'r'), brick(0, 24, 'G')];
    game.balls = [{ x: 104, y: 100, vx: 0, vy: -140, stuck: false, offset: 0 }];

    game.tick(200);

    expect(game.level).toBe(2);
    // Layout 2: the staircase (78 bricks) over a silver row (13).
    expect(game.bricks.length).toBe(91);
    expect(game.balls[0].stuck).toBeTruthy();
  });

  it('starts at the chosen round, faster after each lap of 5 layouts', () => {
    const lap2 = new Arkanoid({ firstLevel: 6 });
    expect(lap2.bricks.length).toBe(13 * 6);
    expect(near(lap2.ballSpeed(), 154)).toBeTruthy();

    // From round 9, silver needs 3 hits.
    const round9 = new Arkanoid({ firstLevel: 9 });
    expect(round9.bricks.find((b) => b.kind === 's').hits).toBe(3);
  });

  it('drops no capsules with power-ups off', () => {
    const game = setUp(new Arkanoid({ random: () => 0 }), [brick(96, 80)], { x: 104, y: 100, vy: -140 });
    game.tick(200);
    expect(game.capsule).toBe(null);
  });

  it('drops a capsule from a broken brick with power-ups on, one at a time', () => {
    const game = setUp(new Arkanoid({ powerUps: true, random: () => 0 }), [brick(96, 80), brick(32, 80)], { x: 104, y: 100, vy: -140 });

    game.tick(200);
    expect(game.capsule.kind).toBe('E');
    expect(game.capsule.x).toBe(96);

    const first = game.capsule;
    game.balls[0] = { x: 40, y: 100, vx: 0, vy: -140, stuck: false, offset: 0 };
    game.tick(200);
    expect(game.capsule).toBe(first);
  });

  [
    ['E', (game) => expect(game.paddle.width).toBe(48)],
    ['P', (game) => expect(game.lives).toBe(4)],
    ['C', (game) => expect(game.effect).toBe('catch')],
  ].forEach(([kind, check]) => {
    it(`applies the ${kind} capsule when the paddle catches it`, () => {
      const game = new Arkanoid({ powerUps: true });
      game.capsule = { x: game.paddle.x + 8, y: PADDLE_Y - 8, kind };

      game.tick(100);

      expect(game.capsule).toBe(null);
      check(game);
    });
  });

  it('slows the ball with the S capsule', () => {
    const game = setUp(new Arkanoid({ powerUps: true }), [], { x: 40, y: 150, vy: -140 });
    game.capsule = { x: game.paddle.x + 8, y: PADDLE_Y - 8, kind: 'S' };

    game.tick(100);

    expect(near(speedOf(game.balls[0]), 98)).toBeTruthy();
  });

  it('splits the ball in three with the D capsule, and drops nothing more meanwhile', () => {
    const game = setUp(new Arkanoid({ powerUps: true, random: () => 0 }), [brick(32, 100)], { x: 40, y: 150, vy: -140 });
    game.capsule = { x: game.paddle.x + 8, y: PADDLE_Y - 8, kind: 'D' };

    game.tick(100);
    expect(game.balls.length).toBe(3);
    game.balls.forEach((ball) => expect(near(speedOf(ball), 140)).toBeTruthy());

    // The brick breaks during multi-ball, with random() = 0 that would otherwise drop a capsule.
    for (let i = 0; i < 10; i++) game.tick(50);
    expect(game.bricks.length).toBe(1);
    expect(game.capsule).toBe(null);
  });

  it('catches the ball with C, then releases it after 3 seconds', () => {
    const game = setUp(new Arkanoid({ powerUps: true }), [], { x: 104, y: 215, vy: 140 });
    game.effect = 'catch';

    game.tick(100);
    expect(game.balls[0].stuck).toBeTruthy();

    game.tick(2900);
    expect(game.balls[0].stuck).toBeTruthy();
    game.tick(100);
    expect(game.balls[0].stuck).toBeFalsy();
  });

  it('builds from its definition settings', () => {
    expect(arkanoidGame.options.map((o) => o.key)).toEqual(['level', 'powerups']);
    const game = arkanoidGame.create({ level: '3', powerups: 'on' });
    expect(game.level).toBe(3);
    expect(game.stats()).toEqual({ lives: 3 });
  });

  it('saves and restores its exact state, balls and bricks included', () => {
    const options = { powerUps: true, random: () => 0 };
    const game = new Arkanoid(options);
    game.handleKey('ArrowUp');
    for (let i = 0; i < 40; i++) game.tick(16);

    const copy = new Arkanoid(options);
    copy.restore(JSON.parse(JSON.stringify(game.snapshot())));
    expect(copy.snapshot()).toEqual(game.snapshot());

    for (let i = 0; i < 40; i++) { game.tick(16); copy.tick(16); }
    expect(copy.snapshot()).toEqual(game.snapshot());
  });

  it('moves on a left/right stick and launches with the touch button', () => {
    expect(new Arkanoid().touch).toEqual({ directions: ['left', 'right'], action: { label: 'Launch', code: 'ArrowUp' } });
  });

  it('also launches with the fire keys, Z or W', () => {
    ['KeyZ', 'KeyW'].forEach((code) => {
      const game = new Arkanoid();
      game.handleKey(code);
      expect(game.balls[0].stuck).toBeFalsy();
    });
    expect(new Arkanoid().keyHints).toEqual([
      { action: 'Move', codes: ['ArrowLeft', 'ArrowRight'] },
      { action: 'Launch', codes: ['ArrowUp', 'KeyZ', 'KeyW'] },
    ]);
  });
});
