import { pick, type GameOption, type Random } from '../../game.js';
import { DIFFICULTY_OPTION, FIRST_OPTION, MISTAKE_CHANCE, type Difficulty } from '../turns.js';
import { COLUMNS, LINES, ROWS, cellIndex, freeColumns, landingRow, other, winningLineAt, type Board, type Disc } from './rules.js';

export const COLOUR_OPTION: GameOption<Disc> = {
  key: 'colour',
  label: 'You play',
  choices: [{ value: 'red', label: 'Red' }, { value: 'yellow', label: 'Yellow' }],
};

export const MATCH_FOUR_OPTIONS: GameOption[] = [DIFFICULTY_OPTION, COLOUR_OPTION, FIRST_OPTION];

// Hard looks this many discs ahead (its own and the player's).
export const SEARCH_DEPTH = 6;
const CENTRE = Math.floor(COLUMNS / 2);
// Columns from the centre out: the search tries the likeliest good moves first, so it prunes more.
const ORDER = Array.from({ length: COLUMNS }, (_, i) => i).sort((a, b) => Math.abs(a - CENTRE) - Math.abs(b - CENTRE));
// Above any position's score: a win, sooner being better.
const WIN = 1_000_000;

// The AI's column for `ai` on `board` (which must have a free column).
// Easy: anywhere. Medium: tactics (win, block, don't set up the player, stay central).
// Hard: a search SEARCH_DEPTH discs deep; on MISTAKE_CHANCE of its moves, Medium's tactics instead.
export function chooseColumn(board: Board, ai: Disc, difficulty: Difficulty, random: Random): number {
  if (difficulty === 'easy') return pick(freeColumns(board), random);
  if (difficulty === 'medium' || random() < MISTAKE_CHANCE) return tacticalColumn(board, ai, random);
  return bestColumn(board, ai);
}

// Medium: win if possible, else block, else avoid giving the player a win right above,
// else the most central column (picked at random between two as central).
function tacticalColumn(board: Board, ai: Disc, random: Random): number {
  const free = freeColumns(board);
  const win = free.find((column) => completes(board, column, ai));
  if (win !== undefined) return win;
  const block = free.find((column) => completes(board, column, other(ai)));
  if (block !== undefined) return block;
  const safe = free.filter((column) => !opensWinAbove(board, column, ai));
  const candidates = safe.length ? safe : free;
  const nearest = Math.min(...candidates.map((column) => Math.abs(column - CENTRE)));
  return pick(candidates.filter((column) => Math.abs(column - CENTRE) === nearest), random);
}

// Whether a `disc` dropped in `column` would complete a line.
function completes(board: Board, column: number, disc: Disc): boolean {
  return withDisc(board, column, disc, (cell) => winningLineAt(board, cell) !== null) ?? false;
}

// Whether the AI's disc in `column` lets the player win by dropping on top of it.
function opensWinAbove(board: Board, column: number, ai: Disc): boolean {
  return withDisc(board, column, ai, (cell) => cell >= COLUMNS && completes(board, column, other(ai))) ?? false;
}

// Runs `fn` with `disc` dropped in `column` (the board is put back after); null when the column is full.
function withDisc<T>(board: Board, column: number, disc: Disc, fn: (cell: number) => T): T | null {
  const row = landingRow(board, column);
  if (row === null) return null;
  const cell = cellIndex(row, column);
  board[cell] = disc;
  try {
    return fn(cell);
  } finally {
    board[cell] = null;
  }
}

// Hard: the column with the best negamax score; ties go to the most central.
function bestColumn(board: Board, ai: Disc): number {
  const work = [...board];
  let best = { column: freeColumns(work)[0]!, score: -Infinity };
  for (const column of ORDER) {
    const score = withDisc(work, column, ai, (cell) => scoreMove(work, cell, ai, SEARCH_DEPTH, -Infinity, Infinity, 1));
    if (score !== null && score > best.score) best = { column, score };
  }
  return best.column;
}

// The score, for `disc`, of the disc it just placed at `cell`.
function scoreMove(board: Board, cell: number, disc: Disc, depth: number, alpha: number, beta: number, ply: number): number {
  if (winningLineAt(board, cell)) return WIN - ply;
  if (depth <= 1) return evaluate(board, disc);
  return -negamax(board, other(disc), depth - 1, -beta, -alpha, ply + 1);
}

// Negamax with alpha-beta pruning: the best score `disc` can force, from its side.
function negamax(board: Board, disc: Disc, depth: number, alpha: number, beta: number, ply: number): number {
  let best = -Infinity;
  for (const column of ORDER) {
    const score = withDisc(board, column, disc, (cell) => scoreMove(board, cell, disc, depth, alpha, beta, ply));
    if (score === null) continue;
    best = Math.max(best, score);
    alpha = Math.max(alpha, score);
    if (alpha >= beta) break;
  }
  // No column left: a draw.
  return best === -Infinity ? 0 : best;
}

// A position's worth for `disc`: open lines it nearly fills, minus the opponent's, and central discs.
export function evaluate(board: Board, disc: Disc): number {
  let score = 0;
  for (const line of LINES) {
    let mine = 0;
    let theirs = 0;
    for (const cell of line) {
      if (board[cell] === disc) mine++;
      else if (board[cell] !== null) theirs++;
    }
    if (mine && theirs) continue;
    if (mine === 3) score += 5;
    else if (mine === 2) score += 2;
    else if (theirs === 3) score -= 5;
    else if (theirs === 2) score -= 2;
  }
  for (let row = 0; row < ROWS; row++) {
    const centre = board[cellIndex(row, CENTRE)];
    if (centre === disc) score += 3;
    else if (centre) score -= 3;
  }
  return score;
}
