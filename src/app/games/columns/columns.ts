import {
  applyFields, cryptoRandom, FIRE_KEYS, isFireKey, levelFrom, levelOption, levelSpeed, onOff, pick, pickFields,
  type Game, type GameDefinition, type Grid, type KeyHint, type Random, type Snapshot, type TouchLayout,
} from '../game.js';

const WIDTH = 6;
const HEIGHT = 13;
const SPAWN_X = 2;
const BASE_SPEED = 800;
// How long matched jewels flash before they vanish.
export const FLASH_MS = 300;
// Game over: the pile shatters, one row per tick from the bottom (about 1.5 s in all).
export const SHATTER_MS = 115;
const JEWEL_POINTS = 10;
const JEWELS_PER_LEVEL = 35;
const MAGIC_CHANCE = 1 / 50;

export const COLOURS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'] as const;
export type Colour = typeof COLOURS[number];
// The magic jewel clears every jewel of the colour it lands on.
export type Jewel = Colour | 'magic';

// A falling column of 3 jewels, top to bottom; y is the top jewel's row (negative = above the well).
export interface Piece {
  jewels: Jewel[];
  x: number;
  y: number;
}

// Runs are looked for rightwards, downwards and along both diagonals.
const DIRECTIONS = [[1, 0], [0, 1], [1, 1], [1, -1]] as const;

export interface ColumnsOptions {
  firstLevel?: number;
  magic?: boolean;
  random?: Random;
}

// What a save keeps (the random source never is).
const SAVED_FIELDS = [
  'board', 'piece', 'next', 'phase', 'matched', 'chain', 'shatterRow', 'jewels', 'score', 'level', 'isOver',
];

export class Columns implements Game {
  readonly id = 'columns';
  readonly title = 'Columns';
  readonly width = WIDTH;
  readonly height = HEIGHT;
  // As in Tetris: the D-pad moves and drops, the button cycles the jewels.
  readonly touch: TouchLayout = {
    directions: ['left', 'right', 'down'],
    repeatMs: 120,
    action: { label: 'Cycle', code: 'ArrowUp' },
  };
  readonly keyHints: KeyHint[] = [
    { action: 'Move', codes: ['ArrowLeft', 'ArrowRight', 'ArrowDown'] },
    { action: 'Cycle', codes: ['ArrowUp', ...FIRE_KEYS] },
  ];

  score = 0;
  level = 1;
  // Jewels cleared so far: every 35 is a level.
  jewels = 0;
  isOver = false;
  board: (Jewel | null)[][] = [];
  piece: Piece = { jewels: [], x: SPAWN_X, y: 0 };
  next: Jewel[] = [];
  // Falling; flashing matched jewels before they vanish; or shattering the pile (game over).
  phase: 'falling' | 'clearing' | 'shattering' = 'falling';
  // While shattering: the row bursting now.
  shatterRow = 0;
  // Cells being cleared, as y * WIDTH + x.
  matched: number[] = [];
  // Steps in the current cascade: each one multiplies the score.
  chain = 0;
  private readonly random: Random;

  constructor(private readonly options: ColumnsOptions = {}) {
    this.random = options.random ?? cryptoRandom;
    this.reset();
  }

  private get firstLevel(): number {
    return this.options.firstLevel ?? 1;
  }

  reset(): void {
    this.score = 0;
    this.level = this.firstLevel;
    this.jewels = 0;
    this.isOver = false;
    this.board = Array.from({ length: HEIGHT }, () => Array<Jewel | null>(WIDTH).fill(null));
    this.phase = 'falling';
    this.matched = [];
    this.chain = 0;
    this.shatterRow = 0;
    this.next = this.newJewels();
    this.spawn();
  }

  tick(): void {
    if (this.isOver) return;
    if (this.phase === 'clearing') return this.clearMatched();
    if (this.phase === 'shattering') return this.shatter();
    if (this.fits(this.piece.x, this.piece.y + 1)) this.piece.y += 1;
    else this.lock();
  }

  // The flash and the shatter get their own, shorter ticks.
  speed(): number {
    if (this.phase === 'clearing') return FLASH_MS;
    if (this.phase === 'shattering') return SHATTER_MS;
    return levelSpeed(BASE_SPEED, this.level);
  }

  snapshot(): Snapshot {
    return pickFields(this, SAVED_FIELDS);
  }

  restore(snapshot: Snapshot): void {
    applyFields(this, snapshot, SAVED_FIELDS);
  }

  handleKey(code: string): void {
    if (this.isOver || this.phase !== 'falling') return;
    if (code === 'ArrowLeft') this.move(-1);
    if (code === 'ArrowRight') this.move(1);
    if (code === 'ArrowDown') this.tick();
    if (code === 'ArrowUp' || isFireKey(code)) this.cycle();
  }

  cells(): Grid {
    const grid: Grid = this.board.map((row, y) => row.map((jewel, x) => {
      if (!jewel) return null;
      if (this.phase === 'shattering' && y === this.shatterRow) return `jewel-${jewel}-burst`;
      return this.matched.includes(y * WIDTH + x) ? `jewel-${jewel}-flash` : `jewel-${jewel}`;
    }));
    if (this.phase === 'falling' && !this.isOver) {
      this.piece.jewels.forEach((jewel, i) => {
        const row = grid[this.piece.y + i];
        if (row) row[this.piece.x] = `jewel-${jewel}`;
      });
    }
    return grid;
  }

  preview(): Grid {
    return this.next.map((jewel) => [`jewel-${jewel}`]);
  }

