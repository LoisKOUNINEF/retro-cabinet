import { Pacman, pacmanGame } from '#root/dist/src/app/games/pacman/pacman.js';
import { COMPACT } from '#root/dist/src/app/games/pacman/mazes.js';

const UP = { x: 0, y: -1 };
const LEFT = { x: -1, y: 0 };
const RIGHT = { x: 1, y: 0 };

// Compact maze: Pacman starts at (9, 15), the ghost exit is (9, 7).
const START = { x: 9, y: 15 };
const EXIT = { x: 9, y: 7 };

const ghost = (name, position, direction, extra = {}) => ({ name, position, direction, state: 'active', frightened: false, ...extra });

// A game with no ghosts around, to test Pacman alone.
const alone = () => {
  const game = new Pacman(COMPACT, () => 0);
  game.ghosts = [];
  return game;
};

describe('Pacman', () => {
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

  it('moves and eats pellets', () => {
    const game = alone();
    game.tick();

    expect(game.pacman.position).toEqual({ x: 8, y: 15 });
    expect(game.score).toBe(10);
    expect(game.pelletsLeft).toBe(149);
  });

  it('keeps a pressed direction until the turn is open', () => {
    const game = alone();
    // Up is a wall at the start.
    game.handleKey('ArrowUp');

    game.tick();
    expect(game.pacman.position).toEqual({ x: 8, y: 15 });
    expect(game.pacman.direction).toEqual(LEFT);

    game.tick();
    expect(game.pacman.position).toEqual({ x: 8, y: 14 });
    expect(game.pacman.direction).toEqual(UP);
  });

  it('stops at walls', () => {
    const game = alone();
    game.pacman = { position: { x: 1, y: 1 }, direction: LEFT };

    game.tick();

    expect(game.pacman.position).toEqual({ x: 1, y: 1 });
  });

  it('wraps through the tunnel', () => {
    const game = alone();
    game.pacman = { position: { x: 0, y: 9 }, direction: LEFT };

    game.tick();

    expect(game.pacman.position).toEqual({ x: 18, y: 9 });
  });

  it('frightens the active ghosts on a power pellet', () => {
    const game = new Pacman(COMPACT, () => 0);
    game.pacman = { position: { x: 1, y: 3 }, direction: UP };

    game.tick();

    expect(game.score).toBe(50);
    expect(game.frightenedTicks).toBe(48);
    expect(game.ghosts[0].frightened).toBeTruthy();
    expect(game.ghosts[2].frightened).toBeFalsy();
    expect(game.cells().flat()).toContain('ghost-frightened');
  });

  it('eats frightened ghosts for 200, then 400', () => {
    const game = alone();
    game.pellets[1][1] = null;
    game.pellets[1][2] = null;
    game.frightenedTicks = 40;
    game.pacman = { position: { x: 1, y: 2 }, direction: UP };
    // Frightened ghosts stay still on odd ticks.
    game.ghosts = [ghost('blinky', { x: 1, y: 1 }, UP, { frightened: true })];

    game.tick();
    expect(game.score).toBe(200);
    expect(game.ghosts[0].state).toBe('eyes');

    game.ghosts.push(ghost('pinky', { x: 2, y: 1 }, LEFT, { frightened: true }));
    game.ticks = 2;
    game.handleKey('ArrowRight');
    game.tick();
    expect(game.score).toBe(600);
  });

  it('catches a ghost that swaps tiles with Pacman', () => {
    // random 0.99 sends the frightened ghost right, into Pacman's old tile.
    const game = new Pacman(COMPACT, () => 0.99);
    game.frightenedTicks = 40;
    game.ticks = 1;
    game.ghosts = [ghost('blinky', { x: 8, y: 15 }, RIGHT, { frightened: true })];

    game.tick();

    expect(game.pacman.position).toEqual({ x: 8, y: 15 });
    expect(game.ghosts[0].state).toBe('eyes');
    expect(game.score).toBe(210);
  });

  it('loses a life when caught, then resets positions', () => {
    const game = alone();
    // Normal ghosts skip every 5th tick: this one waits for Pacman.
    game.ticks = 4;
    game.ghosts = [ghost('blinky', { x: 8, y: 15 }, RIGHT)];

    game.tick();

    expect(game.lives).toBe(2);
    expect(game.pacman.position).toEqual(START);
    expect(game.ghosts[0].position).toEqual(EXIT);
    expect(game.ghosts[1].state).toBe('house');
  });

  it('ends the game when the last life is lost', () => {
    const game = alone();
    game.lives = 1;
    game.ticks = 4;
    game.ghosts = [ghost('blinky', { x: 8, y: 15 }, RIGHT)];

    game.tick();

    expect(game.isOver).toBeTruthy();
  });

  it('starts the next level once every pellet is eaten', () => {
    const game = alone();
    game.pellets = game.pellets.map((row) => row.map(() => null));
    game.pellets[15][8] = 'pellet';
    const slowSpeed = game.speed();

    game.tick();

    expect(game.level).toBe(2);
    expect(game.pelletsLeft).toBe(150);
    expect(game.pacman.position).toEqual(START);
    expect(game.speed()).toBeLessThan(slowSpeed);
  });

  it('releases ghosts from the house one by one', () => {
    const game = new Pacman(COMPACT, () => 0);
    const states = () => game.ghosts.map((g) => g.state);

    game.tick();
    expect(states()).toEqual(['active', 'active', 'house', 'house']);

    for (let i = 1; i < 40; i++) game.tick();
    expect(states()[2]).toBe('active');
    expect(states()[3]).toBe('house');
  });

  it('switches from scatter to chase on schedule', () => {
    const game = alone();
    for (let i = 0; i < 55; i++) game.tick();
    expect(game.mode).toBe('scatter');

    game.tick();
    expect(game.mode).toBe('chase');
  });

  it('flashes frightened ghosts near the end, then turns them back', () => {
    const game = alone();
    game.ghosts = [ghost('blinky', { x: 1, y: 1 }, RIGHT, { frightened: true })];
    game.frightenedTicks = 17;
    game.pacman = { position: { x: 1, y: 19 }, direction: LEFT };

    game.tick();
    expect(game.cells().flat()).toContain('ghost-frightened-ending');

    for (let i = 0; i < 16; i++) game.tick();
    expect(game.ghosts[0].frightened).toBeFalsy();
  });

  it('builds the chosen maze from its definition', () => {
    expect(pacmanGame.create({ maze: 'compact' }).width).toBe(19);
    expect(pacmanGame.create({ maze: 'arcade' }).width).toBe(28);
    expect(pacmanGame.options[0].choices[0].value).toBe('compact');
  });

  it('starts at the chosen level, with shorter fright time', () => {
    const game = new Pacman(COMPACT, () => 0, 4);
    game.ghosts = [];
    expect(game.level).toBe(4);

    game.pacman = { position: { x: 1, y: 3 }, direction: UP };
    game.tick();
    expect(game.frightenedTicks).toBe(36);

    game.reset();
    expect(game.level).toBe(4);
  });

  it('combines the maze and level options', () => {
    expect(pacmanGame.options.map((o) => o.key)).toEqual(['maze', 'level']);
    const game = pacmanGame.create({ maze: 'arcade', level: '2' });
    expect(game.width).toBe(28);
    expect(game.level).toBe(2);
  });

  it('saves and restores its exact state, ghosts and modes included', () => {
    const game = new Pacman(COMPACT, () => 0);
    for (let i = 0; i < 45; i++) game.tick();
    game.handleKey('ArrowUp');

    const copy = new Pacman(COMPACT, () => 0);
    copy.restore(JSON.parse(JSON.stringify(game.snapshot())));
    expect(copy.snapshot()).toEqual(game.snapshot());

    for (let i = 0; i < 30; i++) { game.tick(); copy.tick(); }
    expect(copy.snapshot()).toEqual(game.snapshot());
    expect(copy.mode).toBe(game.mode);
  });
});
