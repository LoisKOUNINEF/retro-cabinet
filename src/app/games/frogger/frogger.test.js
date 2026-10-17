import {
  BAY_CROCODILE_OUT_MS, BAY_CROCODILE_PEEK_MS, DYING_MS, FLY_STAYS_MS, Frogger, HOP_MS, JAWS_CYCLE_MS, SNAKE_LENGTH,
  froggerGame,
} from '#root/dist/src/app/games/frogger/frogger.js';
import {
  BAYS, DIVE_UNDER_MS, HEIGHT, LANES, TILE, WIDTH, laneObjects, objectRects,
} from '#root/dist/src/app/games/frogger/field.js';

const START = { x: 112, row: 12, facing: 'up' };
const lane = (row) => LANES.findIndex((l) => l.row === row);
// A frog's left edge that puts its centre in bay i.
const inBay = (i) => BAYS[i].x + BAYS[i].width / 2 - TILE / 2;

const newGame = (options = {}) => new Frogger({ random: () => 0, ...options });

// Press an arrow and let the hop land.
const hop = (game, code) => {
  game.handleKey(code);
  game.tick(HOP_MS);
};

// Puts the frog in row 1 under bay i, then hops it up into the hedge row.
const hopHome = (game, i) => {
  game.frog = { x: inBay(i), row: 1, facing: 'up' };
  hop(game, 'ArrowUp');
};

