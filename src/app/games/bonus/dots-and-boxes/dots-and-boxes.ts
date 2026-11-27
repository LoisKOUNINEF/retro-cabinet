import { DotsAndBoxesBoardComponent, type DotsAndBoxesBoardConfig } from '../../../components/dots-and-boxes-board/dots-and-boxes-board.component.js';
import type { Stat } from '../../../components/stats/stat/stat.component.js';
import type { TallyResult } from '../../../services/persistence/persistence.service.js';
import { choiceOf, type GameOption, type Random, type Settings, ARROW_CODES, PICK_CODES, type KeyHint } from '../../game.js';
import { clickHint, type BonusGame, type BonusGameDefinition } from '../bonus-game.js';
import { AI_DELAY_MS, DIFFICULTY_OPTION, FIRST_OPTION, type Difficulty } from '../turns.js';
import { chooseLine } from './ai.js';
import { Board, type Player } from './board.js';

export const SIZE_OPTION: GameOption<'3' | '4' | '5' | '6' | '7'> = {
  key: 'size',
  label: 'Size',
  choices: (['3', '4', '5', '6', '7'] as const).map((n) => ({ value: n, label: `${n}x${n}` })),
  defaultValue: '5',
};

export const DOTS_AND_BOXES_OPTIONS: GameOption[] = [SIZE_OPTION, DIFFICULTY_OPTION, FIRST_OPTION];

// Between two lines of the AI's when it took a box and plays again: quick, but each one seen.
export const CHAIN_DELAY_MS = 220;

export interface DotsAndBoxesOptions {
  size: number;
  difficulty: Difficulty;
  aiFirst: boolean;
  random: Random;
}

// One round against the AI: draw lines in turns, close a box to take it and play again;
// whoever takes the most boxes wins.
export class DotsAndBoxes implements BonusGame {
  readonly clickHints = clickHint('a line.');
  readonly rules = [
    'Goal: close more boxes than your opponent.',
    'Take turns drawing a line.',
    "Drawing a box's 4th side takes it, and you play again.",
    'A 3rd side hands the box to the other player.',
  ];
  readonly keyHints: KeyHint[] = [{ action: 'Move', codes: ARROW_CODES }, { action: 'Draw a line', codes: PICK_CODES }];
  readonly board: Board;
  turn: Player;
  // The keyboard cursor, on a line, in the board's grid.
  cursor: { row: number; column: number };
  // The last line drawn, and whether it closed a box.
  lastLine: number | null = null;
  private _lastClosed = false;
  // Time left before the AI plays, while it's its turn.
  private _aiWait: number | null = null;

  constructor(private readonly options: DotsAndBoxesOptions) {
    this.board = new Board(options.size);
    const middle = 2 * Math.floor(options.size / 2);
    this.cursor = { row: middle, column: middle + 1 };
    this.turn = options.aiFirst ? 'ai' : 'player';
    if (options.aiFirst) this._aiWait = AI_DELAY_MS;
  }

  get isOver(): boolean {
    return this.board.isOver;
  }

  // Only the player's turn, in a round still going, accepts lines.
  get locked(): boolean {
    return this.isOver || this.turn !== 'player';
  }

  get playerBoxes(): number {
    return this.board.count('player');
  }

  get aiBoxes(): number {
    return this.board.count('ai');
  }

  get outcome(): TallyResult | null {
    if (!this.isOver) return null;
    if (this.playerBoxes === this.aiBoxes) return 'draws';
    return this.playerBoxes > this.aiBoxes ? 'wins' : 'losses';
  }

  get status(): string {
    const again = ' Press Enter or New round to play again.';
    const score = `${this.playerBoxes}-${this.aiBoxes}`;
    switch (this.outcome) {
      case 'wins': return `You win ${score}!${again}`;
      case 'losses': return `Your opponent wins ${this.aiBoxes}-${this.playerBoxes}.${again}`;
      case 'draws': return `Draw, ${score}.${again}`;
      default:
        if (this.turn === 'ai') return this._lastClosed ? 'Your opponent took a box…' : 'Thinking…';
        return this._lastClosed && this.board.lines[this.lastLine!] === 'player' ? 'Box! Play again.' : 'Your turn.';
    }
  }

  nextTickIn(): number | null {
    return this._aiWait;
  }

  tick(dt: number): void {
    if (this._aiWait === null) return;
    this._aiWait -= dt;
    if (this._aiWait > 0) return;
    this._aiWait = null;
    const { difficulty, random } = this.options;
    this.play(chooseLine(this.board, 'ai', difficulty, random), 'ai');
  }

  select(line: number): void {
    if (this.locked || this.board.lines[line] !== null) return;
    this.cursor = this.board.lineCell(line);
    this.play(line, 'player');
  }

  // Arrows move the cursor from line to line, Enter or Space draws the one under it.
  handleKey(code: string): boolean {
    if (code === 'Enter' || code === 'Space') {
      const cell = this.board.cellAt(this.cursor.row, this.cursor.column);
      if (cell.kind === 'line') this.select(cell.index);
      return true;
    }
    const step = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[code];
    if (!step) return false;
    this.moveCursor(step[0]!, step[1]!);
    return true;
  }

  stats(): Stat[] {
    return [
      { key: 'you', label: 'You', value: this.playerBoxes },
      { key: 'ai', label: 'Opponent', value: this.aiBoxes },
    ];
  }

  private play(line: number, who: Player): void {
    const closed = this.board.draw(line, who);
    this.lastLine = line;
    this._lastClosed = closed.length > 0;
    if (this.isOver) return;
    // A box taken: the same player again.
    if (!this._lastClosed) this.turn = who === 'player' ? 'ai' : 'player';
    if (this.turn === 'ai') this._aiWait = this._lastClosed ? CHAIN_DELAY_MS : AI_DELAY_MS;
  }

  // Lines alternate with dots along a row of lines, and with boxes along a row of vertical lines:
  // across a row the cursor jumps to the next line; up or down it lands next to the dot or box
  // it would hit (on its left, or right at the board's left edge), so every line can be reached.
  private moveCursor(dRow: number, dColumn: number): void {
    const last = this.board.gridSize - 1;
    let { row, column } = this.cursor;
    if (dColumn) column += 2 * dColumn;
    else {
      row += dRow;
      column += column > 0 ? -1 : 1;
    }
    if (row < 0 || row > last || column < 0 || column > last) return;
    this.cursor = { row, column };
  }
}

export const dotsAndBoxesGame: BonusGameDefinition<DotsAndBoxes, DotsAndBoxesBoardConfig> = {
  id: 'dots-and-boxes',
  options: DOTS_AND_BOXES_OPTIONS,
  create: (settings: Settings, random: Random) => new DotsAndBoxes({
    size: Number(choiceOf(settings, SIZE_OPTION)),
    difficulty: choiceOf(settings, DIFFICULTY_OPTION),
    aiFirst: choiceOf(settings, FIRST_OPTION) === 'ai',
    random,
  }),
  board: {
    create: (el, config, onSelect) => new DotsAndBoxesBoardComponent(el, config, onSelect),
    config: (game) => ({
      size: game.board.size,
      lines: [...game.board.lines],
      boxes: [...game.board.boxes],
      lastLine: game.lastLine,
      cursor: game.cursor.row * game.board.gridSize + game.cursor.column,
      locked: game.locked,
    }),
  },
  // A tally per size and difficulty.
  results: { kind: 'tally', key: (settings) => `${choiceOf(settings, SIZE_OPTION)}-${choiceOf(settings, DIFFICULTY_OPTION)}` },
};
