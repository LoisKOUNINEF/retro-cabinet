import { pick, type GameOption, type Random } from '../../game.js';
import { DIFFICULTY_OPTION, FIRST_OPTION, MISTAKE_CHANCE, type Difficulty } from '../turns.js';
import { legalMoves, other, play, resultOf, type WariState } from './rules.js';

export const WARI_OPTIONS: GameOption[] = [DIFFICULTY_OPTION, FIRST_OPTION];

// Hard looks this many moves ahead (its own and the player's).
export const SEARCH_DEPTH = 6;
// Above any difference of stores: a won game, sooner being better.
const WIN = 1000;

// The AI's pit for the side to move in `state` (which must have a legal move).
// Easy: any. Medium: the biggest capture, leaving the player the smallest one in reply.
// Hard: a search SEARCH_DEPTH moves deep; on MISTAKE_CHANCE of its moves, Medium's instead.
export function choosePit(state: WariState, difficulty: Difficulty, random: Random): number {
  if (difficulty === 'easy') return pick(legalMoves(state), random);
  if (difficulty === 'medium' || random() < MISTAKE_CHANCE) return tacticalPit(state, random);
  return bestPit(state);
}

// The best the side to move can take in one move.
function bestCapture(state: WariState): number {
  return Math.max(0, ...legalMoves(state).map((pit) => play(state, pit).taken));
}

// A finished game, from the point of view of `side`.
function endScore(state: WariState, side: WariState['turn'], depth = 0): number {
  const result = resultOf(state);
  if (result === 'draw') return 0;
  return result === side ? WIN - depth : depth - WIN;
}

// Medium: what it takes, less what the player can take straight back; a won game first.
function tacticalPit(state: WariState, random: Random): number {
  const me = state.turn;
  const scored = legalMoves(state).map((pit) => {
    const move = play(state, pit);
    const score = move.state.ending ? endScore(move.state, me) : move.taken - bestCapture(move.state);
    return { pit, score };
  });
  const best = Math.max(...scored.map(({ score }) => score));
  return pick(scored.filter(({ score }) => score === best).map(({ pit }) => pit), random);
}

// Hard: negamax with alpha-beta pruning, scoring the stores' difference.
function bestPit(state: WariState): number {
  let best = { pit: -1, score: -Infinity };
  for (const pit of legalMoves(state)) {
    const score = -negamax(play(state, pit).state, SEARCH_DEPTH - 1, -Infinity, -best.score, 1);
    if (score > best.score) best = { pit, score };
  }
  return best.pit;
}

// The position's worth for the side to move in it.
function negamax(state: WariState, depth: number, alpha: number, beta: number, ply: number): number {
  if (state.ending) return endScore(state, state.turn, ply);
  if (depth === 0) return state.stores[state.turn] - state.stores[other(state.turn)];
  let best = -Infinity;
  for (const pit of legalMoves(state)) {
    best = Math.max(best, -negamax(play(state, pit).state, depth - 1, -beta, -alpha, ply + 1));
    alpha = Math.max(alpha, best);
    if (alpha >= beta) break;
  }
  return best;
}
