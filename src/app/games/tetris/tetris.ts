import {
  applyFields, cryptoRandom, cellAt, emptyGrid, levelFrom, levelOption, pick, pickFields, setCell, FIRE_KEYS,
  type GridGame, type GameDefinition, type Grid, type Random, type Snapshot, type TouchLayout, type KeyHint,
} from '../game.js';
import { KINDS, TETROMINOES, type Shape, type TetrominoKind } from './tetrominoes.js';

// Game Boy values (tetris.wiki/Tetris_(Game_Boy)): its well, gravity and scoring.
const WIDTH = 10;
const HEIGHT = 18;
const FRAME_MS = 1000 / 59.73;
// Frames per row, from the Game Boy's level 0 (our level 1) up to its level 20.
const GRAVITY_FRAMES = [53, 49, 45, 41, 37, 33, 28, 22, 17, 11, 10, 9, 8, 7, 6, 6, 5, 5, 4, 4, 3];
const LINE_POINTS = [40, 100, 300, 1200];
const PREVIEW_SIZE = 4;
// How long completed lines flash before they vanish: the Game Boy's 93-frame pause.
export const FLASH_MS = Math.round(93 * FRAME_MS);
// On game over the well fills up from the bottom, one row per tick.
export const CURTAIN_MS = 40;

export interface Piece {
  kind: TetrominoKind;
  shape: Shape;
  x: number;
  y: number;
}

// Clockwise: transpose then reverse each row. Counter-clockwise: transpose then reverse the rows.
// Shapes are square.
export function rotate(shape: Shape, clockwise: boolean): Shape {
  const transposed = shape.map((_, i) => shape.map(row => row[i] ?? 0));
  return clockwise ? transposed.map(row => row.reverse()) : transposed.reverse();
}

// What a save keeps (held keys and the random source never are).
const SAVED_FIELDS = ['board', 'piece', 'next', 'score', 'level', 'lines', 'isOver', 'phase', 'clearingRows', 'curtainRows'];

export interface TetrisOptions {
  firstLevel?: number;
  random?: Random;
}

export class Tetris implements GridGame {
  readonly kind = 'grid';
  readonly id = 'tetris';
  readonly title = 'Tetris';
  readonly width = WIDTH;
  readonly height = HEIGHT;
  // On touch, the button rotates: the D-pad has no 'up', so a piece never turns by accident.
  readonly touch: TouchLayout = {
    directions: ['left', 'right', 'down'],
    repeatMs: 120,
    action: { label: 'Rotate', code: 'ArrowUp' },
  };
  readonly keyHints: KeyHint[] = [
    { action: 'Move', codes: ['ArrowLeft', 'ArrowRight', 'ArrowDown'] },
    { action: 'Cycle', codes: ['ArrowUp', ...FIRE_KEYS] },
  ];

  score = 0;
  level = 1;
  lines = 0;
  isOver = false;
  board: Grid = emptyGrid(WIDTH, HEIGHT);
  piece!: Piece;
  next!: TetrominoKind;
  // Falling; flashing completed lines; or filling the well after the last piece (game over).
  phase: 'falling' | 'clearing' | 'curtain' = 'falling';
  clearingRows: number[] = [];
  // Rows filled by the game-over curtain, counted from the bottom.
  curtainRows = 0;

  private readonly random: Random;
  private readonly firstLevel: number;

  constructor({ firstLevel = 1, random = cryptoRandom }: TetrisOptions = {}) {
    this.random = random;
    this.firstLevel = firstLevel;
    this.reset();
  }

  reset(): void {
    this.score = 0;
    this.level = this.firstLevel;
    this.lines = 0;
    this.isOver = false;
    this.board = emptyGrid(WIDTH, HEIGHT);
    this.phase = 'falling';
    this.clearingRows = [];
    this.curtainRows = 0;
    this.next = this.randomKind();
    this.spawn();
  }

  tick(): void {
    if (this.isOver) return;
    if (this.phase === 'clearing') return this.removeClearedLines();
    if (this.phase === 'curtain') return this.lowerCurtain();
    if (this.fits(this.piece.shape, this.piece.x, this.piece.y + 1)) {
      this.piece.y += 1;
      return;
    }
    this.lock();
  }

  // The flash and the curtain get their own, shorter ticks.
  speed(): number {
    if (this.phase === 'clearing') return FLASH_MS;
    if (this.phase === 'curtain') return CURTAIN_MS;
    const frames = GRAVITY_FRAMES[Math.min(this.level, GRAVITY_FRAMES.length) - 1]!;
    return frames * FRAME_MS;
  }

  snapshot(): Snapshot {
    return pickFields(this, SAVED_FIELDS);
  }

  restore(snapshot: Snapshot): void {
    applyFields(this, snapshot, SAVED_FIELDS);
  }

