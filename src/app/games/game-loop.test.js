import { GameLoop } from '#root/dist/src/app/games/game-loop.js';

const fakeGame = () => ({
  isOver: false,
  ms: 100,
  ticks: 0,
  speed() { return this.ms; },
  tick() { this.ticks += 1; },
});

describe('GameLoop', () => {
  beforeEach(() => useFakeTimers());
  afterEach(() => useRealTimers());

  it('ticks the game every speed() ms and calls onTick', () => {
    const game = fakeGame();
    let updates = 0;
    const loop = new GameLoop(game, () => updates++);

    loop.start();
    advanceTimersByTime(99);
    expect(game.ticks).toBe(0);
    advanceTimersByTime(1);
    expect(game.ticks).toBe(1);
    expect(updates).toBe(1);
    expect(loop.isRunning).toBeTruthy();
  });

  it('reads speed() again before every tick', () => {
    const game = fakeGame();
    const loop = new GameLoop(game, () => {});

    loop.start();
    advanceTimersByTime(100);
    game.ms = 50;
    advanceTimersByTime(100);
    expect(game.ticks).toBe(2);
    advanceTimersByTime(100);
    expect(game.ticks).toBe(4);
  });

  it('stops ticking when paused and resumes with toggle()', () => {
    const game = fakeGame();
    const loop = new GameLoop(game, () => {});

    loop.start();
    loop.pause();
    advanceTimersByTime(500);
    expect(game.ticks).toBe(0);
    expect(loop.isRunning).toBeFalsy();

    loop.toggle();
    advanceTimersByTime(100);
    expect(game.ticks).toBe(1);
  });

  it('stops once the game is over and does not restart a finished game', () => {
    const game = fakeGame();
    game.tick = function () { this.ticks += 1; this.isOver = true; };
    const loop = new GameLoop(game, () => {});

    loop.start();
    advanceTimersByTime(1000);
    expect(game.ticks).toBe(1);
    expect(loop.isRunning).toBeFalsy();

    loop.start();
    expect(loop.isRunning).toBeFalsy();
  });

  it('passes the elapsed time to tick()', () => {
    const game = fakeGame();
    let elapsed = 0;
    game.tick = (dt) => { elapsed = dt; };
    const loop = new GameLoop(game, () => {});

    loop.start();
    advanceTimersByTime(100);
    expect(elapsed).toBe(100);
    loop.pause();
  });

  it('ticks realtime games on every animation frame, ignoring speed()', () => {
    const game = { ...fakeGame(), realtime: true, ms: 1000, dts: [] };
    game.tick = (dt) => { game.ticks += 1; game.dts.push(dt); };
    const loop = new GameLoop(game, () => {});

    loop.start();
    advanceTimersByTime(16);
    expect(game.ticks).toBe(1);
    expect(game.dts).toEqual([16]);

    advanceTimersByTime(32);
    expect(game.ticks).toBe(3);

    loop.pause();
    advanceTimersByTime(100);
    expect(game.ticks).toBe(3);
    expect(loop.isRunning).toBeFalsy();
  });

  it('caps a realtime frame at 50 ms', () => {
    const game = { ...fakeGame(), realtime: true, dts: [] };
    game.tick = (dt) => game.dts.push(dt);
    const loop = new GameLoop(game, () => {});

    const startedAt = Date.now();
    loop.start();
    // A stalled frame: the next one runs a whole second later.
    const now = spyOn(Date, 'now').andReturn(startedAt + 1000);
    advanceTimersByTime(16);
    now.restore();

    expect(game.dts).toEqual([50]);
    loop.pause();
  });
});
