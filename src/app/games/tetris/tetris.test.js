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
    const game = new Tetris({ random: alwaysI });

    expect(game.piece.kind).toBe('I');
    expect(game.piece.x).toBe(3);
    expect(game.piece.y).toBe(0);
    expect(game.next).toBe('I');
    // The I is the shape's second column: x + 1.
    expect(game.cells()[0][4]).toBe('tetris-I');
    expect(game.cells()[3][4]).toBe('tetris-I');
    expect(game.cells()[4][4]).toBe(null);
    // The Game Boy's 10×18 well.
    expect(game.width).toBe(10);
    expect(game.height).toBe(18);
  });

  it('moves left and right but not through the walls', () => {
    const game = new Tetris({ random: alwaysI });

    for (let i = 0; i < 10; i++) game.handleKey('ArrowLeft');
    expect(game.piece.x).toBe(-1);

    for (let i = 0; i < 20; i++) game.handleKey('ArrowRight');
    expect(game.piece.x).toBe(8);
  });

  it('rotates clockwise and counter-clockwise', () => {
    const shape = [[1, 1, 1], [0, 1, 0], [0, 0, 0]];
    expect(rotate(shape, true)).toEqual([[0, 0, 1], [0, 1, 1], [0, 0, 1]]);
    expect(rotate(shape, false)).toEqual([[1, 0, 0], [1, 1, 0], [1, 0, 0]]);
    expect(rotate(rotate(shape, true), false)).toEqual(shape);
  });

  it('kicks a rotated piece away from the wall', () => {
    const game = new Tetris({ random: alwaysI });
    for (let i = 0; i < 20; i++) game.handleKey('ArrowRight');

    game.handleKey('ArrowUp');

    // Horizontal I spans x..x+3, so it must shift back to x = 6.
    expect(game.piece.x).toBe(6);
    expect(game.piece.shape[1]).toEqual([1, 1, 1, 1]);
  });

  it('keeps the piece unchanged when no rotation fits', () => {
    const game = new Tetris({ random: alwaysI });
    [1, 2, 3].forEach((y) => fillRow(game, y, [4]));
    const shapeBefore = game.piece.shape;

    game.handleKey('KeyE');
    game.handleKey('KeyQ');

    expect(game.piece.shape).toBe(shapeBefore);
    expect(game.piece.x).toBe(3);
  });

  it('locks a piece at the bottom and spawns the next one', () => {
    const game = new Tetris({ random: alwaysO });

    for (let i = 0; i < 16; i++) game.tick();
    expect(game.piece.y).toBe(16);

    game.tick();
    expect(game.board[17][3]).toBe('tetris-O');
    expect(game.board[16][4]).toBe('tetris-O');
    expect(game.piece.y).toBe(0);
  });

  it('soft-drops one row with ArrowDown', () => {
    const game = new Tetris({ random: alwaysO });
    game.handleKey('ArrowDown');
    expect(game.piece.y).toBe(1);
  });

  it('clears a full line and scores 40 × level', () => {
    const game = new Tetris({ random: alwaysO });
    fillRow(game, 17, [3, 4]);

    dropToBottom(game);

    expect(game.lines).toBe(1);
    expect(game.score).toBe(40);
    // The O's top half fell into the cleared row.
    expect(game.board[17][3]).toBe('tetris-O');
    expect(game.board[17][0]).toBe(null);
    expect(game.board[16][3]).toBe(null);
  });

  it('scores 1200 × level for four lines at once', () => {
    const game = new Tetris({ random: alwaysI });
    [14, 15, 16, 17].forEach((y) => fillRow(game, y, [4]));
    game.level = 2;

    dropToBottom(game);

    expect(game.lines).toBe(4);
    expect(game.score).toBe(2400);
    expect(game.board.every((row) => row.every((cell) => cell === null))).toBeTruthy();
  });

  it('levels up every 10 lines and gets faster', () => {
    const game = new Tetris({ random: alwaysO });
    game.lines = 9;
    fillRow(game, 17, [3, 4]);
    const slowSpeed = game.speed();

    dropToBottom(game);

    expect(game.lines).toBe(10);
    expect(game.level).toBe(2);
    expect(game.speed()).toBeLessThan(slowSpeed);
  });

  it('falls at Game Boy speed: 53 frames per row on level 1, down to 3 from level 21', () => {
    const frame = 1000 / 59.73;
    expect(new Tetris({ random: alwaysO }).speed()).toBe(53 * frame);
    expect(new Tetris({ random: alwaysO, firstLevel: 10 }).speed()).toBe(11 * frame);
    const fastest = new Tetris({ random: alwaysO });
    fastest.level = 30;
    expect(fastest.speed()).toBe(3 * frame);
    expect(FLASH_MS).toBe(1557);
  });

  it('fills the well from the bottom when a piece locks at the top, then ends the game', () => {
    const game = new Tetris({ random: alwaysO });
    fillRow(game, 2);

    game.tick();
    expect(game.phase).toBe('curtain');
    expect(game.isOver).toBeFalsy();
    expect(game.speed()).toBe(CURTAIN_MS);
    game.handleKey('ArrowLeft');
    expect(game.piece.x).toBe(3);

    game.tick();
    game.tick();
    const cells = game.cells();
    expect(cells[17].every((cell) => cell === 'tetris-curtain')).toBeTruthy();
    expect(cells[16].every((cell) => cell === 'tetris-curtain')).toBeTruthy();
    expect(cells[15].some((cell) => cell === 'tetris-curtain')).toBeFalsy();

    for (let i = 2; i < 17; i++) game.tick();
    expect(game.isOver).toBeFalsy();
    game.tick();
    expect(game.isOver).toBeTruthy();
    expect(game.cells().flat().every((cell) => cell === 'tetris-curtain')).toBeTruthy();
  });

  it('resets to a fresh game', () => {
    const game = new Tetris({ random: alwaysO });
    fillRow(game, 2);
    for (let i = 0; i < 21; i++) game.tick();
    game.reset();

    expect(game.isOver).toBeFalsy();
    expect(game.phase).toBe('falling');
    expect(game.curtainRows).toBe(0);
    expect(game.cells()[17][0]).toBe(null);
    expect(game.score).toBe(0);
    expect(game.lines).toBe(0);
    expect(game.board[2][0]).toBe(null);
  });

  it('shows the next piece in a 4×4 preview', () => {
    const game = new Tetris({ random: alwaysO });
    const preview = game.preview();

    expect(preview.length).toBe(4);
    expect(preview[0]).toEqual([null, null, null, null]);
    expect(preview[1]).toEqual([null, 'tetris-O', 'tetris-O', null]);
    expect(preview[2]).toEqual([null, 'tetris-O', 'tetris-O', null]);
    expect(game.stats()).toEqual({ lines: 0 });
  });

  it('centres 2-high pieces vertically in the preview, against the left edge', () => {
    const preview = new Tetris({ random: () => 4 / 7 }).preview();

    expect(preview[0]).toEqual([null, null, null, null]);
    expect(preview[1]).toEqual(['tetris-T', 'tetris-T', 'tetris-T', null]);
    expect(preview[2]).toEqual([null, 'tetris-T', null, null]);
    expect(preview[3]).toEqual([null, null, null, null]);
  });

  it('keeps the I piece upright in the preview\'s second column', () => {
    const preview = new Tetris({ random: alwaysI }).preview();

    expect(preview.map((row) => row[1])).toEqual(['tetris-I', 'tetris-I', 'tetris-I', 'tetris-I']);
  });

  it('starts at the chosen level, with its speed and score multiplier', () => {
    const game = new Tetris({ random: alwaysO, firstLevel: 3 });
    expect(game.level).toBe(3);
    expect(game.speed()).toBeLessThan(new Tetris({ random: alwaysO }).speed());

    fillRow(game, 17, [3, 4]);
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
    const game = new Tetris({ random: alwaysO });
    game.handleKey('ArrowLeft');
    for (let i = 0; i < 25; i++) game.tick();

    const copy = new Tetris({ random: alwaysO });
    copy.restore(JSON.parse(JSON.stringify(game.snapshot())));
    expect(copy.snapshot()).toEqual(game.snapshot());

    for (let i = 0; i < 10; i++) { game.tick(); copy.tick(); }
    expect(copy.snapshot()).toEqual(game.snapshot());
  });

  it('refuses an incomplete save', () => {
    expect(() => new Tetris().restore({ score: 10 })).toThrow();
  });

  it('rotates with a touch button in the D-pad\'s up slot, never with a direction', () => {
    const { touch } = new Tetris();
    expect(touch.directions).toEqual(['left', 'right', 'down']);
    expect(touch.action).toEqual({ label: 'Rotate', code: 'ArrowUp', onPad: true });
    expect(touch.repeatMs).toBeGreaterThan(0);
  });

  it('flashes completed lines before they vanish', () => {
    const game = new Tetris({ random: alwaysO });
    fillRow(game, 17, [3, 4]);
    for (let i = 0; i < 17; i++) game.tick();

    expect(game.phase).toBe('clearing');
    expect(game.clearingRows).toEqual([17]);
    expect(game.cells()[17][0]).toBe('tetris-Z-flash');
    expect(game.cells()[17][3]).toBe('tetris-O-flash');
    expect(game.speed()).toBe(FLASH_MS);
    // Scored straight away, so the HUD shows it during the flash.
    expect(game.score).toBe(40);
    expect(game.lines).toBe(1);

    // No moves while the line flashes.
    game.handleKey('ArrowLeft');
    expect(game.clearingRows).toEqual([17]);

    game.tick();
    expect(game.phase).toBe('falling');
    expect(game.board[17][3]).toBe('tetris-O');
    expect(game.board[17][0]).toBe(null);
    expect(game.piece.y).toBe(0);
  });

  it('flashes all four lines of a Tetris', () => {
    const game = new Tetris({ random: alwaysI });
    [14, 15, 16, 17].forEach((y) => fillRow(game, y, [4]));
    for (let i = 0; i < 15; i++) game.tick();

    expect(game.clearingRows).toEqual([14, 15, 16, 17]);
    expect(game.cells().slice(14).every((row) => row.every((cell) => cell.endsWith('-flash')))).toBeTruthy();
  });

  it('saves and restores a game mid-flash and mid-curtain', () => {
    const flashing = new Tetris({ random: alwaysO });
    fillRow(flashing, 17, [3, 4]);
    for (let i = 0; i < 17; i++) flashing.tick();

    const ending = new Tetris({ random: alwaysO });
    fillRow(ending, 2);
    for (let i = 0; i < 6; i++) ending.tick();

    [flashing, ending].forEach((game) => {
      const copy = new Tetris({ random: alwaysO });
      copy.restore(JSON.parse(JSON.stringify(game.snapshot())));
      expect(copy.cells()).toEqual(game.cells());
      for (let i = 0; i < 3; i++) { game.tick(); copy.tick(); }
      expect(copy.snapshot()).toEqual(game.snapshot());
    });
  });
});
