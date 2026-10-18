import { Navigation, View, html } from '../../../core/index.js';
import { GameOptionsComponent, type GameOptionsConfig } from '../../components/game-options/game-options.component.js';
import { PlayControlsComponent, type PlayState } from '../../components/play-controls/play-controls.component.js';
import { StatsComponent, type StatsConfig } from '../../components/stats/stats.component.js';
import { TicTacToeBoardComponent, type TicTacToeBoardConfig } from '../../components/tictactoe-board/tictactoe-board.component.js';
import { cryptoRandom, type Random, type Settings } from '../../games/game.js';
import { SECRET_OPTIONS, chooseMove, type Difficulty } from '../../games/secret/ai.js';
import { TicTacToe, other, type Mark } from '../../games/secret/tictactoe.js';
import { PersistenceService, type TallyResult } from '../../services/persistence/persistence.service.js';

const GAME_ID = 'secret';
// The AI "thinks" this long before playing, so its move doesn't feel instant.
export const AI_DELAY_MS = 400;

const template = html`__TEMPLATE_PLACEHOLDER__`;

// The hidden game (reached from the 404 page): noughts and crosses against an AI.
// Turn-based: after each move, its children (board, play, tally, options) update.
export class SecretView extends View {
  private readonly _storage = PersistenceService.getInstance();
  private readonly _game = new TicTacToe();
  private _settings: Settings;
  private _board: TicTacToeBoardComponent | null = null;
  private _play: PlayControlsComponent | null = null;
  private _tally: StatsComponent | null = null;
  private _options: GameOptionsComponent | null = null;
  // Keyboard cursor, as a cell index.
  private _cursor = 4;
  private _aiTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly random: Random = cryptoRandom) {
    super({ template, viewName: 'secret' });
    this._settings = this._storage.settings(GAME_ID, SECRET_OPTIONS);
    this.newRound();
  }

  private get playerMark(): Mark {
    return this._settings.mark === 'O' ? 'O' : 'X';
  }

  private get difficulty(): Difficulty {
    return this._settings.difficulty as Difficulty;
  }

  // Only the player's turn, in a round still going, accepts moves.
  private get locked(): boolean {
    return this._game.result !== null || this._game.turn !== this.playerMark;
  }

  override registerChildren(): Nutin.ComponentConfig[] {
    return [{
      selector: 'board',
      keep: 'board',
      factory: (el) => this._board = new TicTacToeBoardComponent(el, this.boardConfig(), (index) => this.playerMove(index)),
    }, {
      selector: 'play',
      keep: 'play',
      factory: (el) => this._play = new PlayControlsComponent(el, this.playState(), { togglePlay: () => this.newRound() }),
    }, {
      selector: 'tally',
      keep: 'tally',
      factory: (el) => this._tally = new StatsComponent(el, this.tallyConfig()),
    }, {
      selector: 'options',
      keep: 'options',
      factory: (el) => this._options = new GameOptionsComponent(el, this.optionsConfig()),
    }];
  }

  override onEnter(): void {
    document.addEventListener('keydown', this._onKeydown);
  }

  override onExit(): void {
    this.cancelAiMove();
    document.removeEventListener('keydown', this._onKeydown);
  }

  override documentTitle(): string {
    return 'Noughts & Crosses';
  }

  protected override onAfterRender(): void {
    this.update();
  }

  private readonly _onKeydown = (event: KeyboardEvent): void => {
    const target = event.target;
    // Selects keep their keys; a focused button handles Enter/Space itself (a click).
    if (target instanceof HTMLSelectElement) return;
    const activates = event.code === 'Enter' || event.code === 'Space';
    if (activates && target instanceof HTMLButtonElement) return;

    if (activates) {
      event.preventDefault();
      if (this._game.result) this.newRound();
      else this.playerMove(this._cursor);
      return;
    }
    const cursor = this.movedCursor(event.code);
    if (cursor === null) return;
    event.preventDefault();
    this._cursor = cursor;
    this.update();
  };

  // The cursor after an arrow key, staying on the board; null for other keys.
  private movedCursor(code: string): number | null {
    const row = Math.floor(this._cursor / 3);
    const col = this._cursor % 3;
    switch (code) {
      case 'ArrowLeft': return col > 0 ? this._cursor - 1 : this._cursor;
      case 'ArrowRight': return col < 2 ? this._cursor + 1 : this._cursor;
      case 'ArrowUp': return row > 0 ? this._cursor - 3 : this._cursor;
      case 'ArrowDown': return row < 2 ? this._cursor + 3 : this._cursor;
      default: return null;
    }
  }

  private newRound(): void {
    this.cancelAiMove();
    const aiFirst = this._settings.first === 'ai';
    this._game.reset(aiFirst ? other(this.playerMark) : this.playerMark);
    this._cursor = 4;
    if (aiFirst) this.scheduleAiMove();
    this.update();
  }

  private playerMove(index: number): void {
    if (this.locked || !this._game.play(index)) return;
    this._cursor = index;
    this.afterMove();
  }

  private afterMove(): void {
    if (this._game.result) this.recordResult();
    else if (this._game.turn !== this.playerMark) this.scheduleAiMove();
    this.update();
  }

  private scheduleAiMove(): void {
    this._aiTimer = setTimeout(() => {
      this._aiTimer = null;
      this._game.play(chooseMove(this._game.board, this._game.turn, this.difficulty, this.random));
      this.afterMove();
    }, AI_DELAY_MS);
  }

  private cancelAiMove(): void {
    if (this._aiTimer !== null) clearTimeout(this._aiTimer);
    this._aiTimer = null;
  }

  private recordResult(): void {
    const { result } = this._game;
    const outcome: TallyResult = result === 'draw' ? 'draws' : result === this.playerMark ? 'wins' : 'losses';
    this._storage.recordResult(GAME_ID, this.difficulty, outcome);
  }

  // One function for the options box, so its config stays the same between moves.
  private readonly setOption = (key: string, value: string): void => {
    this._settings = { ...this._settings, [key]: value };
    this._storage.saveSettings(GAME_ID, this._settings);
    this.newRound();
  };

  private _goHome(): void {
    Navigation.navigateTo('/');
  }

  private boardConfig(): TicTacToeBoardConfig {
    return { board: [...this._game.board], winLine: this._game.winLine, cursor: this._cursor, locked: this.locked };
  }

  private update(): void {
    this._board?.update(this.boardConfig());
    this._play?.update(this.playState());
    this._tally?.update(this.tallyConfig());
    this._options?.update(this.optionsConfig());
  }

  private playState(): PlayState {
    return { label: 'New round', status: this.statusText(), over: false, canStartOver: false };
  }

  // The results at the chosen difficulty.
  private tallyConfig(): StatsConfig {
    const { wins, draws, losses } = this._storage.tally(GAME_ID, this.difficulty);
    return {
      items: [
        { key: 'wins', label: 'Wins', value: wins },
        { key: 'draws', label: 'Draws', value: draws },
        { key: 'losses', label: 'Losses', value: losses },
      ],
    };
  }

  private optionsConfig(): GameOptionsConfig {
    return { options: SECRET_OPTIONS, settings: this._settings, locked: false, onChange: this.setOption };
  }

  private statusText(): string {
    const again = ' Press Enter or New round to play again.';
    const { result } = this._game;
    if (result === 'draw') return `Draw.${again}`;
    if (result === this.playerMark) return `You win!${again}`;
    if (result) return `The AI wins.${again}`;
    return this.locked ? 'Thinking…' : `Your turn (${this.playerMark}).`;
  }
}
