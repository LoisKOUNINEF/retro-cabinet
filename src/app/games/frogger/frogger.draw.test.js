import { Frogger } from '#root/dist/src/app/games/frogger/frogger.js';
import { drawFrogger, FROG_SPRITE } from '#root/dist/src/app/games/frogger/frogger.draw.js';

const pixels = (sprite) => sprite.join('').split('#').length - 1;

const fakeContext = () => {
  const ctx = { rects: 0, colours: [] };
  ctx.fillRect = () => { ctx.rects += 1; ctx.colours.push(ctx.fillStyle); };
  return ctx;
};

const drawn = (game) => {
  const ctx = fakeContext();
  drawFrogger(ctx, game);
  return ctx;
};

describe('drawFrogger', () => {
  it('draws the scenery, the lanes and the frog', () => {
    const game = new Frogger({ random: () => 0 });
    const ctx = drawn(game);

    expect(ctx.rects).toBeGreaterThan(pixels(FROG_SPRITE));
    expect(ctx.colours).toContain('#3cd23c');
  });

  it('adds the fly and the lady frog when they are out', () => {
    const game = new Frogger({ random: () => 0 });
    const before = drawn(game).rects;

    game.fly = { bay: 0, ms: 1000 };
    game.lady = { object: 0 };
    const ctx = drawn(game);

    expect(ctx.rects).toBeGreaterThan(before + pixels(FROG_SPRITE));
    expect(ctx.colours).toContain('#ff7ac8');
  });

  it('shows the time bar only with the time limit on', () => {
    const untimed = drawn(new Frogger({ random: () => 0 })).rects;
    const timed = drawn(new Frogger({ random: () => 0, timeLimit: true })).rects;
    expect(timed).toBe(untimed + 1);
  });

  it('draws a splat instead of the frog while it dies', () => {
    const game = new Frogger({ random: () => 0 });
    game.dyingMs = 500;
    expect(drawn(game).colours).toContain('#ffffff');
  });

  it('draws the crocodile in place of its log from level 2', () => {
    const colours = (level) => drawn(new Frogger({ random: () => 0, firstLevel: level })).colours;
    expect(colours(1)).not.toContain('#2e9a2e');
    expect(colours(2)).toContain('#2e9a2e');
  });

  it('adds the bay crocodile, the snakes and the otter when they are out', () => {
    const game = new Frogger({ random: () => 0, firstLevel: 3 });
    game.snake = null;
    game.logSnake = null;
    const before = drawn(game).rects;

    game.snake = { x: 50, direction: 1 };
    game.logSnake = { object: 1, along: 0, direction: -1 };
    game.bayCrocodile = { bay: 2, ms: 2000 };
    game.otter = { row: 2, x: 30, direction: 1 };
    const ctx = drawn(game);

    expect(ctx.rects).toBeGreaterThan(before + 40);
    expect(ctx.colours).toContain('#d08850');
    expect(ctx.colours).toContain('#e8c860');
  });
});
