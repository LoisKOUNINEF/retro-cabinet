import { Columns, columnsGame, FLASH_MS, SHATTER_MS } from '#root/dist/src/app/games/columns/columns.js';
import { defaultSettings } from '#root/dist/src/app/games/game.js';

const COLOUR_OF = { r: 'red', o: 'orange', y: 'yellow', g: 'green', b: 'blue', p: 'purple', m: 'magic' };

// Hands out the colours in order: red, orange, yellow, green, blue, purple, red…
const inOrder = () => {
  let i = 0;
  return () => ((i++ % 6) + 0.5) / 6;
};

const newGame = (options = {}) => new Columns({ random: inOrder(), ...options });

// The board from its bottom rows ('.' empty), the rest empty above.
const boardOf = (...rows) => [
  ...Array.from({ length: 13 - rows.length }, () => Array(6).fill(null)),
  ...rows.map((row) => [...row].map((c) => COLOUR_OF[c] ?? null)),
];
const cell = (x, y) => y * 6 + x;

describe('Columns', () => {
  it('drops columns of 3 jewels from the top centre, showing the next one', () => {
    const game = newGame();

    expect(game.piece).toEqual({ jewels: ['red', 'orange', 'yellow'], x: 2, y: -2 });
    expect(game.next).toEqual(['green', 'blue', 'purple']);
    // Only the bottom jewel is inside the well so far.
    expect(game.cells()[0][2]).toBe('jewel-yellow');
    expect(game.preview()).toEqual([['jewel-green'], ['jewel-blue'], ['jewel-purple']]);
    expect(game.stats()).toEqual({ jewels: 0 });
  });

  it('moves between the walls and around jewels', () => {
    const game = newGame();
    for (let i = 0; i < 5; i++) game.handleKey('ArrowLeft');
    expect(game.piece.x).toBe(0);
    for (let i = 0; i < 10; i++) game.handleKey('ArrowRight');
    expect(game.piece.x).toBe(5);

    // A jewel on the top row, just left of the column's visible jewel.
    game.board[0][4] = 'blue';
    game.handleKey('ArrowLeft');
    expect(game.piece.x).toBe(5);
  });

  it('cycles the jewels downward with ↑ or the fire keys', () => {
    const game = newGame();
    game.handleKey('ArrowUp');
    expect(game.piece.jewels).toEqual(['yellow', 'red', 'orange']);
    game.handleKey('KeyZ');
    expect(game.piece.jewels).toEqual(['orange', 'yellow', 'red']);
    game.handleKey('KeyW');
    expect(game.piece.jewels).toEqual(['red', 'orange', 'yellow']);

    game.piece.jewels = ['magic', 'magic', 'magic'];
    game.handleKey('ArrowUp');
    expect(game.piece.jewels).toEqual(['magic', 'magic', 'magic']);
  });

  it('soft-drops one row with ↓', () => {
    const game = newGame();
    game.handleKey('ArrowDown');
    expect(game.piece.y).toBe(-1);
  });

  it('locks a column at the bottom, then sends the next one', () => {
    const game = newGame();
    for (let i = 0; i < 12; i++) game.tick();
    expect(game.piece.y).toBe(10);

    game.tick();
    expect([game.board[10][2], game.board[11][2], game.board[12][2]]).toEqual(['red', 'orange', 'yellow']);
    expect(game.piece).toEqual({ jewels: ['green', 'blue', 'purple'], x: 2, y: -2 });
  });

  it('shatters the pile, then ends the game, when a column can\'t fully enter the well', () => {
    const game = newGame();
    game.board[1][2] = 'blue';

    game.tick();
    // The stuck column's jewel inside the well shatters too.
    expect(game.board[0][2]).toBe('yellow');
    expect(game.phase).toBe('shattering');
    expect(game.speed()).toBe(SHATTER_MS);
    expect(game.isOver).toBeFalsy();
    expect(game.cells()[1][2]).toBe('jewel-blue-burst');

    game.tick();
    expect(game.board[1][2]).toBe(null);
    expect(game.cells()[0][2]).toBe('jewel-yellow-burst');

    game.tick();
    expect(game.isOver).toBeTruthy();
    expect(game.board.flat().every((jewel) => jewel === null)).toBeTruthy();
  });

  it('shatters the pile when the next column has no room to appear, skipping empty rows', () => {
    const game = newGame();
    game.board = boardOf('......');
    game.board[0][2] = 'blue';
    game.piece = { jewels: ['red', 'orange', 'yellow'], x: 0, y: 10 };

    game.tick();
    const bursting = () => game.cells().findIndex((row) => row.some((c) => c?.endsWith('-burst')));
    expect(bursting()).toBe(12);

    [11, 10, 0].forEach((row) => {
      game.tick();
      expect(bursting()).toBe(row);
    });
    expect(game.isOver).toBeFalsy();

    game.tick();
    expect(game.isOver).toBeTruthy();
  });

  it('ignores keys while the pile shatters', () => {
    const game = newGame();
    game.board[1][2] = 'blue';
    game.tick();
    const board = JSON.stringify(game.board);

    ['ArrowLeft', 'ArrowDown', 'ArrowUp'].forEach((code) => game.handleKey(code));

    expect(JSON.stringify(game.board)).toBe(board);
    expect(game.shatterRow).toBe(1);
  });

  it('saves and restores a game mid-shatter', () => {
    const game = newGame();
    game.board = boardOf('rgbrgb', 'gbrgbr');
    game.board[1][2] = 'blue';
    game.tick();
    game.tick();

    const copy = newGame();
    copy.restore(JSON.parse(JSON.stringify(game.snapshot())));
    expect(copy.cells()).toEqual(game.cells());
    for (let i = 0; i < 3; i++) { game.tick(); copy.tick(); }
    expect(copy.snapshot()).toEqual(game.snapshot());
  });

  it('matches runs of 3 in every direction', () => {
    const game = newGame();
    game.board = boardOf('rrr...');
    expect(game.findMatches()).toEqual([cell(0, 12), cell(1, 12), cell(2, 12)]);

    game.board = boardOf('r.....', 'r.....', 'r.....');
    expect(game.findMatches()).toEqual([cell(0, 10), cell(0, 11), cell(0, 12)]);

    game.board = boardOf('r.....', '.r....', '..r...');
    expect(game.findMatches()).toEqual([cell(0, 10), cell(1, 11), cell(2, 12)]);

    game.board = boardOf('..r...', '.r....', 'r.....');
    expect(game.findMatches()).toEqual([cell(2, 10), cell(1, 11), cell(0, 12)]);
  });

  it('counts long runs and crossing runs once per jewel, and ignores pairs', () => {
    const game = newGame();
    game.board = boardOf('rrrrr.');
    expect(game.findMatches().length).toBe(5);

    game.board = boardOf('r.....', 'r.....', 'rrr...');
    expect(game.findMatches().length).toBe(5);

    game.board = boardOf('rr.bb.');
    expect(game.findMatches()).toEqual([]);
  });

  it('flashes matched jewels, then clears them and lets the stack fall', () => {
    const game = newGame();
    game.board = boardOf('rr....');
    game.piece = { jewels: ['orange', 'yellow', 'red'], x: 2, y: 10 };

    game.tick();
    expect(game.phase).toBe('clearing');
    expect(game.matched).toEqual([cell(0, 12), cell(1, 12), cell(2, 12)]);
    expect(game.cells()[12].slice(0, 3)).toEqual(['jewel-red-flash', 'jewel-red-flash', 'jewel-red-flash']);
    expect(game.speed()).toBe(FLASH_MS);
    expect(game.score).toBe(30);
    expect(game.jewels).toBe(3);

    // No moves while the jewels flash.
    const piece = JSON.stringify(game.piece);
    game.handleKey('ArrowLeft');
    expect(JSON.stringify(game.piece)).toBe(piece);

    game.tick();
    expect(game.phase).toBe('falling');
    expect(game.board[12].slice(0, 3)).toEqual([null, null, 'yellow']);
    expect(game.board[11][2]).toBe('orange');
    expect(game.speed()).toBe(800);
  });

  it('chains cascades, each step scoring more', () => {
    const game = newGame();
    // The reds clear, then three greens fall into a row.
    game.board = boardOf('bg....', 'rr.g..');
    game.piece = { jewels: ['orange', 'green', 'red'], x: 2, y: 10 };

    game.tick();
    expect(game.chain).toBe(1);
    expect(game.score).toBe(30);

    game.tick();
    expect(game.chain).toBe(2);
    expect(game.matched).toEqual([cell(1, 12), cell(2, 12), cell(3, 12)]);
    expect(game.score).toBe(30 + 60);

    game.tick();
    expect(game.chain).toBe(0);
    expect(game.phase).toBe('falling');
    expect(game.jewels).toBe(6);
  });

  it('goes up a level every 35 jewels, from the chosen starting level', () => {
    const game = newGame();
    game.jewels = 33;
    game.board = boardOf('rr....');
    game.piece = { jewels: ['orange', 'yellow', 'red'], x: 2, y: 10 };
    const slow = game.speed();
    game.tick();
    game.tick();
    expect(game.level).toBe(2);
    expect(game.speed()).toBeLessThan(slow);

    expect(newGame({ firstLevel: 3 }).level).toBe(3);
  });

  it('clears every jewel of the colour the magic column lands on', () => {
    const game = newGame();
    game.board = boardOf('r..rb.');
    game.piece = { jewels: ['magic', 'magic', 'magic'], x: 0, y: 9 };

    game.tick();
    expect(game.matched).toEqual([cell(0, 9), cell(0, 10), cell(0, 11), cell(0, 12), cell(3, 12)]);
    expect(game.jewels).toBe(2);
    expect(game.score).toBe(20);

    game.tick();
    expect(game.board[12]).toEqual([null, null, null, null, 'blue', null]);
  });

  it('only clears itself when the magic column lands on the floor', () => {
    const game = newGame();
    game.board = boardOf('rr....');
    game.piece = { jewels: ['magic', 'magic', 'magic'], x: 5, y: 10 };

    game.tick();
    expect(game.matched).toEqual([cell(5, 10), cell(5, 11), cell(5, 12)]);
    expect(game.jewels).toBe(0);
  });

  it('sends magic columns only with the option on', () => {
    expect(new Columns({ magic: true, random: () => 0 }).next).toEqual(['magic', 'magic', 'magic']);
    expect(new Columns({ magic: false, random: () => 0 }).next).toEqual(['red', 'red', 'red']);
  });

  it('builds from its definition, magic on by default, with touch and key hints', () => {
    expect(columnsGame.options.map((o) => o.key)).toEqual(['level', 'magic']);
    expect(defaultSettings(columnsGame.options)).toEqual({ level: '1', magic: 'on' });
    expect(columnsGame.create({ level: '4', magic: 'off' }).level).toBe(4);

    const game = newGame();
    expect(game.touch).toEqual({ directions: ['left', 'right', 'down'], repeatMs: 120, action: { label: '⟳', code: 'ArrowUp' } });
    expect(game.keyHints.map((hint) => hint.action)).toEqual(['Move', 'Cycle']);
  });

  it('saves and restores its exact state, mid-flash included', () => {
    const game = newGame();
    game.board = boardOf('bg....', 'rr.g..');
    game.piece = { jewels: ['orange', 'green', 'red'], x: 2, y: 10 };
    game.tick();

    const copy = newGame();
    copy.restore(JSON.parse(JSON.stringify(game.snapshot())));
    expect(copy.snapshot()).toEqual(game.snapshot());

    for (let i = 0; i < 5; i++) { game.tick(); copy.tick(); }
    expect(copy.snapshot()).toEqual(game.snapshot());
  });
});
