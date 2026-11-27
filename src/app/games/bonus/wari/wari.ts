import { WariBoardComponent, type WariBoardConfig } from '../../../components/wari-board/wari-board.component.js';
import type { Stat } from '../../../components/stats/stat/stat.component.js';
import type { TallyResult } from '../../../services/persistence/persistence.service.js';
import { choiceOf, type Random, type Settings, PICK_CODES, type KeyHint } from '../../game.js';
import type { BonusGame, BonusGameDefinition } from '../bonus-game.js';
import { AI_DELAY_MS, DIFFICULTY_OPTION, FIRST_OPTION, type Difficulty } from '../turns.js';
import { WARI_OPTIONS, choosePit } from './ai.js';
import { NO_CAPTURE_LIMIT, PITS_PER_SIDE, initialState, legalMoves, play, resultOf, seedsOn, sideOf, type WariMove, type WariState } from './rules.js';

// Each seed drops into its pit after this long, then the captured pits empty after CAPTURE_MS.
export const SOW_MS = 150;
export const CAPTURE_MS = 500;

// idle: the player's turn, or the game over; thinking: the AI's pause before its move;
// sowing: a move's seeds dropping one by one; capturing: its captured pits about to empty.
export type Phase = 'idle' | 'thinking' | 'sowing' | 'capturing';

export interface WariOptions {
  difficulty: Difficulty;
  aiFirst: boolean;
  random: Random;
}

// One round against the AI. Moves are worked out at once (rules.ts) but shown step by step:
// each seed sown on its own tick, then the capture, then the other side's turn.
export class WariRound implements BonusGame {
  readonly keyHints: KeyHint[] = [{ action: 'Aim', codes: ['ArrowLeft', 'ArrowRight'] }, { action: 'Sow', codes: PICK_CODES }, { action: 'Sow a pit', keys: '1 to 6' }];
  // The position before the move being shown, or the current one.
  state: WariState;
  phase: Phase = 'idle';
  // Keyboard cursor, as one of the player's pits.
  cursor = 0;
  // The move being shown, and how many of its seeds are sown so far.
  private _move: WariMove | null = null;
  private _sown = 0;
  private _wait = 0;
  // What the last move did, for the status: "You take 5."
  private _note = '';

  constructor(private readonly options: WariOptions) {
    this.state = initialState(options.aiFirst ? 'ai' : 'player');
    if (options.aiFirst) this.think();
  }

  // The pits as shown: during a move, with only the seeds sown so far moved.
  get pits(): number[] {
    const move = this._move;
    if (!move) return [...this.state.pits];
    const pits = [...this.state.pits];
    pits[move.from] = 0;
    move.path.slice(0, this._sown).forEach((pit) => pits[pit]!++);
    return pits;
  }

  // The pit the last seed went into, while sowing or capturing.
  get lastSown(): number | null {
    return this._move && this._sown > 0 ? this._move.path[this._sown - 1]! : null;
  }

  // The pits about to empty into a store.
  get capturing(): number[] {
    return this.phase === 'capturing' && this._move ? [...this._move.captured] : [];
  }

  // Only the player's turn, between moves, in a game still going, takes a pit.
  get locked(): boolean {
    return this.phase !== 'idle' || this.isOver || this.state.turn !== 'player';
  }

  // The player's pits that may be sown now.
  get legal(): number[] {
    return this.locked ? [] : legalMoves(this.state);
  }

  get isOver(): boolean {
    return this.state.ending !== null && this._move === null;
  }

  get outcome(): TallyResult | null {
    if (!this.isOver) return null;
    const result = resultOf(this.state);
    return result === 'draw' ? 'draws' : result === 'player' ? 'wins' : 'losses';
  }

  get status(): string {
    const note = this._note ? `${this._note} ` : '';
    if (this.isOver) return `${note}${this.ending()} Press Enter or New round to play again.`;
    if (this.phase === 'sowing' || this.phase === 'capturing') return 'Sowing…';
    if (this.phase === 'thinking') return `${note}Thinking…`;
    const starving = seedsOn(this.state.pits, 'ai') === 0;
    return `${note}Your turn: ${starving ? 'give your opponent seeds' : 'pick a pit'}.`;
  }

