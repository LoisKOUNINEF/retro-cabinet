import { MatchFourBoardComponent, type MatchFourBoardConfig } from '../../../components/match-four-board/match-four-board.component.js';
import type { TallyResult } from '../../../services/persistence/persistence.service.js';
import { choiceOf, type Random, type Settings } from '../../game.js';
import type { BonusGame, BonusGameDefinition } from '../bonus-game.js';
import { AI_DELAY_MS, DIFFICULTY_OPTION, FIRST_OPTION, type Difficulty } from '../turns.js';
import { COLOUR_OPTION, MATCH_FOUR_OPTIONS, chooseColumn } from './ai.js';
import { COLUMNS, MatchFour, other, type Disc } from './rules.js';

const CENTRE = Math.floor(COLUMNS / 2);
const capitalized = (disc: Disc) => disc[0]!.toUpperCase() + disc.slice(1);

export interface MatchFourOptions {
  playerDisc: Disc;
  difficulty: Difficulty;
  aiFirst: boolean;
  random: Random;
}

// One round against the AI: the player's drops, the AI's (after AI_DELAY_MS), the keyboard cursor.
export class MatchFourRound implements BonusGame {
  readonly game: MatchFour;
  // Keyboard cursor, as a column.
  cursor = CENTRE;
  // Time left before the AI plays, while it's its turn.
  private _aiWait: number | null = null;

  constructor(private readonly options: MatchFourOptions) {
    const { playerDisc, aiFirst } = options;
    this.game = new MatchFour(aiFirst ? other(playerDisc) : playerDisc);
    if (aiFirst) this._aiWait = AI_DELAY_MS;
  }

  get playerDisc(): Disc {
    return this.options.playerDisc;
  }

  // Only the player's turn, in a round still going, accepts drops.
  get locked(): boolean {
    return this.game.result !== null || this.game.turn !== this.playerDisc;
  }

  get isOver(): boolean {
    return this.game.result !== null;
  }

  get outcome(): TallyResult | null {
    const { result } = this.game;
    if (!result) return null;
    return result === 'draw' ? 'draws' : result === this.playerDisc ? 'wins' : 'losses';
  }

  get status(): string {
    const again = ' Press Enter or New round to play again.';
    const { result } = this.game;
    if (result === 'draw') return `Draw.${again}`;
    if (result === this.playerDisc) return `You win!${again}`;
    if (result) return `Your opponent wins.${again}`;
    return this.locked ? 'Thinking…' : `Your turn (${capitalized(this.playerDisc)}).`;
  }

  nextTickIn(): number | null {
    return this._aiWait;
  }

  tick(dt: number): void {
    if (this._aiWait === null) return;
    this._aiWait -= dt;
    if (this._aiWait > 0) return;
    this._aiWait = null;
    const { board, turn } = this.game;
    this.game.drop(chooseColumn(board, turn, this.options.difficulty, this.options.random));
  }

  select(column: number): void {
    if (this.locked || !this.game.drop(column)) return;
    this.cursor = column;
    if (!this.game.result) this._aiWait = AI_DELAY_MS;
  }

  // ←/→ move the cursor, Enter or Space drops there; 1–7 drop straight in a column.
  handleKey(code: string): boolean {
    if (code === 'Enter' || code === 'Space') {
      this.select(this.cursor);
      return true;
    }
    if (code === 'ArrowLeft' || code === 'ArrowRight') {
      this.cursor = Math.min(Math.max(this.cursor + (code === 'ArrowLeft' ? -1 : 1), 0), COLUMNS - 1);
      return true;
    }
    const digit = /^(?:Digit|Numpad)([1-7])$/.exec(code);
    if (!digit) return false;
    this.cursor = Number(digit[1]) - 1;
    this.select(this.cursor);
    return true;
  }
}

export const matchFourGame: BonusGameDefinition<MatchFourRound, MatchFourBoardConfig> = {
  id: 'match-four',
  options: MATCH_FOUR_OPTIONS,
  create: (settings: Settings, random: Random) => new MatchFourRound({
    playerDisc: choiceOf(settings, COLOUR_OPTION),
    difficulty: choiceOf(settings, DIFFICULTY_OPTION),
    aiFirst: choiceOf(settings, FIRST_OPTION) === 'ai',
    random,
  }),
  board: {
    create: (el, config, onSelect) => new MatchFourBoardComponent(el, config, onSelect),
    config: ({ game, cursor, locked }) => ({ board: [...game.board], winLine: game.winLine, lastCell: game.lastCell, cursor, locked }),
  },
  // Results are kept per difficulty.
  results: { kind: 'tally', key: (settings) => choiceOf(settings, DIFFICULTY_OPTION) },
};