  stats(): Record<string, number> {
    return { jewels: this.jewels };
  }

  private move(dx: number): void {
    if (this.fits(this.piece.x + dx, this.piece.y)) this.piece.x += dx;
  }

  // The bottom jewel goes to the top; a magic column looks the same either way.
  private cycle(): void {
    const [top, middle, bottom] = this.piece.jewels;
    if (top === 'magic' || !top || !middle || !bottom) return;
    this.piece.jewels = [bottom, top, middle];
  }

  // Inside the walls, above the floor, on free cells (above the well is always free).
  private fits(x: number, y: number): boolean {
    if (x < 0 || x >= WIDTH) return false;
    return this.piece.jewels.every((_, i) => {
      const row = y + i;
      return row < HEIGHT && (row < 0 || this.board[row]?.[x] === null);
    });
  }

  private lock(): void {
    const { jewels, x, y } = this.piece;
    jewels.forEach((jewel, i) => {
      const row = this.board[y + i];
      if (row) row[x] = jewel;
    });
    // Stuck before fully entering the well: the stack has reached the top.
    if (y < 0) {
      this.startShatter();
      return;
    }
    if (jewels[0] === 'magic') this.matchMagic(x, y + jewels.length);
    else this.resolve();
  }

  // Matches clear (with a flash) and the stack falls, which can make new matches: a chain.
  private resolve(): void {
    this.matched = this.findMatches();
    if (this.matched.length) return this.startClearing();
    this.chain = 0;
    this.spawn();
  }

  // Every jewel of the colour under the magic column goes, with the magic jewels themselves.
  private matchMagic(x: number, rowBelow: number): void {
    const colour = this.board[rowBelow]?.[x] ?? null;
    this.matched = [];
    this.board.forEach((row, y) => row.forEach((jewel, cx) => {
      if (jewel === 'magic' || (colour && jewel === colour)) this.matched.push(y * WIDTH + cx);
    }));
    this.startClearing();
  }

  private startClearing(): void {
    const cleared = this.matched.filter((cell) => this.jewelAt(cell) !== 'magic').length;
    this.chain += 1;
    this.score += cleared * JEWEL_POINTS * this.level * this.chain;
    this.jewels += cleared;
    this.level = Math.max(this.level, this.firstLevel + Math.floor(this.jewels / JEWELS_PER_LEVEL));
    this.phase = 'clearing';
  }

  private clearMatched(): void {
    this.matched.forEach((cell) => {
      const row = this.board[Math.floor(cell / WIDTH)];
      if (row) row[cell % WIDTH] = null;
    });
    this.matched = [];
    this.applyGravity();
    this.phase = 'falling';
    this.resolve();
  }

  // Each column's jewels drop to the bottom, keeping their order.
  private applyGravity(): void {
    for (let x = 0; x < WIDTH; x++) {
      const stack = this.board.map((row) => row[x] ?? null).filter((jewel) => jewel !== null);
      const column = [...Array<Jewel | null>(HEIGHT - stack.length).fill(null), ...stack];
      column.forEach((jewel, y) => {
        const row = this.board[y];
        if (row) row[x] = jewel;
      });
    }
  }

  // Every cell in a run of 3 or more of the same colour, in any direction, counted once.
  findMatches(): number[] {
    const matched = new Set<number>();
    this.board.forEach((row, y) => row.forEach((jewel, x) => {
      if (!jewel || jewel === 'magic') return;
      DIRECTIONS.forEach(([dx, dy]) => {
        // Only count from the start of a run.
        if (this.board[y - dy]?.[x - dx] === jewel) return;
        let length = 1;
        while (this.board[y + dy * length]?.[x + dx * length] === jewel) length += 1;
        if (length < 3) return;
        for (let i = 0; i < length; i++) matched.add((y + dy * i) * WIDTH + x + dx * i);
      });
    }));
    return [...matched].sort((a, b) => a - b);
  }

  private jewelAt(cell: number): Jewel | null {
    return this.board[Math.floor(cell / WIDTH)]?.[cell % WIDTH] ?? null;
  }

  // The next piece enters with its bottom jewel on the top row; no room means game over.
  private spawn(): void {
    this.piece = { jewels: this.next, x: SPAWN_X, y: 1 - this.next.length };
    this.next = this.newJewels();
    if (!this.fits(this.piece.x, this.piece.y)) this.startShatter();
  }

  // Game over: the pile shatters from the bottom row up, then the game ends.
  private startShatter(): void {
    this.phase = 'shattering';
    this.shatterRow = this.nextFullRow(HEIGHT - 1);
    if (this.shatterRow < 0) this.isOver = true;
  }

  private shatter(): void {
    this.board[this.shatterRow]?.fill(null);
    this.shatterRow = this.nextFullRow(this.shatterRow - 1);
    if (this.shatterRow < 0) this.isOver = true;
  }

  // The first row from `from` upwards with a jewel in it, or -1.
  private nextFullRow(from: number): number {
    let y = from;
    while (y >= 0 && this.board[y]?.every((jewel) => jewel === null)) y -= 1;
    return y;
  }

  private newJewels(): Jewel[] {
    if (this.options.magic && this.random() < MAGIC_CHANCE) return ['magic', 'magic', 'magic'];
    return Array.from({ length: 3 }, () => pick(COLOURS, this.random));
  }
}

export const columnsGame: GameDefinition = {
  id: 'columns',
  options: [levelOption, onOff('magic', 'Magic jewel', true)],
  create: (settings) => new Columns({ firstLevel: levelFrom(settings), magic: settings.magic !== 'off' }),
};
