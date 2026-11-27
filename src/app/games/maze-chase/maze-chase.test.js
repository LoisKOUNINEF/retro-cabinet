import { MazeChase, mazeChaseGame, prizeFor, TICK_MS } from '#root/dist/src/app/games/maze-chase/maze-chase.js';
import { COMPACT } from '#root/dist/src/app/games/maze-chase/mazes.js';

const UP = { x: 0, y: -1 };
const LEFT = { x: -1, y: 0 };
const RIGHT = { x: 1, y: 0 };

// Compact maze: the runner starts at (9, 15), the ghost exit is (9, 7).
const START = { x: 9, y: 15 };
const EXIT = { x: 9, y: 7 };

const ghost = (name, position, direction, extra = {}) => ({ name, position, direction, state: 'active', frightened: false, ...extra });

// A game already going (past the wait for the first arrow).
const playing = (options) => {
  const game = new MazeChase(options);
  game.waiting = false;
  return game;
};

// A game with no ghosts around, to test the runner alone.
const alone = () => {
  const game = playing({ layout: COMPACT, random: () => 0 });
  game.ghosts = [];
  return game;
};

// One tick in which the runner takes exactly one step (any speed from 70% to 100%).
const stepOnce = (game) => {
  game.runner.budget = 30;
  game.tick();
};

// How many of the next n ticks the ghost moves on.
const ghostMoves = (game, ghostIndex, n) => {
  let moves = 0;
  for (let i = 0; i < n; i++) {
    const before = game.ghosts[ghostIndex].position;
    game.tick();
    if (game.ghosts[ghostIndex].position !== before) moves += 1;
  }
  return moves;
};

// The runner stuck facing a wall, so it neither moves nor eats.
const stuck = (game) => {
  game.runner = { position: { x: 1, y: 1 }, direction: LEFT };
};

