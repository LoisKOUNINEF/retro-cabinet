import { TicTacToeBoardComponent, type TicTacToeBoardConfig } from '../../../components/tictactoe-board/tictactoe-board.component.js';
import type { TallyResult } from '../../../services/persistence/persistence.service.js';
import { choiceOf, type Random, type Settings } from '../../game.js';
import type { BonusGame, BonusGameDefinition } from '../bonus-game.js';
import { AI_DELAY_MS } from '../turns.js';
import { DIFFICULTY_OPTION, FIRST_OPTION, MARK_OPTION, TICTACTOE_OPTIONS, chooseMove, type Difficulty } from './ai.js';
import { TicTacToe, other, type Mark } from './tictactoe.js';

export { AI_DELAY_MS };
const CENTRE = 4;

export interface NoughtsCrossesOptions {
  playerMark: Mark;
  difficulty: Difficulty;
  aiFirst: boolean;
  random: Random;
}

// One round against the AI: the player's moves, the AI's (after AI_DELAY_MS), the keyboard cursor.
export class NoughtsCrosses implements BonusGame {
  readonly game: TicTacToe;
  // Keyboard cursor, as a cell index.
  cursor = CENTRE;
  // Time left before the AI plays, while it's its turn.
  private _aiWait: number | null = null;

  constructor(private readonly options: NoughtsCrossesOptions) {
    const { playerMark, aiFirst } = options;
    this.game = new TicTacToe(aiFirst ? other(playerMark) : playerMark);
    if (aiFirst) this._aiWait = AI_DELAY_MS;
  }

  get playerMark(): Mark {
    return this.options.playerMark;
  }

  // Only the player's turn, in a round still going, accepts moves.
  get locked(): boolean {
    return this.game.result !== null || this.game.turn !== this.playerMark;
  }

  get isOver(): boolean {
    return this.game.result !== null;
  }

  get outcome(): TallyResult | null {
    const { result } = this.game;
    if (!result) return null;
    return result === 'draw' ? 'draws' : result === this.playerMark ? 'wins' : 'losses';
  }

  get status(): string {
    const again = ' Press Enter or New round to play again.';
    const { result } = this.game;
    if (result === 'draw') return `Draw.${again}`;
    if (result === this.playerMark) return `I win!${again}`;
    if (result) return `Evil Me wins.${again}`;
    return this.locked ? 'Evil Me is thinking…' : `My turn (${this.playerMark}).`;
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
    this.game.play(chooseMove(board, turn, this.options.difficulty, this.options.random));
  }

  select(index: number): void {
    if (this.locked || !this.game.play(index)) return;
    this.cursor = index;
    if (!this.game.result) this._aiWait = AI_DELAY_MS;
  }

  handleKey(code: string): boolean {
    if (code === 'Enter' || code === 'Space') {
      this.select(this.cursor);
      return true;
    }
    const cursor = this.movedCursor(code);
    if (cursor === null) return false;
    this.cursor = cursor;
    return true;
  }

  // The cursor after an arrow key, staying on the board; null for other keys.
  private movedCursor(code: string): number | null {
    const row = Math.floor(this.cursor / 3);
    const col = this.cursor % 3;
    switch (code) {
      case 'ArrowLeft': return col > 0 ? this.cursor - 1 : this.cursor;
      case 'ArrowRight': return col < 2 ? this.cursor + 1 : this.cursor;
      case 'ArrowUp': return row > 0 ? this.cursor - 3 : this.cursor;
      case 'ArrowDown': return row < 2 ? this.cursor + 3 : this.cursor;
      default: return null;
    }
  }
}

export const noughtsCrossesGame: BonusGameDefinition<NoughtsCrosses, TicTacToeBoardConfig> = {
  id: 'noughts-and-crosses',
  // Its id when it was the only bonus game: tallies and options carry over.
  storageId: 'secret',
  options: TICTACTOE_OPTIONS,
  create: (settings: Settings, random: Random) => new NoughtsCrosses({
    playerMark: choiceOf(settings, MARK_OPTION),
    difficulty: choiceOf(settings, DIFFICULTY_OPTION),
    aiFirst: choiceOf(settings, FIRST_OPTION) === 'ai',
    random,
  }),
  board: {
    create: (el, config, onSelect) => new TicTacToeBoardComponent(el, config, onSelect),
    config: ({ game, cursor, locked }) => ({ board: [...game.board], winLine: game.winLine, cursor, locked }),
  },
  // Results are kept per difficulty, tallied as the two sides: me against Evil Me.
  results: { kind: 'tally', key: (settings) => choiceOf(settings, DIFFICULTY_OPTION), labels: { wins: 'Me', losses: 'Evil Me' } },
};
