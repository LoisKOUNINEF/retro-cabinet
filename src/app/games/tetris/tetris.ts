import {
  applyFields, cellAt, emptyGrid, levelFrom, levelOption, levelSpeed, pick, pickFields, setCell,
  type Game, type GameDefinition, type Grid, type Random, type Snapshot, type TouchLayout,
} from '../game.js';
import { KINDS, TETROMINOES, type Shape, type TetrominoKind } from './tetrominoes.js';

const WIDTH = 12;
const HEIGHT = 20;
const BASE_SPEED = 1000;
const LINE_POINTS = [40, 100, 300, 1200];
const PREVIEW_SIZE = 4;
// How long completed lines flash before they vanish.
export const FLASH_MS = 300;
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

export class Tetris implements Game {
  readonly id = 'tetris';
  readonly title = 'Tetris';
  readonly width = WIDTH;
  readonly height = HEIGHT;
  // On touch, the button rotates: the stick has no 'up', so a piece never turns by accident.
  readonly touch: TouchLayout = {
    directions: ['left', 'right', 'down'],
    repeatMs: 120,
    action: { label: '⟳', code: 'ArrowUp' },
  };

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

  constructor(private readonly random: Random = Math.random, private readonly firstLevel = 1) {
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

  preview(): Grid {
    const grid = emptyGrid(PREVIEW_SIZE, PREVIEW_SIZE);
    this.eachBlock(TETROMINOES[this.next], 0, 0, (x, y) => setCell(grid, x, y, `tetris-${this.next}`));
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
  create: (settings) => new Tetris(Math.random, levelFrom(settings)),
};