describe('Maze Chase', () => {
  it('moves on a 4-way touch stick', () => {
    expect(new MazeChase().touch).toEqual({ pad: 'stick', directions: ['up', 'down', 'left', 'right'] });
  });

  it('starts with a full maze, the chaser out and the others in the house', () => {
    const game = new MazeChase();

    expect(game.runner.position).toEqual(START);
    expect(game.lives).toBe(3);
    expect(game.pelletsLeft).toBe(150);
    expect(game.ghosts.map((g) => g.state)).toEqual(['active', 'house', 'house', 'house']);
    expect(game.cells()[15][9]).toBe('runner-left');
    expect(game.cells()[7][9]).toBe('ghost-chaser');
    expect(game.cells()[0][0]).toBe('wall');
    expect(game.cells()[8][9]).toBe('door');
    expect(game.cells()[1][1]).toBe('pellet');
    expect(game.cells()[2][1]).toBe('power');
  });

  it('holds still until the first arrow, which picks the starting direction', () => {
    const game = new MazeChase({ layout: COMPACT, random: () => 0 });
    expect(game.waiting).toBeTruthy();

    for (let i = 0; i < 50; i++) game.tick();
    expect(game.runner.position).toEqual(START);
    expect(game.ghosts[0].position).toEqual(EXIT);
    expect(game.ghosts[1].state).toBe('house');

    game.handleKey('ArrowRight');
    expect(game.waiting).toBeFalsy();
    expect(game.runner.direction).toEqual(RIGHT);

    stepOnce(game);
    expect(game.runner.position).toEqual({ x: 10, y: 15 });
  });

  it('takes a first arrow into a wall at the first open turn', () => {
    const game = new MazeChase({ layout: COMPACT, random: () => 0 });
    game.ghosts = [];
    // Up is a wall at the start: the runner sets off left, as in the arcade.
    game.handleKey('ArrowUp');
    expect(game.runner.direction).toEqual(LEFT);
    expect(game.wanted).toEqual(UP);

    stepOnce(game);
    stepOnce(game);
    expect(game.runner.position).toEqual({ x: 8, y: 14 });
  });

  it('moves and eats pellets', () => {
    const game = alone();
    stepOnce(game);

    expect(game.runner.position).toEqual({ x: 8, y: 15 });
    expect(game.score).toBe(10);
    expect(game.pelletsLeft).toBe(149);
  });

  it('moves at 80% on level 1: 4 tiles every 5 ticks', () => {
    const game = alone();
    // An empty corridor (one pellet kept elsewhere, so the level goes on).
    game.pellets = game.pellets.map((row) => row.map(() => null));
    game.pellets[1][1] = 'pellet';
    game.runner = { position: { x: 17, y: 19 }, direction: LEFT };

    for (let i = 0; i < 20; i++) game.tick();

    expect(game.runner.position).toEqual({ x: 1, y: 19 });
  });

  it('slows the runner down for a frame on each pellet', () => {
    const game = alone();
    game.runner = { position: { x: 17, y: 19 }, direction: LEFT };

    for (let i = 0; i < 20; i++) game.tick();

    // 16 tiles on an empty corridor, fewer through pellets.
    expect(game.runner.position.x).toBeGreaterThan(1);
  });

  it('moves ghosts at 75% and frightened ghosts at 50%', () => {
    const game = playing({ layout: COMPACT, random: () => 0 });
    stuck(game);
    game.ghosts = [ghost('chaser', EXIT, LEFT)];
    expect(ghostMoves(game, 0, 20)).toBe(15);

    game.frightenedMs = 60_000;
    game.ghosts[0].frightened = true;
    game.ghosts[0].budget = 0;
    expect(ghostMoves(game, 0, 20)).toBe(10);
  });

  it('makes the chaser rush as the maze empties', () => {
    const game = playing({ layout: COMPACT, random: () => 0 });
    // Out of the maze: the rushing chaser chases even in scatter time, and must not catch the runner.
    game.runner = { position: { x: 100, y: 100 }, direction: LEFT };
    game.ghosts = [ghost('chaser', EXIT, LEFT)];
    const keep = (count) => {
      let kept = 0;
      game.pellets = game.pellets.map((row) => row.map((pellet) => (pellet && kept++ < count ? pellet : null)));
    };

    keep(20);
    expect(game.rush).toBe(1);
    expect(ghostMoves(game, 0, 20)).toBe(16);

    keep(10);
    game.ghosts[0].budget = 0;
    expect(game.rush).toBe(2);
    expect(ghostMoves(game, 0, 20)).toBe(17);
  });

  it('keeps a pressed direction until the turn is open', () => {
    const game = alone();
    // Up is a wall at the start.
    game.handleKey('ArrowUp');

    stepOnce(game);
    expect(game.runner.position).toEqual({ x: 8, y: 15 });
    expect(game.runner.direction).toEqual(LEFT);

    stepOnce(game);
    expect(game.runner.position).toEqual({ x: 8, y: 14 });
    expect(game.runner.direction).toEqual(UP);
  });

  it('mouse: the first click picks the starting direction, left or right', () => {
    const right = new MazeChase({ layout: COMPACT, random: () => 0 });
    right.handleMouseDown('right');
    expect(right.waiting).toBeFalsy();
    expect(right.runner.direction).toEqual(RIGHT);
    expect(right.wanted).toBe(null);

    const left = new MazeChase({ layout: COMPACT, random: () => 0 });
    left.handleMouseDown('left');
    expect(left.waiting).toBeFalsy();
    expect(left.runner.direction).toEqual(LEFT);
  });

  it('mouse: then turns a quarter from where the runner goes, at the next open turn', () => {
    const game = alone();
    // Going left, a right click (clockwise) means up: a wall at the start.
    game.handleMouseDown('right');
    expect(game.wanted).toEqual(UP);

    stepOnce(game);
    expect(game.runner.position).toEqual({ x: 8, y: 15 });
    stepOnce(game);
    expect(game.runner.position).toEqual({ x: 8, y: 14 });
    expect(game.runner.direction).toEqual(UP);

    // Going up, a left click (counter-clockwise) means left.
    game.handleMouseDown('left');
    expect(game.wanted).toEqual(LEFT);
  });

  it('mouse: adds up clicks from the turn still waiting, so two make a U-turn', () => {
    const game = alone();

    game.handleMouseDown('left');
    game.handleMouseDown('left');
    expect(game.wanted).toEqual(RIGHT);

    stepOnce(game);
    expect(game.runner.position).toEqual({ x: 10, y: 15 });
    expect(game.runner.direction).toEqual(RIGHT);
  });

  it('mouse: drops a click\'s turn not taken within half a second', () => {
    const game = alone();
    // Up opens one tile to the left, at (8, 15).
    game.handleMouseDown('right');
    expect(game.wanted).toEqual(UP);
    expect(game.wantedMs).toBe(500);

    // The first tick banks 80% of a step; the second steps to (8, 15), as the half second runs out.
    game.tick(250);
    expect(game.runner.position).toEqual(START);
    game.tick(250);
    expect(game.runner.position).toEqual({ x: 8, y: 15 });
    expect(game.wanted).toBe(null);
    expect(game.wantedMs).toBe(null);

    // Too late for the opening: it keeps going left.
    stepOnce(game);
    expect(game.runner.position).toEqual({ x: 7, y: 15 });
    expect(game.runner.direction).toEqual(LEFT);
  });

  it('mouse: restarts the half second on each click, and lets an arrow\'s turn wait for good', () => {
    const game = alone();
    game.handleMouseDown('right');
    game.tick(400);
    game.handleMouseDown('right');
    game.handleMouseDown('left');
    expect(game.wantedMs).toBe(500);

    // An arrow replaces the click's turn, with no time limit.
    game.handleKey('ArrowUp');
    expect(game.wantedMs).toBe(null);

    const keys = alone();
    keys.handleKey('ArrowUp');
    keys.tick(1000);
    keys.tick(1000);
    expect(keys.runner.position).toEqual({ x: 8, y: 15 });
    stepOnce(keys);
    expect(keys.runner.position).toEqual({ x: 8, y: 14 });
    expect(keys.runner.direction).toEqual(UP);
  });

  it('mouse: turns a runner stopped at a wall on the spot, facing the way it turned', () => {
    const game = alone();
    // In the top-left corner, facing the left wall: only right and down are open.
    stuck(game);

    // Clockwise: up, another wall. The runner stays, but faces it.
    game.handleMouseDown('right');
    expect(game.runner.direction).toEqual(UP);
    expect(game.wanted).toBe(null);
    expect(game.cells()[1][1]).toBe('runner-up');
    stepOnce(game);
    expect(game.runner.position).toEqual({ x: 1, y: 1 });

    // Each click turns from the way it is drawn: left again, then down, which is open.
    game.handleMouseDown('left');
    expect(game.runner.direction).toEqual(LEFT);
    game.handleMouseDown('left');
    expect(game.runner.direction).toEqual({ x: 0, y: 1 });
    stepOnce(game);
    expect(game.runner.position).toEqual({ x: 1, y: 2 });
  });

  it('mouse: forgets a turn still waiting when the runner stops, turning from the way it faces', () => {
    const game = alone();
    stuck(game);
    // A click while it was moving, into a wall at the corner.
    game.wanted = UP;

    // From the drawn left, not the hidden up: counter-clockwise is down.
    game.handleMouseDown('left');
    expect(game.runner.direction).toEqual({ x: 0, y: 1 });
    expect(game.wanted).toBe(null);
  });

  it('stops at walls', () => {
    const game = alone();
    stuck(game);

    stepOnce(game);

    expect(game.runner.position).toEqual({ x: 1, y: 1 });
  });

  it('wraps through the tunnel', () => {
    const game = alone();
    game.runner = { position: { x: 0, y: 9 }, direction: LEFT };

    stepOnce(game);

    expect(game.runner.position).toEqual({ x: 18, y: 9 });
  });

  it('frightens the active ghosts on a power pellet, for 6 s on level 1', () => {
    const game = playing({ layout: COMPACT, random: () => 0 });
    game.runner = { position: { x: 1, y: 3 }, direction: UP };

    stepOnce(game);

    expect(game.score).toBe(50);
    expect(game.frightenedMs).toBe(6000);
    expect(game.ghosts[0].frightened).toBeTruthy();
    expect(game.ghosts[2].frightened).toBeFalsy();
    expect(game.cells().flat()).toContain('ghost-frightened');
  });

  it('eats frightened ghosts for 200, then 400', () => {
    const game = alone();
    game.pellets[1][1] = null;
    game.pellets[1][2] = null;
    game.frightenedMs = 4000;
    game.runner = { position: { x: 1, y: 2 }, direction: UP };
    // Frightened ghosts move at 50%: from an empty budget, they wait a tick.
    game.ghosts = [ghost('chaser', { x: 1, y: 1 }, UP, { frightened: true })];

    stepOnce(game);
    expect(game.score).toBe(200);
    expect(game.ghosts[0].state).toBe('eyes');

    game.ghosts.push(ghost('ambusher', { x: 2, y: 1 }, LEFT, { frightened: true }));
    game.handleKey('ArrowRight');
    stepOnce(game);
    expect(game.score).toBe(600);
  });

  it('catches a ghost that swaps tiles with the runner', () => {
    // random 0.99 sends the frightened ghost right, into the runner's old tile.
    const game = playing({ layout: COMPACT, random: () => 0.99 });
    game.frightenedMs = 4000;
    game.ghosts = [ghost('chaser', { x: 8, y: 15 }, RIGHT, { frightened: true, budget: 50 })];

    stepOnce(game);

    expect(game.runner.position).toEqual({ x: 8, y: 15 });
    expect(game.ghosts[0].state).toBe('eyes');
    expect(game.score).toBe(210);
  });

  it('loses a life when caught, then resets positions and waits for an arrow', () => {
    const game = alone();
    game.ghosts = [ghost('chaser', { x: 8, y: 15 }, RIGHT)];

    stepOnce(game);

    expect(game.lives).toBe(2);
    expect(game.runner.position).toEqual(START);
    expect(game.ghosts[0].position).toEqual(EXIT);
    expect(game.ghosts[1].state).toBe('house');
    expect(game.waiting).toBeTruthy();
  });

  it('ends the game when the last life is lost', () => {
    const game = alone();
    game.lives = 1;
    game.ghosts = [ghost('chaser', { x: 8, y: 15 }, RIGHT)];

    stepOnce(game);

    expect(game.isOver).toBeTruthy();
  });

  it('gives one extra life at 10,000 points', () => {
    const game = alone();
    game.score = 9990;

    stepOnce(game);
    expect(game.lives).toBe(4);

    game.score = 19_990;
    stepOnce(game);
    expect(game.lives).toBe(4);
  });

  it('starts the next level once every pellet is eaten', () => {
    const game = alone();
    game.pellets = game.pellets.map((row) => row.map(() => null));
    game.pellets[15][8] = 'pellet';

    stepOnce(game);

    expect(game.level).toBe(2);
    expect(game.pelletsLeft).toBe(150);
    expect(game.runner.position).toEqual(START);
    expect(game.waiting).toBeTruthy();
  });

  it('releases a ghost once enough pellets are eaten', () => {
    const game = playing({ layout: COMPACT, random: () => 0 });
    stuck(game);
    const states = () => game.ghosts.map((g) => g.state);

    // The ambusher comes out at once, the flanker after 30 pellets on level 1.
    game.tick();
    expect(states()).toEqual(['active', 'active', 'house', 'house']);

    game.tick();
    expect(states()[2]).toBe('house');

    game._pelletsEaten = 30;
    game.tick();
    expect(states()).toEqual(['active', 'active', 'active', 'house']);
  });

  it('releases the next ghost when the runner stops eating for 4 s', () => {
    const game = playing({ layout: COMPACT, random: () => 0 });
    stuck(game);
    const states = () => game.ghosts.map((g) => g.state);

    game.tick();
    game.tick(3900);
    expect(states()[2]).toBe('house');

    game.tick(200);
    expect(states()[2]).toBe('active');
    expect(states()[3]).toBe('house');
  });

  it('switches from scatter to chase after 7 s on level 1', () => {
    const game = alone();
    for (let i = 0; i < 6; i++) game.tick(1000);
    expect(game.mode).toBe('scatter');

    game.tick(1000);
    expect(game.mode).toBe('chase');
  });

  it('flashes frightened ghosts near the end, then turns them back', () => {
    const game = alone();
    game.ghosts = [ghost('chaser', { x: 1, y: 1 }, RIGHT, { frightened: true })];
    // Level 1: 5 flashes in the last 2 s.
    game.frightenedMs = 2200;
    game.runner = { position: { x: 1, y: 19 }, direction: LEFT };

    game.tick();
    expect(game.cells().flat()).toContain('ghost-frightened');

    game.tick(200);
    expect(game.cells().flat()).toContain('ghost-frightened-ending');

    game.tick(2000);
    expect(game.ghosts[0].frightened).toBeFalsy();
  });

  it('builds the chosen maze from its definition', () => {
    expect(mazeChaseGame.create({ maze: 'compact' }).width).toBe(19);
    expect(mazeChaseGame.create({ maze: 'arcade' }).width).toBe(28);
    expect(mazeChaseGame.options[0].choices[0].value).toBe('compact');
  });

  it('starts at the chosen level, with shorter fright time', () => {
    const game = playing({ layout: COMPACT, random: () => 0, firstLevel: 4 });
    game.ghosts = [];
    expect(game.level).toBe(4);

    game.runner = { position: { x: 1, y: 3 }, direction: UP };
    stepOnce(game);
    expect(game.frightenedMs).toBe(3000);

    game.reset();
    expect(game.level).toBe(4);
  });

  it('ticks at the arcade 100% speed: one tile per tick', () => {
    expect(new MazeChase().speed()).toBe(TICK_MS);
    expect(TICK_MS).toBe(106);
  });

  it('combines the maze, level, lives and prize options', () => {
    expect(mazeChaseGame.options.map((o) => o.key)).toEqual(['maze', 'level', 'lives', 'prizes']);
    const game = mazeChaseGame.create({ maze: 'arcade', level: '2' });
    expect(game.width).toBe(28);
    expect(game.lives).toBe(3);
  });

  it('starts every game with the chosen lives', () => {
    const game = mazeChaseGame.create({ lives: '99' });
    expect(game.lives).toBe(99);
    game.lives = 1;
    game.reset();
    expect(game.lives).toBe(99);
  });

  it('saves and restores its exact state, ghosts and modes included', () => {
    const game = playing({ layout: COMPACT, random: () => 0 });
    for (let i = 0; i < 45; i++) game.tick();
    game.handleKey('ArrowUp');

    const copy = new MazeChase({ layout: COMPACT, random: () => 0 });
    copy.restore(JSON.parse(JSON.stringify(game.snapshot())));
    expect(copy.snapshot()).toEqual(game.snapshot());

    for (let i = 0; i < 30; i++) { game.tick(); copy.tick(); }
    expect(copy.snapshot()).toEqual(game.snapshot());
    expect(copy.mode).toBe(game.mode);
  });

  describe('bonus prizes', () => {
    // Compact maze: the prize spot is (9, 11), just below the house; one pellet sits at (1, 1).
    const SPOT = { x: 9, y: 11 };

    // Leaves `left` pellets, the last one (1, 1) in front of the runner.
    const withPellets = (game, left) => {
      game.ghosts = [];
      let keep = left;
      game.pellets = game.pellets.map((row, y) => row.map((pellet, x) => {
        if (!pellet || (x === 1 && y === 1)) return pellet;
        if (keep > 1) { keep -= 1; return pellet; }
        return null;
      }));
      game.runner = { position: { x: 2, y: 1 }, direction: LEFT };
      return game;
    };
    const prizeGame = (options = {}) => playing({ layout: COMPACT, random: () => 0, prizes: true, ...options });

    it('gives the arcade prize for each level', () => {
      expect([1, 2, 3, 4, 5, 7, 9, 11, 13, 20].map((level) => prizeFor(level).kind)).toEqual([
        'cherry', 'strawberry', 'orange', 'orange', 'apple', 'melon', 'ship', 'bell', 'key', 'key',
      ]);
      expect([1, 2, 3, 5, 7, 9, 11, 13].map((level) => prizeFor(level).points)).toEqual([
        100, 300, 500, 700, 1000, 2000, 3000, 5000,
      ]);
    });

    it('appears below the house after the 43rd and the 105th pellet of the compact maze', () => {
      [43, 105].forEach((eaten) => {
        const game = withPellets(prizeGame(), 150 - eaten + 1);
        stepOnce(game);
        expect(game.pelletsLeft).toBe(150 - eaten);
        expect(game.prize.kind).toBe('cherry');
        expect(game.cells()[SPOT.y][SPOT.x]).toBe('prize-cherry');
      });

      const early = withPellets(prizeGame(), 150 - 42 + 1);
      stepOnce(early);
      expect(early.prize).toBe(null);
    });

    it('never appears with the option off', () => {
      const game = withPellets(playing({ layout: COMPACT, random: () => 0 }), 150 - 43 + 1);
      stepOnce(game);
      expect(game.prize).toBe(null);
    });

    it("is worth the level's points when the runner steps on it", () => {
      const game = prizeGame({ firstLevel: 9 });
      game.ghosts = [];
      game.prize = { kind: 'ship', ms: 5000 };
      game.runner = { position: { x: 8, y: 11 }, direction: RIGHT };
      stepOnce(game);

      expect(game.runner.position).toEqual(SPOT);
      expect(game.score).toBe(2000);
      expect(game.prize).toBe(null);
    });

    it('goes after 9⅓ to 10 seconds', () => {
      const game = prizeGame();
      stuck(game);
      game.ghosts = [];
      game.prize = { kind: 'cherry', ms: 9333 };
      game.tick(9000);
      expect(game.prize).not.toBe(null);
      game.tick(400);
      expect(game.prize).toBe(null);
    });

    it('goes when a life is lost', () => {
      const game = prizeGame();
      game.prize = { kind: 'cherry', ms: 9333 };
      game.ghosts = [ghost('chaser', { x: 1, y: 1 }, RIGHT)];
      stuck(game);
      game.tick();
      expect(game.lives).toBe(2);
      expect(game.prize).toBe(null);
    });

    it('is kept by saves, which are newer than the ones without it', () => {
      const game = prizeGame();
      game.prize = { kind: 'cherry', ms: 4000 };
      const copy = prizeGame();
      copy.restore(JSON.parse(JSON.stringify(game.snapshot())));
      expect(copy.prize).toEqual(game.prize);
      expect(mazeChaseGame.saveVersion).toBeGreaterThan(7);
    });

    it('is on by default', () => {
      expect(mazeChaseGame.options.find((o) => o.key === 'prizes').defaultValue).toBe('on');
      const game = withPellets(mazeChaseGame.create({}), 150 - 43 + 1);
      game.waiting = false;
      stepOnce(game);
      expect(game.prize).not.toBe(null);
      expect(withPellets(mazeChaseGame.create({ prizes: 'off' }), 2).prizes).toBeFalsy();
    });
  });
});
