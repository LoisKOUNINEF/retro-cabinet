import { MinefieldBoardComponent, type MinefieldBoardConfig, type MinefieldView } from '../../../components/minefield-board/minefield-board.component.js';
import type { Stat } from '../../../components/stats/stat/stat.component.js';
import type { TallyResult } from '../../../services/persistence/persistence.service.js';
import { ARROW_DIRECTIONS, choiceOf, shuffle, type GameOption, type Random, type Settings, ARROW_CODES, PICK_CODES, type KeyHint } from '../../game.js';
import type { BonusGame, BonusGameDefinition } from '../bonus-game.js';

export const SIZE_OPTION: GameOption<'easy' | 'medium' | 'hard'> = {
  key: 'size',
  label: 'Size',
  choices: [
    { value: 'easy', label: 'Easy: 9x9, 10 Mines' },
    { value: 'medium', label: 'Medium: 16x16, 40 Mines' },
    { value: 'hard', label: 'Hard: 30x16, 99 Mines' },
  ],
  defaultValue: 'easy',
};

export const MINEFIELD_OPTIONS: GameOption[] = [SIZE_OPTION];

export type Size = typeof SIZE_OPTION.choices[number]['value'];

export interface Field {
  rows: number;
  columns: number;
  mines: number;
}

export const SIZES: Record<Size, Field> = {
  easy: { rows: 9, columns: 9, mines: 10 },
  medium: { rows: 16, columns: 16, mines: 40 },
  hard: { rows: 16, columns: 30, mines: 99 },
};

// hidden → flag → question → hidden, with the flag action; open once dug.
export type CellState = 'hidden' | 'flag' | 'question' | 'open';

export interface MineCell {
  mine: boolean;
  // Mines among its 8 neighbours.
  count: number;
  state: CellState;
}

const SECOND = 1000;

export interface MinefieldOptions extends Field {
  random: Random;
}

// A round of Minefield: dig every cell without a mine. A number tells how many of the 8 cells
// around hide one; flags mark the mines found. The first dig is always safe, and opens an area.
export class Minefield implements BonusGame {
  readonly keyHints: KeyHint[] = [{ action: 'Move', codes: ARROW_CODES }, { action: 'Dig', codes: PICK_CODES }, { action: 'Flag', codes: ['KeyF'] }];
  readonly rows: number;
  readonly columns: number;
  readonly mines: number;
  readonly cells: MineCell[];
  cursor: number;
  // ms since the first dig, until the round ends.
  elapsed = 0;
  // The mine dug, which lost the round.
  exploded: number | null = null;
  private _laid = false;
  private _won = false;

  constructor(private readonly options: MinefieldOptions) {
    const { rows, columns, mines } = options;
    this.rows = rows;
    this.columns = columns;
    this.mines = mines;
    this.cells = Array.from({ length: rows * columns }, () => ({ mine: false, count: 0, state: 'hidden' as CellState }));
    this.cursor = Math.floor(rows / 2) * columns + Math.floor(columns / 2);
  }

  get isOver(): boolean {
    return this.exploded !== null || this._won;
  }

  get outcome(): TallyResult | null {
    if (this._won) return 'wins';
    return this.exploded === null ? null : 'losses';
  }

  get flags(): number {
    return this.cells.filter((cell) => cell.state === 'flag').length;
  }

  get seconds(): number {
    return Math.floor(this.elapsed / SECOND);
  }

  get status(): string {
    const again = ' Press Enter or New round to play again.';
    if (this._won) return `Cleared in ${Math.ceil(this.elapsed / SECOND)} s!${again}`;
    if (this.exploded !== null) return `Boom! You hit a mine.${again}`;
    return this._laid ? 'Careful…' : 'Dig anywhere: the first cell is always safe.';
  }

  // The clock runs from the first dig to the end: a tick on each whole second.
  nextTickIn(): number | null {
    if (!this._laid || this.isOver) return null;
    return SECOND - (this.elapsed % SECOND);
  }

  tick(dt: number): void {
    if (this._laid && !this.isOver) this.elapsed += dt;
  }

  // dig: open the cell (or, on a number with all its flags placed, the cells around it);
  // flag: hidden → flag → question → hidden.
  select(index: number, action = 'dig'): void {
    if (this.isOver || !this.cells[index]) return;
    this.cursor = index;
    if (action === 'flag') this.flag(index);
    else this.dig(index);
  }

