// Wari (Oware abapa): two rows of six pits, four seeds in each to start. The player's pits are
// 0–5 (their row, left to right), the AI's 6–11 (its row, from its own left): sowing goes up the
// indices, anticlockwise round the board.
export const PITS = 12;
export const PITS_PER_SIDE = 6;
export const SEEDS_PER_PIT = 4;
// Over half of the 48 seeds: the game is won.
export const TO_WIN = 25;
// Moves in a row without a capture before the game stops (the seeds would go round for ever).
export const NO_CAPTURE_LIMIT = 50;

export type Side = 'player' | 'ai';

// How a game ended, if it did: a store past half the seeds, the board emptied, no capture for too
// long, or the side to move unable to give its opponent seeds.
export type Ending = 'won' | 'empty' | 'stalled' | 'starved';

export interface WariState {
  readonly pits: readonly number[];
  readonly stores: Readonly<Record<Side, number>>;
  readonly turn: Side;
  // Moves played since the last capture.
  readonly sinceCapture: number;
  readonly ending: Ending | null;
}

export interface WariMove {
  // The position after the move (and after the game's end, if it ended it).
  state: WariState;
  // The pit sown from, then each pit a seed went into, in order.
  from: number;
  path: number[];
  // The pits taken, last sown first; empty when nothing was, or when a grand slam took nothing.
  captured: number[];
  taken: number;
  // The move would have taken every seed the opponent had: it took nothing instead.
  grandSlam: boolean;
}

export const other = (side: Side): Side => (side === 'player' ? 'ai' : 'player');

export const sideOf = (pit: number): Side => (pit < PITS_PER_SIDE ? 'player' : 'ai');

// The side's pits, in sowing order.
export const sidePits = (side: Side): number[] => Array.from({ length: PITS_PER_SIDE }, (_, i) => i + (side === 'player' ? 0 : PITS_PER_SIDE));

export const seedsOn = (pits: readonly number[], side: Side): number => sidePits(side).reduce((total, pit) => total + pits[pit]!, 0);

export function initialState(first: Side): WariState {
  return { pits: Array<number>(PITS).fill(SEEDS_PER_PIT), stores: { player: 0, ai: 0 }, turn: first, sinceCapture: 0, ending: null };
}

// The pits the seeds of `from` go into, one each in turn; a lap of 12 or more skips `from`.
export function sow(pits: readonly number[], from: number): number[] {
  const path: number[] = [];
  let pit = from;
  for (let seeds = pits[from]!; seeds > 0;) {
    pit = (pit + 1) % PITS;
    if (pit === from) continue;
    path.push(pit);
    seeds--;
  }
  return path;
}

const reachesOpponent = (state: WariState, pit: number) => sow(state.pits, pit).some((sown) => sideOf(sown) !== state.turn);

// The pits the side to move may sow: any of its own with seeds, but only those giving the
// opponent seeds when it has none.
export function legalMoves(state: WariState): number[] {
  if (state.ending) return [];
  const moves = sidePits(state.turn).filter((pit) => state.pits[pit]! > 0);
  return seedsOn(state.pits, other(state.turn)) > 0 ? moves : moves.filter((pit) => reachesOpponent(state, pit));
}

// Each side takes the seeds left on its own side.
function collect(pits: readonly number[], stores: Readonly<Record<Side, number>>): Pick<WariState, 'pits' | 'stores'> {
  return {
    pits: Array<number>(PITS).fill(0),
    stores: { player: stores.player + seedsOn(pits, 'player'), ai: stores.ai + seedsOn(pits, 'ai') },
  };
}

// Plays `from` (one of legalMoves) for the side to move. The last seed landing on the opponent's
// side in a pit then holding 2 or 3 takes it, and the unbroken run of 2s and 3s before it there.
export function play(state: WariState, from: number): WariMove {
  const mover = state.turn;
  const path = sow(state.pits, from);
  const pits = [...state.pits];
  pits[from] = 0;
  path.forEach((pit) => pits[pit]!++);

  const captured: number[] = [];
  for (let pit = path.at(-1)!; pit >= 0 && sideOf(pit) !== mover && (pits[pit] === 2 || pits[pit] === 3); pit--) captured.push(pit);
  let taken = captured.reduce((total, pit) => total + pits[pit]!, 0);
  const grandSlam = taken > 0 && taken === seedsOn(pits, other(mover));
  if (grandSlam) {
    captured.length = 0;
    taken = 0;
  }
  captured.forEach((pit) => (pits[pit] = 0));

  const stores = { ...state.stores, [mover]: state.stores[mover] + taken };
  const next: WariState = { pits, stores, turn: other(mover), sinceCapture: taken ? 0 : state.sinceCapture + 1, ending: null };
  return { state: settle(next), from, path, captured, taken, grandSlam };
}

// Ends the game if it is over after a move.
function settle(state: WariState): WariState {
  if (state.stores.player >= TO_WIN || state.stores.ai >= TO_WIN) return { ...state, ending: 'won' };
  if (state.pits.every((seeds) => seeds === 0)) return { ...state, ending: 'empty' };
  if (state.sinceCapture >= NO_CAPTURE_LIMIT) return { ...state, ...collect(state.pits, state.stores), ending: 'stalled' };
  if (!legalMoves(state).length) return { ...state, ...collect(state.pits, state.stores), ending: 'starved' };
  return state;
}

// The winner by stores once the game is over, or a draw; null while it goes on.
export function resultOf(state: WariState): Side | 'draw' | null {
  if (!state.ending) return null;
  const { player, ai } = state.stores;
  return player > ai ? 'player' : ai > player ? 'ai' : 'draw';
}
