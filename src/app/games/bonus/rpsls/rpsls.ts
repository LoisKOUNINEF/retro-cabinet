import { RpslsBoardComponent, type RpslsBoardConfig } from '../../../components/rpsls-board/rpsls-board.component.js';
import type { Stat } from '../../../components/stats/stat/stat.component.js';
import type { TallyResult } from '../../../services/persistence/persistence.service.js';
import { choiceOf, pick, type GameOption, type Random, type Settings } from '../../game.js';
import type { BonusGame, BonusGameDefinition } from '../bonus-game.js';
import { HANDS, HAND_NAMES, duel, type Hand } from './hands.js';

export const MATCH_OPTION: GameOption<'single' | '3' | '5'> = {
  key: 'match',
  label: 'Match',
  choices: [{ value: 'single', label: 'Single round' }, { value: '3', label: 'Best of 3' }, { value: '5', label: 'Best of 5' }],
};

export const RPSLS_OPTIONS: GameOption[] = [MATCH_OPTION];

// "Rock, paper, scissors, lizard, Spock…": the AI shows its hand after this long.
export const REVEAL_MS = 700;

// pick: waiting for the player's hand; shaking: both shaking, before the reveal; shown: both hands out.
export type Phase = 'pick' | 'shaking' | 'shown';
export type Side = 'player' | 'ai';

export interface RpslsOptions {
  // Rounds of a best-of match; null for a single round.
  bestOf: number | null;
  random: Random;
}

// A match of Rock Paper Scissors Lizard Spock against the AI, which picks a hand at random:
// a single round (which can be a draw), or best of 3 or 5 (draws are replayed).
export class Rpsls implements BonusGame {
  player: Hand | null = null;
  ai: Hand | null = null;
  phase: Phase = 'pick';
  // The last round's winner, null on a draw or before any round.
  roundWinner: Side | null = null;
  // The last round's line, e.g. "Spock vaporizes Rock".
  line: string | null = null;
  playerWins = 0;
  aiWins = 0;
  cursor = 0;
  private _result: TallyResult | null = null;
  private _wait = 0;

  constructor(private readonly options: RpslsOptions) {}

  // Round wins needed to take the match.
  get target(): number {
    return Math.ceil((this.options.bestOf ?? 1) / 2);
  }

  get isOver(): boolean {
    return this._result !== null;
  }

  get outcome(): TallyResult | null {
    return this._result;
  }

  get status(): string {
    const { bestOf } = this.options;
    if (this.phase === 'pick') return bestOf ? `Pick your hand. First to ${this.target} wins.` : 'Pick your hand.';
    if (this.phase === 'shaking') return 'Rock, paper, scissors, lizard, Spock…';
    const round = this.line ? `${this.line}.` : `Both ${HAND_NAMES[this.player!]}: a draw.`;
    const again = ' Press Enter or New round to play again.';
    switch (this._result) {
      case 'wins': return `${round} You win${bestOf ? ' the match' : ''}!${again}`;
      case 'losses': return `${round} Your opponent wins${bestOf ? ' the match' : ''}.${again}`;
      case 'draws': return `${round}${again}`;
      default: return `${round} ${this.roundWinner === 'player' ? 'Your round.' : this.roundWinner === 'ai' ? 'Your opponent\'s round.' : 'Again!'} Pick your next hand.`;
    }
  }

  nextTickIn(): number | null {
    return this.phase === 'shaking' ? this._wait : null;
  }

  tick(dt: number): void {
    if (this.phase !== 'shaking') return;
    this._wait -= dt;
    if (this._wait <= 0) this.reveal();
  }

  // The player shows hand `index` (in HANDS order); the AI answers after REVEAL_MS.
  select(index: number): void {
    const hand = HANDS[index];
    if (!hand || this.isOver || this.phase === 'shaking') return;
    this.cursor = index;
    this.player = hand;
    this.ai = null;
    this.phase = 'shaking';
    this._wait = REVEAL_MS;
  }

  // 1–5 show a hand, ←/→ move the cursor, Enter or Space show the hand under it.
  handleKey(code: string): boolean {
    const digit = /^(?:Digit|Numpad)([1-5])$/.exec(code);
    if (digit) {
      this.select(Number(digit[1]) - 1);
      return true;
    }
    if (code === 'Enter' || code === 'Space') {
      this.select(this.cursor);
      return true;
    }
    if (code === 'ArrowLeft' || code === 'ArrowRight') {
      this.cursor = Math.min(Math.max(this.cursor + (code === 'ArrowLeft' ? -1 : 1), 0), HANDS.length - 1);
      return true;
    }
    return false;
  }

  stats(): Stat[] {
    return [
      { key: 'you', label: 'You', value: this.playerWins },
      { key: 'ai', label: 'Opponent', value: this.aiWins },
    ];
  }

  private reveal(): void {
    const player = this.player!;
    const ai = pick(HANDS, this.options.random);
    this.ai = ai;
    this.phase = 'shown';
    const result = duel(player, ai);
    this.line = result?.line ?? null;
    this.roundWinner = result ? (result.winner === player ? 'player' : 'ai') : null;
    if (this.roundWinner === 'player') this.playerWins++;
    if (this.roundWinner === 'ai') this.aiWins++;
    // A single round ends either way; a best-of ends when someone reaches the target.
    if (!this.options.bestOf && !this.roundWinner) this._result = 'draws';
    else if (this.playerWins >= this.target) this._result = 'wins';
    else if (this.aiWins >= this.target) this._result = 'losses';
  }
}

export const rpslsGame: BonusGameDefinition<Rpsls, RpslsBoardConfig> = {
  id: 'rpsls',
  options: RPSLS_OPTIONS,
  create: (settings: Settings, random: Random) => {
    const match = choiceOf(settings, MATCH_OPTION);
    return new Rpsls({ bestOf: match === 'single' ? null : Number(match), random });
  },
  board: {
    create: (el, config, onSelect) => new RpslsBoardComponent(el, config, onSelect),
    config: ({ player, ai, phase, roundWinner, cursor, isOver }) => ({ player, ai, phase, roundWinner, cursor, locked: isOver || phase === 'shaking' }),
  },
  // Matches are tallied per length: single rounds, best of 3, best of 5.
  results: { kind: 'tally', key: (settings) => choiceOf(settings, MATCH_OPTION) },
};