  // Arrows move, Enter or Space digs, F flags.
  handleKey(code: string): boolean {
    if (code === 'Enter' || code === 'Space') {
      this.select(this.cursor, 'dig');
      return true;
    }
    if (code === 'KeyF') {
      this.select(this.cursor, 'flag');
      return true;
    }
    const direction = ARROW_DIRECTIONS[code];
    if (!direction) return false;
    const row = Math.min(Math.max(Math.floor(this.cursor / this.columns) + direction.y, 0), this.rows - 1);
    const column = Math.min(Math.max((this.cursor % this.columns) + direction.x, 0), this.columns - 1);
    this.cursor = row * this.columns + column;
    return true;
  }

  stats(): Stat[] {
    return [
      { key: 'mines', label: 'Mines left', value: this.mines - this.flags },
      { key: 'time', label: 'Time', value: this.seconds },
    ];
  }

  neighbours(index: number): number[] {
    const row = Math.floor(index / this.columns);
    const column = index % this.columns;
    const around: number[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = row + dr;
        const c = column + dc;
        if ((dr || dc) && r >= 0 && r < this.rows && c >= 0 && c < this.columns) around.push(r * this.columns + c);
      }
    }
    return around;
  }

  private flag(index: number): void {
    const cell = this.cells[index]!;
    const next: Record<CellState, CellState> = { hidden: 'flag', flag: 'question', question: 'hidden', open: 'open' };
    cell.state = next[cell.state];
  }

  private dig(index: number): void {
    const cell = this.cells[index]!;
    if (cell.state === 'flag') return;
    if (cell.state === 'open') return this.chord(index);
    if (!this._laid) this.lay(index);
    this.open([index]);
  }

  // A number with as many flags around it as its count: the other cells around are opened.
  private chord(index: number): void {
    const cell = this.cells[index]!;
    const around = this.neighbours(index);
    if (!cell.count || around.filter((i) => this.cells[i]!.state === 'flag').length !== cell.count) return;
    this.open(around.filter((i) => this.cells[i]!.state === 'hidden' || this.cells[i]!.state === 'question'));
  }

  // The mines go anywhere but the first cell dug and its neighbours.
  private lay(first: number): void {
    const keepClear = new Set([first, ...this.neighbours(first)]);
    let free = this.cells.map((_, i) => i).filter((i) => !keepClear.has(i));
    if (free.length < this.mines) free = this.cells.map((_, i) => i).filter((i) => i !== first);
    shuffle(free, this.options.random).slice(0, this.mines).forEach((i) => (this.cells[i]!.mine = true));
    this.cells.forEach((cell, i) => (cell.count = this.neighbours(i).filter((n) => this.cells[n]!.mine).length));
    this._laid = true;
  }

  // Opens the cells, and around each 0 the cells next to it, as far as they go.
  private open(start: number[]): void {
    const stack = [...start];
    while (stack.length) {
      const index = stack.pop()!;
      const cell = this.cells[index]!;
      if (cell.state === 'open' || cell.state === 'flag') continue;
      cell.state = 'open';
      if (cell.mine) {
        this.exploded ??= index;
        continue;
      }
      if (cell.count === 0) stack.push(...this.neighbours(index));
    }
    if (this.exploded === null && this.cells.every((cell) => cell.mine || cell.state === 'open')) {
      this._won = true;
      this.cells.forEach((cell) => cell.mine && (cell.state = 'flag'));
    }
  }
}

// What the board shows of a cell: as played, and once lost, the mines and the wrong flags.
function viewOf(game: Minefield, cell: MineCell, index: number): MinefieldView {
  if (index === game.exploded) return 'exploded';
  if (game.exploded !== null) {
    if (cell.mine && cell.state !== 'flag') return 'mine';
    if (!cell.mine && cell.state === 'flag') return 'wrong';
  }
  return cell.state;
}

export const minefieldGame: BonusGameDefinition<Minefield, MinefieldBoardConfig> = {
  id: 'minefield',
  options: MINEFIELD_OPTIONS,
  create: (settings: Settings, random: Random) => new Minefield({ ...SIZES[choiceOf(settings, SIZE_OPTION)], random }),
  board: {
    create: (el, config, onSelect) => new MinefieldBoardComponent(el, config, onSelect),
    config: (game) => ({
      rows: game.rows,
      columns: game.columns,
      // Counts only once dug: a hidden cell gives nothing away, and stays equal when the mines are laid.
      cells: game.cells.map((cell, i) => ({ view: viewOf(game, cell, i), count: cell.state === 'open' ? cell.count : 0 })),
      cursor: game.cursor,
      locked: game.isOver,
    }),
  },
  // A tally (and the best time) per size.
  results: {
    kind: 'tally',
    key: (settings) => choiceOf(settings, SIZE_OPTION),
    draws: false,
    best: { label: 'Best time (s)', score: (game) => Math.ceil(game.elapsed / SECOND) },
  },
};
