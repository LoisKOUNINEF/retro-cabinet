import { CURTAIN_MS, FLASH_MS, Tetris, rotate, tetrisGame } from '#root/dist/src/app/games/tetris/tetris.js';

// KINDS order is I, J, L, O, T, S, Z: a constant random picks one kind every time.
const alwaysI = () => 0;
const alwaysO = () => 3 / 7;

// Fills a board row with locked blocks, leaving the given columns empty.
const fillRow = (game, y, except = []) => {
  game.board[y] = game.board[y].map((_, x) => (except.includes(x) ? null : 'tetris-Z'));
};

const dropToBottom = (game) => {
  const pieceBefore = game.piece;
  while (game.piece === pieceBefore && !game.isOver) game.tick();
};

describe('Tetris', () => {
  it('spawns the piece at the top centre with a next piece ready', () => {
    const game = new Tetris(alwaysI);

    expect(game.piece.kind).toBe('I');
    expect(game.piece.x).toBe(4);
    expect(game.piece.y).toBe(0);
    expect(game.next).toBe('I');
    // The I is the shape's second column: x + 1.
    expect(game.cells()[0][5]).toBe('tetris-I');
    expect(game.cells()[3][5]).toBe('tetris-I');
    expect(game.cells()[4][5]).toBe(null);
  });

  it('moves left and right but not through the walls', () => {
    const game = new Tetris(alwaysI);

    for (let i = 0; i < 10; i++) game.handleKey('ArrowLeft');
    expect(game.piece.x).toBe(-1);

    for (let i = 0; i < 20; i++) game.handleKey('ArrowRight');
    expect(game.piece.x).toBe(10);
  });

  it('rotates clockwise and counter-clockwise', () => {
    const shape = [[1, 1, 1], [0, 1, 0], [0, 0, 0]];
    expect(rotate(shape, true)).toEqual([[0, 0, 1], [0, 1, 1], [0, 0, 1]]);
    expect(rotate(shape, false)).toEqual([[1, 0, 0], [1, 1, 0], [1, 0, 0]]);
    expect(rotate(rotate(shape, true), false)).toEqual(shape);
  });

  it('kicks a rotated piece away from the wall', () => {
    const game = new Tetris(alwaysI);
    for (let i = 0; i < 20; i++) game.handleKey('ArrowRight');

    game.handleKey('ArrowUp');

    // Horizontal I spans x..x+3, so it must shift back to x = 8.
    expect(game.piece.x).toBe(8);
    expect(game.piece.shape[1]).toEqual([1, 1, 1, 1]);
  });

  it('keeps the piece unchanged when no rotation fits', () => {
    const game = new Tetris(alwaysI);
    [1, 2, 3].forEach((y) => fillRow(game, y, [5]));
    const shapeBefore = game.piece.shape;

    game.handleKey('KeyE');
    game.handleKey('KeyQ');

    expect(game.piece.shape).toBe(shapeBefore);
    expect(game.piece.x).toBe(4);
  });

  it('locks a piece at the bottom and spawns the next one', () => {
    const game = new Tetris(alwaysO);

    for (let i = 0; i < 18; i++) game.tick();
    expect(game.piece.y).toBe(18);

    game.tick();
    expect(game.board[19][4]).toBe('tetris-O');
    expect(game.board[18][5]).toBe('tetris-O');
    expect(game.piece.y).toBe(0);
  });

  it('soft-drops one row with ArrowDown', () => {
    const game = new Tetris(alwaysO);
    game.handleKey('ArrowDown');
    expect(game.piece.y).toBe(1);
  });

  it('clears a full line and scores 40 × level', () => {
    const game = new Tetris(alwaysO);
    fillRow(game, 19, [4, 5]);

    dropToBottom(game);

    expect(game.lines).toBe(1);
    expect(game.score).toBe(40);
    // The O's top half fell into the cleared row.
    expect(game.board[19][4]).toBe('tetris-O');
    expect(game.board[19][0]).toBe(null);
    expect(game.board[18][4]).toBe(null);
  });

  it('scores 1200 × level for four lines at once', () => {
    const game = new Tetris(alwaysI);
    [16, 17, 18, 19].forEach((y) => fillRow(game, y, [5]));
    game.level = 2;

    dropToBottom(game);

    expect(game.lines).toBe(4);
    expect(game.score).toBe(2400);
    expect(game.board.every((row) => row.every((cell) => cell === null))).toBeTruthy();
  });

  it('levels up every 10 lines and gets faster', () => {
    const game = new Tetris(alwaysO);
    game.lines = 9;
    fillRow(game, 19, [4, 5]);
    const slowSpeed = game.speed();

    dropToBottom(game);

    expect(game.lines).toBe(10);
    expect(game.level).toBe(2);
    expect(game.speed()).toBeLessThan(slowSpeed);
  });

  it('fills the well from the bottom when a piece locks at the top, then ends the game', () => {
    const game = new Tetris(alwaysO);
    fillRow(game, 2);

    game.tick();
    expect(game.phase).toBe('curtain');
    expect(game.isOver).toBeFalsy();
    expect(game.speed()).toBe(CURTAIN_MS);
    game.handleKey('ArrowLeft');
    expect(game.piece.x).toBe(4);

    game.tick();
    game.tick();
    const cells = game.cells();
    expect(cells[19].every((cell) => cell === 'tetris-curtain')).toBeTruthy();
    expect(cells[18].every((cell) => cell === 'tetris-curtain')).toBeTruthy();
    expect(cells[17].some((cell) => cell === 'tetris-curtain')).toBeFalsy();

    for (let i = 2; i < 19; i++) game.tick();
    expect(game.isOver).toBeFalsy();
    game.tick();
    expect(game.isOver).toBeTruthy();
    expect(game.cells().flat().every((cell) => cell === 'tetris-curtain')).toBeTruthy();
  });

  it('resets to a fresh game', () => {
    const game = new Tetris(alwaysO);
    fillRow(game, 2);
    for (let i = 0; i < 21; i++) game.tick();
    game.reset();

    expect(game.isOver).toBeFalsy();
    expect(game.phase).toBe('falling');
    expect(game.curtainRows).toBe(0);
    expect(game.cells()[19][0]).toBe(null);
    expect(game.score).toBe(0);
    expect(game.lines).toBe(0);
    expect(game.board[2][0]).toBe(null);
  });

  it('shows the next piece in a 4×4 preview', () => {
    const game = new Tetris(alwaysO);
    const preview = game.preview();

    expect(preview.length).toBe(4);
    expect(preview[0]).toEqual(['tetris-O', 'tetris-O', null, null]);
    expect(game.stats()).toEqual({ lines: 0 });
  });

  it('starts at the chosen level, with its speed and score multiplier', () => {
    const game = new Tetris(alwaysO, 3);
    expect(game.level).toBe(3);
    expect(game.speed()).toBeLessThan(new Tetris(alwaysO).speed());

    fillRow(game, 19, [4, 5]);
    dropToBottom(game);
    expect(game.score).toBe(120);

    game.reset();
    expect(game.level).toBe(3);
  });

  it('reads the starting level from its definition settings', () => {
    expect(tetrisGame.options.map((o) => o.key)).toEqual(['level']);
    expect(tetrisGame.create({ level: '3' }).level).toBe(3);
  });

  it('saves and restores its exact state', () => {
    const game = new Tetris(alwaysO);
    game.handleKey('ArrowLeft');
    for (let i = 0; i < 25; i++) game.tick();

    const copy = new Tetris(alwaysO);
    copy.restore(JSON.parse(JSON.stringify(game.snapshot())));
    expect(copy.snapshot()).toEqual(game.snapshot());

    for (let i = 0; i < 10; i++) { game.tick(); copy.tick(); }
    expect(copy.snapshot()).toEqual(game.snapshot());
  });

  it('refuses an incomplete save', () => {
    expect(() => new Tetris().restore({ score: 10 })).toThrow();
  });

  it('rotates with the touch button, never with the stick', () => {
    const { touch } = new Tetris();
    expect(touch.directions).toEqual(['left', 'right', 'down']);
    expect(touch.action.code).toBe('ArrowUp');
    expect(touch.repeatMs).toBeGreaterThan(0);
  });

  it('flashes completed lines before they vanish', () => {
    const game = new Tetris(alwaysO);
    fillRow(game, 19, [4, 5]);
    for (let i = 0; i < 19; i++) game.tick();

    expect(game.phase).toBe('clearing');
    expect(game.clearingRows).toEqual([19]);
    expect(game.cells()[19][0]).toBe('tetris-Z-flash');
    expect(game.cells()[19][4]).toBe('tetris-O-flash');
    expect(game.speed()).toBe(FLASH_MS);
    // Scored straight away, so the HUD shows it during the flash.
    expect(game.score).toBe(40);
    expect(game.lines).toBe(1);

    // No moves while the line flashes.
    game.handleKey('ArrowLeft');
    expect(game.clearingRows).toEqual([19]);

    game.tick();
    expect(game.phase).toBe('falling');
    expect(game.board[19][4]).toBe('tetris-O');
    expect(game.board[19][0]).toBe(null);
    expect(game.piece.y).toBe(0);
  });

  it('flashes all four lines of a Tetris', () => {
    const game = new Tetris(alwaysI);
    [16, 17, 18, 19].forEach((y) => fillRow(game, y, [5]));
    for (let i = 0; i < 17; i++) game.tick();

    expect(game.clearingRows).toEqual([16, 17, 18, 19]);
    expect(game.cells().slice(16).every((row) => row.every((cell) => cell.endsWith('-flash')))).toBeTruthy();
  });

  it('saves and restores a game mid-flash and mid-curtain', () => {
    const flashing = new Tetris(alwaysO);
    fillRow(flashing, 19, [4, 5]);
    for (let i = 0; i < 19; i++) flashing.tick();

    const ending = new Tetris(alwaysO);
    fillRow(ending, 2);
    for (let i = 0; i < 6; i++) ending.tick();

    [flashing, ending].forEach((game) => {
      const copy = new Tetris(alwaysO);
      copy.restore(JSON.parse(JSON.stringify(game.snapshot())));
      expect(copy.cells()).toEqual(game.cells());
      for (let i = 0; i < 3; i++) { game.tick(); copy.tick(); }
      expect(copy.snapshot()).toEqual(game.snapshot());
    });
  });
});
