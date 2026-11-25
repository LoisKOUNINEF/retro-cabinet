import { pick, type GameOption, type Random } from '../../game.js';
import { DIFFICULTY_OPTION, FIRST_OPTION, MISTAKE_CHANCE, type Difficulty } from '../turns.js';
import { freeCells, other, resultOf, type Board, type Mark } from './tictactoe.js';

export { DIFFICULTY_OPTION, FIRST_OPTION, MISTAKE_CHANCE, type Difficulty };

const CENTRE = 4;

export const MARK_OPTION: GameOption<Mark> = { key: 'mark', label: 'I play', choices: [{ value: 'X', label: 'X' }, { value: 'O', label: 'O' }] };

// Me against Evil Me (as in Malcolm in the Middle): the player is Me, the AI Evil Me.
export const EVIL_ME_FIRST_OPTION: GameOption<'you' | 'ai'> = { ...FIRST_OPTION, choices: [{ value: 'you', label: 'Me' }, { value: 'ai', label: 'Evil Me' }] };

export const TICTACTOE_OPTIONS: GameOption[] = [DIFFICULTY_OPTION, MARK_OPTION, EVIL_ME_FIRST_OPTION];

// The AI's move for `ai` on `board` (which must have a free cell).
export function chooseMove(board: Board, ai: Mark, difficulty: Difficulty, random: Random): number {
  const free = freeCells(board);
  if (difficulty === 'easy') return pick(free, random);
  if (difficulty === 'medium') return tacticalMove(board, ai, random);
  if (random() < MISTAKE_CHANCE) return pick(free, random);
  return bestMove(board, ai);
}

// Medium: win if possible, else block, else the centre, else anywhere.
function tacticalMove(board: Board, ai: Mark, random: Random): number {
  const win = completingMove(board, ai);
  if (win !== null) return win;
  const block = completingMove(board, other(ai));
  if (block !== null) return block;
  if (board[CENTRE] === null) return CENTRE;
  return pick(freeCells(board), random);
}

// A cell that would complete a line for `mark`.
function completingMove(board: Board, mark: Mark): number | null {
  return freeCells(board).find((cell) => resultOf(withMove(board, cell, mark)) === mark) ?? null;
}

// Hard: minimax over the whole game tree (tiny for a 3×3 board).
function bestMove(board: Board, ai: Mark): number {
  let best = { cell: -1, score: -Infinity };
  freeCells(board).forEach((cell) => {
    const score = minimax(withMove(board, cell, ai), ai, other(ai), 1);
    if (score > best.score) best = { cell, score };
  });
  return best.cell;
}

// Scored from the AI's side: winning sooner and losing later are better.
function minimax(board: Board, ai: Mark, turn: Mark, depth: number): number {
  const result = resultOf(board);
  if (result === ai) return 10 - depth;
  if (result === other(ai)) return depth - 10;
  if (result === 'draw') return 0;

  const scores = freeCells(board).map((cell) => minimax(withMove(board, cell, turn), ai, other(turn), depth + 1));
  return turn === ai ? Math.max(...scores) : Math.min(...scores);
}

function withMove(board: Board, cell: number, mark: Mark): Board {
  const next = [...board];
  next[cell] = mark;
  return next;
}
