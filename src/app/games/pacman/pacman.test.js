import { Pacman, pacmanGame, TICK_MS } from '#root/dist/src/app/games/pacman/pacman.js';
import { COMPACT } from '#root/dist/src/app/games/pacman/mazes.js';

const UP = { x: 0, y: -1 };
const LEFT = { x: -1, y: 0 };
const RIGHT = { x: 1, y: 0 };

// Compact maze: Pacman starts at (9, 15), the ghost exit is (9, 7).
const START = { x: 9, y: 15 };
const EXIT = { x: 9, y: 7 };

const ghost = (name, position, direction, extra = {}) => ({ name, position, direction, state: 'active', frightened: false, ...extra });

// A game already going (past the wait for the first arrow).
const playing = (options) => {
  const game = new Pacman(options);
  game.waiting = false;
  return game;
};

// A game with no ghosts around, to test Pacman alone.
const alone = () => {
  const game = playing({ layout: COMPACT, random: () => 0 });
  game.ghosts = [];
  return game;
};

// One tick in which Pacman takes exactly one step (any speed from 70% to 100%).
const stepOnce = (game) => {
  game.pacman.budget = 30;
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

// Pacman stuck facing a wall, so he neither moves nor eats.
const stuck = (game) => {
  game.pacman = { position: { x: 1, y: 1 }, direction: LEFT };
};

describe('Pacman', () => {
  it('moves on a 4-way touch stick', () => {
    expect(new Pacman().touch).toEqual({ pad: 'stick', directions: ['up', 'down', 'left', 'right'] });
  });

  it('starts with a full maze, Blinky out and the others in the house', () => {
    const game = new Pacman();

    expect(game.pacman.position).toEqual(START);
    expect(game.lives).toBe(3);
    expect(game.pelletsLeft).toBe(150);
    expect(game.ghosts.map((g) => g.state)).toEqual(['active', 'house', 'house', 'house']);
    expect(game.cells()[15][9]).toBe('pacman-left');
    expect(game.cells()[7][9]).toBe('ghost-blinky');
    expect(game.cells()[0][0]).toBe('wall');
    expect(game.cells()[8][9]).toBe('door');
    expect(game.cells()[1][1]).toBe('pellet');
    expect(game.cells()[2][1]).toBe('power');
  });

  it('holds still until the first arrow, which picks the starting direction', () => {
    const game = new Pacman({ layout: COMPACT, random: () => 0 });
    expect(game.waiting).toBeTruthy();

    for (let i = 0; i < 50; i++) game.tick();
    expect(game.pacman.position).toEqual(START);
    expect(game.ghosts[0].position).toEqual(EXIT);
    expect(game.ghosts[1].state).toBe('house');

    game.handleKey('ArrowRight');
    expect(game.waiting).toBeFalsy();
    expect(game.pacman.direction).toEqual(RIGHT);

    stepOnce(game);
    expect(game.pacman.position).toEqual({ x: 10, y: 15 });
  });

  it('takes a first arrow into a wall at the first open turn', () => {
    const game = new Pacman({ layout: COMPACT, random: () => 0 });
    game.ghosts = [];
    // Up is a wall at the start: Pacman sets off left, as in the arcade.
    game.handleKey('ArrowUp');
    expect(game.pacman.direction).toEqual(LEFT);
    expect(game.wanted).toEqual(UP);

    stepOnce(game);
    stepOnce(game);
    expect(game.pacman.position).toEqual({ x: 8, y: 14 });
  });

  it('moves and eats pellets', () => {
    const game = alone();
    stepOnce(game);

    expect(game.pacman.position).toEqual({ x: 8, y: 15 });
    expect(game.score).toBe(10);
    expect(game.pelletsLeft).toBe(149);
  });

  it('moves at 80% on level 1: 4 tiles every 5 ticks', () => {
    const game = alone();
    // An empty corridor (one pellet kept elsewhere, so the level goes on).
    game.pellets = game.pellets.map((row) => row.map(() => null));
    game.pellets[1][1] = 'pellet';
    game.pacman = { position: { x: 17, y: 19 }, direction: LEFT };

    for (let i = 0; i < 20; i++) game.tick();

    expect(game.pacman.position).toEqual({ x: 1, y: 19 });
  });

  it('slows Pacman down for a frame on each pellet', () => {
    const game = alone();
    game.pacman = { position: { x: 17, y: 19 }, direction: LEFT };

    for (let i = 0; i < 20; i++) game.tick();

    // 16 tiles on an empty corridor, fewer through pellets.
    expect(game.pacman.position.x).toBeGreaterThan(1);
  });

  it('moves ghosts at 75% and frightened ghosts at 50%', () => {
    const game = playing({ layout: COMPACT, random: () => 0 });
    stuck(game);
    game.ghosts = [ghost('blinky', EXIT, LEFT)];
    expect(ghostMoves(game, 0, 20)).toBe(15);

    game.frightenedMs = 60_000;
    game.ghosts[0].frightened = true;
    game.ghosts[0].budget = 0;
    expect(ghostMoves(game, 0, 20)).toBe(10);
  });

  it('turns Blinky into Elroy as the maze empties', () => {
    const game = playing({ layout: COMPACT, random: () => 0 });
    // Out of the maze: Elroy chases even in scatter time, and must not catch him.
    game.pacman = { position: { x: 100, y: 100 }, direction: LEFT };
    game.ghosts = [ghost('blinky', EXIT, LEFT)];
    const keep = (count) => {
      let kept = 0;
      game.pellets = game.pellets.map((row) => row.map((pellet) => (pellet && kept++ < count ? pellet : null)));
    };

    keep(20);
    expect(game.elroy).toBe(1);
    expect(ghostMoves(game, 0, 20)).toBe(16);

    keep(10);
    game.ghosts[0].budget = 0;
    expect(game.elroy).toBe(2);
    expect(ghostMoves(game, 0, 20)).toBe(17);
  });

  it('keeps a pressed direction until the turn is open', () => {
    const game = alone();
    // Up is a wall at the start.
    game.handleKey('ArrowUp');

    stepOnce(game);
    expect(game.pacman.position).toEqual({ x: 8, y: 15 });
    expect(game.pacman.direction).toEqual(LEFT);

    stepOnce(game);
    expect(game.pacman.position).toEqual({ x: 8, y: 14 });
    expect(game.pacman.direction).toEqual(UP);
  });

  it('stops at walls', () => {
    const game = alone();
    stuck(game);

    stepOnce(game);

    expect(game.pacman.position).toEqual({ x: 1, y: 1 });
  });

  it('wraps through the tunnel', () => {
    const game = alone();
    game.pacman = { position: { x: 0, y: 9 }, direction: LEFT };

    stepOnce(game);

    expect(game.pacman.position).toEqual({ x: 18, y: 9 });
  });

  it('frightens the active ghosts on a power pellet, for 6 s on level 1', () => {
    const game = playing({ layout: COMPACT, random: () => 0 });
    game.pacman = { position: { x: 1, y: 3 }, direction: UP };

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
    game.pacman = { position: { x: 1, y: 2 }, direction: UP };
    // Frightened ghosts move at 50%: from an empty budget, they wait a tick.
    game.ghosts = [ghost('blinky', { x: 1, y: 1 }, UP, { frightened: true })];

    stepOnce(game);
    expect(game.score).toBe(200);
    expect(game.ghosts[0].state).toBe('eyes');

    game.ghosts.push(ghost('pinky', { x: 2, y: 1 }, LEFT, { frightened: true }));
    game.handleKey('ArrowRight');
    stepOnce(game);
    expect(game.score).toBe(600);
  });

  it('catches a ghost that swaps tiles with Pacman', () => {
    // random 0.99 sends the frightened ghost right, into Pacman's old tile.
    const game = playing({ layout: COMPACT, random: () => 0.99 });
    game.frightenedMs = 4000;
    game.ghosts = [ghost('blinky', { x: 8, y: 15 }, RIGHT, { frightened: true, budget: 50 })];

    stepOnce(game);

    expect(game.pacman.position).toEqual({ x: 8, y: 15 });
    expect(game.ghosts[0].state).toBe('eyes');
    expect(game.score).toBe(210);
  });

  it('loses a life when caught, then resets positions and waits for an arrow', () => {
    const game = alone();
    game.ghosts = [ghost('blinky', { x: 8, y: 15 }, RIGHT)];

    stepOnce(game);

    expect(game.lives).toBe(2);
    expect(game.pacman.position).toEqual(START);
    expect(game.ghosts[0].position).toEqual(EXIT);
    expect(game.ghosts[1].state).toBe('house');
    expect(game.waiting).toBeTruthy();
  });

  it('ends the game when the last life is lost', () => {
    const game = alone();
    game.lives = 1;
    game.ghosts = [ghost('blinky', { x: 8, y: 15 }, RIGHT)];

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
    expect(game.pacman.position).toEqual(START);
    expect(game.waiting).toBeTruthy();
  });

  it('releases a ghost once enough pellets are eaten', () => {
    const game = playing({ layout: COMPACT, random: () => 0 });
    stuck(game);
    const states = () => game.ghosts.map((g) => g.state);

    // Pinky comes out at once, Inky after 30 pellets on level 1.
    game.tick();
    expect(states()).toEqual(['active', 'active', 'house', 'house']);

    game.tick();
    expect(states()[2]).toBe('house');

    game._pelletsEaten = 30;
    game.tick();
    expect(states()).toEqual(['active', 'active', 'active', 'house']);
  });

  it('releases the next ghost when Pacman stops eating for 4 s', () => {
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
    game.ghosts = [ghost('blinky', { x: 1, y: 1 }, RIGHT, { frightened: true })];
    // Level 1: 5 flashes in the last 2 s.
    game.frightenedMs = 2200;
    game.pacman = { position: { x: 1, y: 19 }, direction: LEFT };

    game.tick();
    expect(game.cells().flat()).toContain('ghost-frightened');

    game.tick(200);
    expect(game.cells().flat()).toContain('ghost-frightened-ending');

    game.tick(2000);
    expect(game.ghosts[0].frightened).toBeFalsy();
  });

  it('builds the chosen maze from its definition', () => {
    expect(pacmanGame.create({ maze: 'compact' }).width).toBe(19);
    expect(pacmanGame.create({ maze: 'arcade' }).width).toBe(28);
    expect(pacmanGame.options[0].choices[0].value).toBe('compact');
  });

  it('starts at the chosen level, with shorter fright time', () => {
    const game = playing({ layout: COMPACT, random: () => 0, firstLevel: 4 });
    game.ghosts = [];
    expect(game.level).toBe(4);

    game.pacman = { position: { x: 1, y: 3 }, direction: UP };
    stepOnce(game);
    expect(game.frightenedMs).toBe(3000);

    game.reset();
    expect(game.level).toBe(4);
  });

  it('ticks at the arcade 100% speed: one tile per tick', () => {
    expect(new Pacman().speed()).toBe(TICK_MS);
    expect(TICK_MS).toBe(106);
  });

  it('combines the maze and level options', () => {
    expect(pacmanGame.options.map((o) => o.key)).toEqual(['maze', 'level']);
    const game = pacmanGame.create({ maze: 'arcade', level: '2' });
    expect(game.width).toBe(28);
    expect(game.level).toBe(2);
  });

  it('saves and restores its exact state, ghosts and modes included', () => {
    const game = playing({ layout: COMPACT, random: () => 0 });
    for (let i = 0; i < 45; i++) game.tick();
    game.handleKey('ArrowUp');

    const copy = new Pacman({ layout: COMPACT, random: () => 0 });
    copy.restore(JSON.parse(JSON.stringify(game.snapshot())));
    expect(copy.snapshot()).toEqual(game.snapshot());

    for (let i = 0; i < 30; i++) { game.tick(); copy.tick(); }
    expect(copy.snapshot()).toEqual(game.snapshot());
    expect(copy.mode).toBe(game.mode);
  });
});