  // Why and how the game ended: "No capture in 50 moves… You win 26 to 22!"
  private ending(): string {
    const { player, ai } = this.state.stores;
    const why = this.state.ending === 'stalled'
      ? `No capture in ${NO_CAPTURE_LIMIT} moves: each side keeps its seeds. `
      : this.state.ending === 'starved' ? 'No move gives seeds: each side keeps its own. ' : '';
    const result = player > ai ? `You win ${player} to ${ai}!` : ai > player ? `Your opponent wins ${ai} to ${player}.` : `Draw, ${player} each.`;
    return `${why}${result}`;
  }

  nextTickIn(): number | null {
    return this.phase === 'idle' ? null : Math.max(this._wait, 0);
  }

  // Runs every step due within dt: a long wait may cover several.
  tick(dt: number): void {
    if (this.nextTickIn() === null) return;
    this._wait -= dt;
    while (this.nextTickIn() !== null && this._wait <= 0) this.step();
  }

  select(pit: number): void {
    if (!this.legal.includes(pit)) return;
    this.cursor = pit;
    this.start(pit);
  }

  // ←/→ move the cursor, Enter or Space sow from it; 1–6 sow straight from a pit.
  handleKey(code: string): boolean {
    if (code === 'Enter' || code === 'Space') {
      this.select(this.cursor);
      return true;
    }
    if (code === 'ArrowLeft' || code === 'ArrowRight') {
      this.cursor = Math.min(Math.max(this.cursor + (code === 'ArrowLeft' ? -1 : 1), 0), PITS_PER_SIDE - 1);
      return true;
    }
    const digit = /^(?:Digit|Numpad)([1-6])$/.exec(code);
    if (!digit) return false;
    this.cursor = Number(digit[1]) - 1;
    this.select(this.cursor);
    return true;
  }

  stats(): Stat[] {
    return [
      { key: 'you', label: 'You', value: this.state.stores.player },
      { key: 'ai', label: 'Opponent', value: this.state.stores.ai },
    ];
  }

  private think(): void {
    this.phase = 'thinking';
    this._wait += AI_DELAY_MS;
  }

  private start(pit: number): void {
    this._move = play(this.state, pit);
    this._sown = 0;
    this._note = '';
    this.phase = 'sowing';
    this._wait += SOW_MS;
  }

  private step(): void {
    if (this.phase === 'thinking') return this.start(choosePit(this.state, this.options.difficulty, this.options.random));
    const move = this._move!;
    if (this.phase === 'sowing') {
      this._sown++;
      if (this._sown < move.path.length) {
        this._wait += SOW_MS;
        return;
      }
      if (move.captured.length) {
        this.phase = 'capturing';
        this._wait += CAPTURE_MS;
        return;
      }
    }
    this.finish(move);
  }

  // The move is shown: its position becomes the game's, and the other side plays.
  private finish(move: WariMove): void {
    const mover = sideOf(move.from);
    this.state = move.state;
    this._move = null;
    this._sown = 0;
    this._note = move.grandSlam
      ? 'That would take every seed: nothing taken.'
      : move.taken ? `${mover === 'player' ? 'You take' : 'Your opponent takes'} ${move.taken}.` : '';
    this.phase = 'idle';
    if (!this.isOver && this.state.turn === 'ai') this.think();
    else this._wait = 0;
  }
}

export const wariGame: BonusGameDefinition<WariRound, WariBoardConfig> = {
  id: 'wari',
  options: WARI_OPTIONS,
  create: (settings: Settings, random: Random) => new WariRound({
    difficulty: choiceOf(settings, DIFFICULTY_OPTION),
    aiFirst: choiceOf(settings, FIRST_OPTION) === 'ai',
    random,
  }),
  board: {
    create: (el, config, onSelect) => new WariBoardComponent(el, config, onSelect),
    config: (game) => {
      const legal = game.legal;
      return {
        pits: game.pits,
        stores: { ...game.state.stores },
        legal: Array.from({ length: PITS_PER_SIDE }, (_, pit) => legal.includes(pit)),
        lastSown: game.lastSown,
        capturing: game.capturing,
        cursor: game.cursor,
        turn: game.state.turn,
      };
    },
  },
  // Results are kept per difficulty.
  results: { kind: 'tally', key: (settings) => choiceOf(settings, DIFFICULTY_OPTION) },
};