describe('Frogger', () => {
  it('starts with the frog at the bottom centre and 3 lives, on a 240×224 canvas', () => {
    const game = newGame();

    expect(game.frog).toEqual(START);
    expect(game.lives).toBe(3);
    expect(game.stats()).toEqual({ lives: 3 });
    expect([game.width, game.height]).toEqual([WIDTH, HEIGHT]);
    expect([WIDTH, HEIGHT]).toEqual([240, 224]);
    expect(game.realtime).toBeTruthy();
  });

  it('turns each lane pattern into objects, one per run', () => {
    LANES.forEach((l) => expect(l.pattern.length).toBe(WIDTH / TILE));
    expect(laneObjects(LANES[lane(1)])).toEqual([
      { x: 0, width: 48, diving: false, crocodile: false },
      { x: 112, width: 64, diving: false, crocodile: true },
    ]);
    expect(laneObjects(LANES[lane(2)]).map((o) => o.diving)).toEqual([false, true, false]);
  });

  it('slides lanes by their speed and wraps objects around the edges', () => {
    const game = newGame();
    game.tick(1000);

    expect(game.offsets[lane(1)]).toBe(27);
    expect(game.laneRects(lane(1))[0].rect.x).toBe(27);
    expect(objectRects({ x: 224, width: 32 }, 1, 0).map((r) => r.x)).toEqual([224, -16]);
  });

  it('runs each level 10% faster', () => {
    const game = newGame({ firstLevel: 2 });
    game.tick(1000);
    expect(game.offsets[lane(1)]).toBe(27 * 1.1);
  });

  it('hops one tile in HOP_MS, ignoring arrows mid-hop', () => {
    const game = newGame();
    game.handleKey('ArrowUp');

    expect(game.frog.row).toBe(11);
    expect(game.score).toBe(10);
    game.tick(HOP_MS / 2);
    expect(game.frogPosition.y).toBe(11.5 * TILE);

    game.handleKey('ArrowLeft');
    expect(game.frog.x).toBe(START.x);

    game.tick(HOP_MS / 2);
    expect(game.hop).toBe(null);
    expect(game.frogPosition).toEqual({ x: START.x, y: 11 * TILE });
  });

  it('scores only rows not reached yet by this frog', () => {
    const game = newGame();
    hop(game, 'ArrowLeft');
    expect(game.score).toBe(0);
  });

  it('splats under a car, holds everything still, then sends a new frog', () => {
    const game = newGame();
    game.frog = { x: game.laneRects(lane(11))[0].rect.x, row: 11, facing: 'up' };

    game.tick(1);
    expect(game.lives).toBe(2);
    expect(game.dyingMs).toBe(DYING_MS);

    const offsets = [...game.offsets];
    game.handleKey('ArrowUp');
    game.tick(DYING_MS / 2);
    expect(game.offsets).toEqual(offsets);
    expect(game.frog.row).toBe(11);

    game.tick(DYING_MS / 2);
    expect(game.frog).toEqual(START);
  });

  it('rides a log', () => {
    const game = newGame();
    // Row 5's first log spans 0..64.
    game.frog = { x: 16, row: 5, facing: 'up' };

    game.tick(1000);

    expect(game.frog.x).toBe(16 + 23);
    expect(game.lives).toBe(3);
  });

  it('drowns in open water', () => {
    const game = newGame();
    game.frog = { x: 80, row: 5, facing: 'up' };

    game.tick(1);

    expect(game.lives).toBe(2);
  });

  it('dies when a log carries it off the field', () => {
    const game = newGame();
    // Row 3's second log spans 176..224, moving right at 40 px/s.
    game.frog = { x: 208, row: 3, facing: 'up' };

    game.tick(500);
    expect(game.lives).toBe(3);

    game.tick(500);
    expect(game.lives).toBe(2);
  });

  it('drowns a frog on diving turtles once they go under, with the option on', () => {
    [true, false].forEach((divingTurtles) => {
      const game = newGame({ divingTurtles });
      // Row 4's diving turtles span 32..80.
      game.frog = { x: 48, row: 4, facing: 'up' };
      game._clockMs = DIVE_UNDER_MS - 10;

      game.tick(20);

      expect(game.lives).toBe(divingTurtles ? 2 : 3);
    });
  });

  it('fills an empty bay, scores and sends a new frog', () => {
    const game = newGame();
    hopHome(game, 1);

    expect(game.homes).toEqual([false, true, false, false, false]);
    expect(game.score).toBe(10 + 50);
    expect(game.frog).toEqual(START);
    expect(game.lives).toBe(3);
  });

  it('kills a frog landing in the hedge or a filled bay', () => {
    const game = newGame();
    game.frog = { x: 0, row: 1, facing: 'up' };
    hop(game, 'ArrowUp');
    expect(game.lives).toBe(2);

    game.tick(DYING_MS);
    game.homes[2] = true;
    hopHome(game, 2);
    expect(game.lives).toBe(1);
  });

  it('levels up once all five bays are filled', () => {
    const game = newGame();
    game.homes = [true, true, true, true, false];

    hopHome(game, 4);

    expect(game.score).toBe(10 + 50 + 1000);
    expect(game.level).toBe(2);
    expect(game.homes).toEqual([false, false, false, false, false]);
  });

  it('adds 10 points per second left, with the time limit on', () => {
    const timed = newGame({ timeLimit: true });
    timed.timeLeft = 30_500 + HOP_MS;
    hopHome(timed, 0);
    expect(timed.score).toBe(10 + 50 + 300);

    const untimed = newGame();
    hopHome(untimed, 0);
    expect(untimed.score).toBe(10 + 50);
  });

  it('brings in a fly now and then, worth 200 in its bay', () => {
    const game = newGame();
    game.tick(6000);
    expect(game.fly).toEqual({ bay: 0, ms: FLY_STAYS_MS });

    hopHome(game, 0);
    expect(game.score).toBe(10 + 50 + 200);
    expect(game.fly).toBe(null);
  });

  it('gives nothing once the fly has gone', () => {
    const game = newGame();
    game.fly = { bay: 1, ms: HOP_MS - 1 };

    hopHome(game, 1);

    expect(game.score).toBe(10 + 50);
  });

  it('brings the lady frog home for 200 once picked up', () => {
    const game = newGame();
    game.tick(15_000);
    const lady = game.ladyRect;
    expect(lady).toBeTruthy();

    game.frog = { x: lady.x, row: 5, facing: 'up' };
    game.tick(1);
    expect(game.ladyOnBack).toBeTruthy();
    expect(game.lady).toBe(null);

    hopHome(game, 1);
    expect(game.score).toBe(10 + 50 + 200);
    expect(game.ladyOnBack).toBeFalsy();
  });

  it('loses the lady frog when the frog dies, or when her log leaves the field', () => {
    const game = newGame();
    game.ladyOnBack = true;
    game.frog = { x: 80, row: 5, facing: 'up' };
    game.tick(1);
    expect(game.ladyOnBack).toBeFalsy();

    const other = newGame();
    other.lady = { object: 0 };
    // Row 5's first log (64 wide) now crosses the right edge.
    other.offsets[lane(5)] = 200;
    other.tick(1);
    expect(other.lady).toBe(null);
  });

  it('gives one extra life at 20,000 points', () => {
    const game = newGame();
    game.score = 19_990;
    hop(game, 'ArrowUp');
    expect(game.lives).toBe(4);

    game.score = 39_990;
    game.handleKey('ArrowUp');
    expect(game.lives).toBe(4);
  });

  it('ends the game after the last splat', () => {
    const game = newGame();
    game.lives = 1;
    game.frog = { x: 0, row: 1, facing: 'up' };
    hop(game, 'ArrowUp');
    expect(game.isOver).toBeFalsy();

    game.tick(DYING_MS);
    expect(game.isOver).toBeTruthy();

    game.reset();
    expect(game.isOver).toBeFalsy();
    expect(game.lives).toBe(3);
  });

  it('loses a life when the time runs out, then restarts the timer', () => {
    const game = newGame({ timeLimit: true });

    game.tick(59_999);
    expect(game.lives).toBe(3);
    expect(game.stats()).toEqual({ lives: 3, time: 1 });

    game.tick(1);
    expect(game.lives).toBe(2);
    game.tick(DYING_MS);
    expect(game.timeLeft).toBe(60_000);
  });

  it('ignores time and shows no time stat without the time limit', () => {
    const game = newGame();
    game.tick(60_000);
    expect(game.lives).toBe(3);
    expect(game.stats()).toEqual({ lives: 3 });
  });

  it('reads all three options from its definition settings', () => {
    expect(froggerGame.options.map((o) => o.key)).toEqual(['level', 'time', 'turtles']);
    const game = froggerGame.create({ level: '2', time: 'on', turtles: 'off' });
    expect(game).toBeInstanceOf(Frogger);
    expect(game.level).toBe(2);
    expect(game.stats().time).toBe(60);
  });

  it('uses a cross D-pad on touch screens', () => {
    expect(newGame().touch).toEqual({ pad: 'cross', directions: ['up', 'down', 'left', 'right'] });
  });

  it('saves and restores its exact state, mid-hop included', () => {
    const options = { timeLimit: true, divingTurtles: true };
    const game = newGame(options);
    game.tick(1700);
    game.handleKey('ArrowUp');
    game.tick(50);

    const copy = newGame(options);
    copy.restore(JSON.parse(JSON.stringify(game.snapshot())));
    expect(copy.snapshot()).toEqual(game.snapshot());

    for (let i = 0; i < 30; i++) { game.tick(16); copy.tick(16); }
    expect(copy.snapshot()).toEqual(game.snapshot());
  });

  describe('hazards', () => {
    it('sends a lone race car down the fast lane, three times faster than other traffic', () => {
      const game = newGame();
      expect(laneObjects(LANES[lane(8)]).length).toBe(1);

      game.tick(1000);

      expect(game.offsets[lane(8)]).toBe(120);
      LANES.filter((l) => l.row !== 8).forEach((l) => expect(l.speed * 3).not.toBeGreaterThan(120));
    });

    it('brings no hazard on level 1, then more with each level', () => {
      const first = newGame();
      first.tick(20_000);
      expect([first.snake, first.logSnake, first.bayCrocodile, first.otter]).toEqual([null, null, null, null]);
      expect(first.isCrocodile(laneObjects(LANES[lane(1)])[1])).toBeFalsy();

      const second = newGame({ firstLevel: 2 });
      expect(second.snake).toBeTruthy();
      expect(second.logSnake).toBe(null);
      expect(second.isCrocodile(laneObjects(LANES[lane(1)])[1])).toBeTruthy();

      const third = newGame({ firstLevel: 3 });
      expect(third.logSnake).toBeTruthy();
    });

    it('adds the hazards of a new level as soon as it starts', () => {
      const game = newGame();
      game.homes = [true, true, true, true, false];

      hopHome(game, 4);

      expect(game.level).toBe(2);
      expect(game.snake).toBeTruthy();
    });

    it('lets the frog ride the river crocodile, but its open jaws bite', () => {
      // Row 1's crocodile spans 112..176, swimming right: its head is 160..176.
      const ride = (x, clockMs, level = 2) => {
        const game = newGame({ firstLevel: level });
        game.frog = { x, row: 1, facing: 'up' };
        game._clockMs = clockMs;
        game.tick(1);
        return game.lives;
      };
      const open = JAWS_CYCLE_MS - 100;

      expect(ride(116, open)).toBe(3);
      expect(ride(160, 0)).toBe(3);
      expect(ride(160, open)).toBe(2);
      // On level 1 it's just a log.
      expect(ride(160, open, 1)).toBe(3);
    });

    it('brings a bay crocodile into an empty bay, never the fly\'s', () => {
      const game = newGame({ firstLevel: 2 });
      // The fly comes first (at 6 s), in bay 0.
      game.tick(8000);

      expect(game.fly.bay).toBe(0);
      expect(game.bayCrocodile).toEqual({ bay: 1, ms: 0 });
      expect(game.bayCrocodileOut).toBeFalsy();

      game.tick(BAY_CROCODILE_PEEK_MS);
      expect(game.bayCrocodileOut).toBeTruthy();

      game.tick(BAY_CROCODILE_OUT_MS);
      expect(game.bayCrocodile).toBe(null);
    });

    it('is scared off by a frog while it peeks, but bites once out', () => {
      const peeking = newGame({ firstLevel: 2 });
      peeking.bayCrocodile = { bay: 1, ms: 0 };
      hopHome(peeking, 1);
      expect(peeking.homes[1]).toBeTruthy();
      expect(peeking.bayCrocodile).toBe(null);
      expect(peeking.lives).toBe(3);

      const out = newGame({ firstLevel: 2 });
      out.bayCrocodile = { bay: 1, ms: BAY_CROCODILE_PEEK_MS };
      hopHome(out, 1);
      expect(out.homes[1]).toBeFalsy();
      expect(out.lives).toBe(2);
    });

    it('slithers a snake along the median, wrapping around the edges', () => {
      const game = newGame({ firstLevel: 2 });
      expect(game.snake).toEqual({ x: -SNAKE_LENGTH, direction: 1 });

      game.tick(1000);
      expect(game.snake.x).toBe(-SNAKE_LENGTH + 24);

      game.snake.x = WIDTH - 1;
      game.tick(100);
      expect(game.snake.x).toBe(-SNAKE_LENGTH);
    });

    it('kills a frog touching the snake\'s head, not its tail', () => {
      const bitten = (x) => {
        const game = newGame({ firstLevel: 2 });
        // Head 116..132, tail 100..116.
        game.snake = { x: 100, direction: 1 };
        game.frog = { x, row: 6, facing: 'up' };
        game.tick(1);
        return game.lives === 2;
      };
      expect(bitten(116)).toBeTruthy();
      expect(bitten(98)).toBeFalsy();
    });

    it('crawls a snake to and fro along a row 5 log, from level 3', () => {
      const game = newGame({ firstLevel: 3 });
      expect(game.logSnake).toEqual({ object: 1, along: 0, direction: 1 });

      game.tick(1000);
      expect(game.logSnake.along).toBe(24);

      // The log is 64 long: the 32-long snake turns at 32.
      game.tick(1000);
      expect(game.logSnake).toEqual({ object: 1, along: 32, direction: -1 });

      const { head } = game.snakeRects.find(({ head: h }) => h.y === 5 * TILE);
      game.frog = { x: head.x, row: 5, facing: 'up' };
      game.tick(1);
      expect(game.lives).toBe(2);
    });

    it('keeps the lady frog off the snake\'s log', () => {
      const game = newGame({ firstLevel: 3 });
      game.tick(15_000);
      expect(game.lady?.object ?? 0).not.toBe(1);
    });

    it('sends an otter across a river row against its flow, from level 3', () => {
      const game = newGame({ firstLevel: 3 });
      game.tick(10_000);
      // Row 1 flows right: the otter comes from the right.
      expect(game.otter).toEqual({ row: 1, x: WIDTH, direction: -1 });

      game.tick(1000);
      expect(game.otter.x).toBe(WIDTH - 60);

      game.otter.x = -10;
      game.tick(200);
      expect(game.otter).toBe(null);
    });

    it('kills a frog the otter swims into', () => {
      const ride = (withOtter) => {
        const game = newGame({ firstLevel: 3 });
        const log = game.laneRects(lane(1)).find(({ object }) => !object.crocodile).rect;
        game.frog = { x: log.x + 4, row: 1, facing: 'up' };
        if (withOtter) game.otter = { row: 1, x: log.x + 4, direction: -1 };
        game.tick(1);
        return game.lives;
      };
      expect(ride(false)).toBe(3);
      expect(ride(true)).toBe(2);
    });

    it('saves and restores every hazard', () => {
      const game = newGame({ firstLevel: 3 });
      game.tick(10_000);
      expect([game.snake, game.logSnake, game.bayCrocodile, game.otter].every(Boolean)).toBeTruthy();

      const copy = newGame({ firstLevel: 3 });
      copy.restore(JSON.parse(JSON.stringify(game.snapshot())));
      for (let i = 0; i < 30; i++) { game.tick(16); copy.tick(16); }
      expect(copy.snapshot()).toEqual(game.snapshot());
    });
  });
});