  handleKey(code: string): void {
    if (this.isOver || this.phase !== 'falling') return;
    switch (code) {
      case 'ArrowLeft': return this.move(-1);
      case 'ArrowRight': return this.move(1);
      case 'ArrowDown': return this.tick();
      case 'ArrowUp':
      case 'KeyE': return this.rotatePiece(true);
      case 'KeyQ': return this.rotatePiece(false);
    }
  }

  cells(): Grid {
    const grid = this.board.map((row, y) => this.clearingRows.includes(y)
      ? row.map(cell => cell && `${cell}-flash`)
      : [...row]);
    if (this.phase === 'falling') {
      this.eachBlock(this.piece.shape, this.piece.x, this.piece.y, (x, y) => {
        setCell(grid, x, y, `tetris-${this.piece.kind}`);
      });
    }
    for (let y = HEIGHT - this.curtainRows; y < HEIGHT; y++) grid[y] = Array<string>(WIDTH).fill('tetris-curtain');
    return grid;
  }

  // The next piece's blocks, centred in the preview (rounding up and left): T, S and Z
  // sit one row down against the left edge, O in the middle, I, J and L as drawn.
  preview(): Grid {
    const grid = emptyGrid(PREVIEW_SIZE, PREVIEW_SIZE);
    const shape = TETROMINOES[this.next];
    const xs: number[] = [];
    const ys: number[] = [];
    this.eachBlock(shape, 0, 0, (x, y) => { xs.push(x); ys.push(y); });
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    const dx = Math.floor((PREVIEW_SIZE - (Math.max(...xs) - left + 1)) / 2) - left;
    const dy = Math.floor((PREVIEW_SIZE - (Math.max(...ys) - top + 1)) / 2) - top;
    this.eachBlock(shape, dx, dy, (x, y) => setCell(grid, x, y, `tetris-${this.next}`));
    return grid;
  }

  stats(): Record<string, number> {
    return { lines: this.lines };
  }

  private move(dx: number): void {
    if (this.fits(this.piece.shape, this.piece.x + dx, this.piece.y)) this.piece.x += dx;
  }

  // Wall kick: if the rotated piece doesn't fit, shift it 1, -1, 2, -2… up to its width.
  private rotatePiece(clockwise: boolean): void {
    const shape = rotate(this.piece.shape, clockwise);
    const kicks = [0];
    for (let i = 1; i <= shape.length; i++) kicks.push(i, -i);

    const kick = kicks.find(dx => this.fits(shape, this.piece.x + dx, this.piece.y));
    if (kick === undefined) return;
    this.piece.shape = shape;
    this.piece.x += kick;
  }

  private lock(): void {
    const { kind, shape, x, y } = this.piece;
    this.eachBlock(shape, x, y, (bx, by) => setCell(this.board, bx, by, `tetris-${kind}`));
    // Topped out: the curtain falls, then the game is over.
    if (y < 1) {
      this.phase = 'curtain';
      return;
    }
    this.clearingRows = this.board.flatMap((row, rowY) => (row.every(cell => cell !== null) ? [rowY] : []));
    if (!this.clearingRows.length) return this.spawn();

    // Scored now, so the HUD updates while the lines flash.
    const cleared = this.clearingRows.length;
    this.score += (LINE_POINTS[cleared - 1] ?? 0) * this.level;
    this.lines += cleared;
    if (this.lines >= this.level * 10) this.level += 1;
    this.phase = 'clearing';
  }

  // After the flash: the lines go, everything above drops, and the next piece comes in.
  private removeClearedLines(): void {
    const remaining = this.board.filter((_, y) => !this.clearingRows.includes(y));
    this.board = [...emptyGrid(WIDTH, this.clearingRows.length), ...remaining];
    this.clearingRows = [];
    this.phase = 'falling';
    this.spawn();
  }

  private lowerCurtain(): void {
    this.curtainRows += 1;
    if (this.curtainRows >= HEIGHT) this.isOver = true;
  }

  private spawn(): void {
    this.piece = { kind: this.next, shape: TETROMINOES[this.next], x: WIDTH / 2 - 2, y: 0 };
    this.next = this.randomKind();
  }

  private randomKind(): TetrominoKind {
    return pick(KINDS, this.random);
  }

  private fits(shape: Shape, px: number, py: number): boolean {
    let fits = true;
    this.eachBlock(shape, px, py, (x, y) => {
      // Above the board (y < 0) is free, so pieces can rotate at the top.
      if (x < 0 || x >= WIDTH || y >= HEIGHT || (y >= 0 && cellAt(this.board, x, y) !== null)) fits = false;
    });
    return fits;
  }

  private eachBlock(shape: Shape, px: number, py: number, fn: (x: number, y: number) => void): void {
    shape.forEach((row, dy) => row.forEach((filled, dx) => {
      if (filled) fn(px + dx, py + dy);
    }));
  }
}

export const tetrisGame: GameDefinition = {
  id: 'tetris',
  options: [levelOption],
  create: (settings) => new Tetris({ firstLevel: levelFrom(settings) }),
};
