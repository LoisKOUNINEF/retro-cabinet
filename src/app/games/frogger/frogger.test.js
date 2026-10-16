import { Frogger, froggerGame } from '#root/dist/src/app/games/frogger/frogger.js';
import { LANES, WIDTH } from '#root/dist/src/app/games/frogger/lanes.js';

const START = { x: 7, y: 12 };

// Runs 28 ticks (frog safe on the start row), then puts the frog on a '~' turtle
// of row 4 that won't be carried off the board on the next shift.
const rideDivingTurtle = (game) => {
  for (let i = 0; i < 28; i++) game.tick(0);
  const lane = LANES.findIndex((l) => l.row === 4);
  const pattern = LANES[lane].pattern;
  const x = [...Array(WIDTH).keys()].find((col) =>
    col > 0 && pattern[(((col - game.offsets[lane]) % WIDTH) + WIDTH) % WIDTH] === '~');
  game.frog = { x, y: 4 };
  return game;
};

describe('Frogger', () => {
  it('starts with the frog at the bottom centre and 3 lives', () => {
    const game = new Frogger();

    expect(game.frog).toEqual(START);
    expect(game.lives).toBe(3);
    expect(game.stats()).toEqual({ lives: 3 });
    expect(game.cells()[12][7]).toBe('frog');
    expect(game.cells()[0][1]).toBe('home');
    expect(game.cells()[0][0]).toBe('hedge');
  });

  it('defines every lane at the board width', () => {
    LANES.forEach((lane) => expect(lane.pattern.length).toBe(WIDTH));
  });

  it('shifts each lane every `period` ticks and wraps around', () => {
    const game = new Frogger();
    // Row 8: '=.....=.....=..', moving right every 2 ticks.
    expect(game.cells()[8][0]).toBe('car');

    game.tick();
    expect(game.cells()[8][0]).toBe('car');

    game.tick();
    expect(game.cells()[8][0]).toBe('road');
    expect(game.cells()[8][1]).toBe('car');

    // A full lap brings the pattern back.
    for (let i = 0; i < 2 * (WIDTH - 1); i++) game.tick();
    expect(game.cells()[8][0]).toBe('car');
  });

  it('moves the frog one cell per arrow, clamped to the board', () => {
    const game = new Frogger();

    game.handleKey('ArrowLeft');
    expect(game.frog).toEqual({ x: 6, y: 12 });

    for (let i = 0; i < 10; i++) game.handleKey('ArrowLeft');
    expect(game.frog.x).toBe(0);

    game.handleKey('ArrowDown');
    expect(game.frog.y).toBe(12);
  });

  it('scores each new row only once per life', () => {
    const game = new Frogger();

    game.handleKey('ArrowUp');
    expect(game.score).toBe(10);

    game.handleKey('ArrowDown');
    game.handleKey('ArrowUp');
    expect(game.score).toBe(10);
  });

  it('loses a life when hit by a car', () => {
    const game = new Frogger();
    // Row 11 has a car at x = 4.
    game.frog = { x: 4, y: 12 };

    game.handleKey('ArrowUp');

    expect(game.lives).toBe(2);
    expect(game.frog).toEqual(START);
  });

  it('loses a life when jumping into the water', () => {
    const game = new Frogger();
    // Row 5 is water at x = 5.
    game.frog = { x: 5, y: 6 };

    game.handleKey('ArrowUp');

    expect(game.lives).toBe(2);
  });

  it('rides a log', () => {
    const game = new Frogger();
    // Row 5 has a log at x = 0, moving right every 4 ticks.
    game.frog = { x: 0, y: 6 };
    game.handleKey('ArrowUp');
    expect(game.lives).toBe(3);

    for (let i = 0; i < 4; i++) game.tick();

    expect(game.frog).toEqual({ x: 1, y: 5 });
    expect(game.lives).toBe(3);
  });

  it('loses a life when a log carries the frog off the board', () => {
    const game = new Frogger();
    // Row 3 has a log at x = 13, moving right every 2 ticks.
    game.frog = { x: 13, y: 3 };

    game.tick();
    game.tick();
    expect(game.frog).toEqual({ x: 14, y: 3 });

    game.tick();
    game.tick();
    expect(game.lives).toBe(2);
    expect(game.frog).toEqual(START);
  });

  it('fills an empty home, scores and sends a new frog', () => {
    const game = new Frogger();
    game.frog = { x: 4, y: 1 };

    game.handleKey('ArrowUp');

    expect(game.homes).toEqual([false, true, false, false, false]);
    expect(game.score).toBe(50);
    expect(game.frog).toEqual(START);
    expect(game.cells()[0][4]).toBe('home-filled');
  });

  it('loses a life on the hedge or on a filled home', () => {
    const game = new Frogger();
    game.frog = { x: 2, y: 1 };
    game.handleKey('ArrowUp');
    expect(game.lives).toBe(2);

    game.homes[1] = true;
    game.frog = { x: 4, y: 1 };
    game.handleKey('ArrowUp');
    expect(game.lives).toBe(1);
  });

  it('levels up once all five homes are filled', () => {
    const game = new Frogger();
    game.homes = [true, true, true, true, false];
    game.frog = { x: 13, y: 1 };
    const slowSpeed = game.speed();

    game.handleKey('ArrowUp');

    expect(game.score).toBe(1050);
    expect(game.level).toBe(2);
    expect(game.homes).toEqual([false, false, false, false, false]);
    expect(game.speed()).toBeLessThan(slowSpeed);
  });

  it('ends the game when the last life is lost', () => {
    const game = new Frogger();
    game.lives = 1;
    game.frog = { x: 5, y: 6 };

    game.handleKey('ArrowUp');
    expect(game.isOver).toBeTruthy();

    game.handleKey('ArrowLeft');
    expect(game.frog).toEqual(START);

    game.reset();
    expect(game.isOver).toBeFalsy();
    expect(game.lives).toBe(3);
  });

  it('is built by its definition', () => {
    expect(froggerGame.create({})).toBeInstanceOf(Frogger);
  });

  it('starts at the chosen level', () => {
    const game = new Frogger({ firstLevel: 4 });
    expect(game.level).toBe(4);
    expect(game.speed()).toBeLessThan(new Frogger().speed());
  });

  it('reads all three options from its definition settings', () => {
    expect(froggerGame.options.map((o) => o.key)).toEqual(['level', 'time', 'turtles']);
    const game = froggerGame.create({ level: '2', time: 'on', turtles: 'off' });
    expect(game.level).toBe(2);
    expect(game.stats().time).toBe(30);
  });

  it('loses a life when the time runs out, then restarts the timer', () => {
    const game = new Frogger({ timeLimit: true });

    game.tick(29_999);
    expect(game.lives).toBe(3);
    expect(game.stats()).toEqual({ lives: 3, time: 1 });

    game.tick(1);
    expect(game.lives).toBe(2);
    expect(game.timeLeft).toBe(30_000);
  });

  it('restarts the timer for each frog that reaches a home', () => {
    const game = new Frogger({ timeLimit: true });
    game.tick(10_000);
    game.frog = { x: 4, y: 1 };

    game.handleKey('ArrowUp');

    expect(game.timeLeft).toBe(30_000);
  });

  it('ignores time and shows no time stat without the time limit', () => {
    const game = new Frogger();
    game.tick(60_000);
    expect(game.lives).toBe(3);
    expect(game.stats()).toEqual({ lives: 3 });
  });

  it('flashes diving turtles before they dive', () => {
    const game = new Frogger({ divingTurtles: true });
    for (let i = 0; i < 23; i++) game.tick(0);
    expect(game.cells()[4]).not.toContain('turtle-diving');

    game.tick(0);
    expect(game.cells()[4]).toContain('turtle-diving');
    expect(game.cells()[2]).toContain('turtle-diving');
    // Plain turtles never dive.
    expect(game.cells()[4]).toContain('turtle');
  });

  it('drowns a frog riding a diving turtle once it goes under', () => {
    const game = rideDivingTurtle(new Frogger({ divingTurtles: true }));

    game.tick(0);
    expect(game.lives).toBe(3);

    // Tick 30: the turtles go under (and the lane shifts the frog along).
    game.tick(0);
    expect(game.lives).toBe(2);
  });

  it('never dives turtles with the option off', () => {
    const game = rideDivingTurtle(new Frogger());

    game.tick(0);
    game.tick(0);

    expect(game.lives).toBe(3);
    expect(game.frog.y).toBe(4);
  });

  it('saves and restores its exact state, timer and dive cycle included', () => {
    const options = { timeLimit: true, divingTurtles: true };
    const game = new Frogger(options);
    for (let i = 0; i < 17; i++) game.tick(100);
    game.handleKey('ArrowUp');

    const copy = new Frogger(options);
    copy.restore(JSON.parse(JSON.stringify(game.snapshot())));
    expect(copy.snapshot()).toEqual(game.snapshot());

    for (let i = 0; i < 30; i++) { game.tick(100); copy.tick(100); }
    expect(copy.snapshot()).toEqual(game.snapshot());
    expect(copy.cells()).toEqual(game.cells());
  });

  it('uses a D-pad on touch, for repeated hops', () => {
    expect(new Frogger().touch).toEqual({ pad: 'cross', directions: ['up', 'down', 'left', 'right'] });
  });
});
