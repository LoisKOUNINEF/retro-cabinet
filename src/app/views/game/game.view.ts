import { Navigation, View, html } from '../../../core/index.js';
import { GameBoardComponent } from '../../components/game-board/game-board.component.js';
import { GameCanvasComponent } from '../../components/game-canvas/game-canvas.component.js';
import { ScoreTableComponent } from '../../components/score-table/score-table.component.js';
import { describeKeys } from '../../components/key-labels.js';
import { isTouchDevice } from '../../components/touch-controls/stick.js';
import { TouchControlsComponent } from '../../components/touch-controls/touch-controls.component.js';
import { GameLoop } from '../../games/game-loop.js';
import { DEFAULT_TOUCH, SAVE_VERSION, type Game, type GameDefinition, type GameOption, type Settings } from '../../games/game.js';
import { PersistenceService } from '../../services/persistence/persistence.service.js';

const templateFn = (game: Game, options: GameOption[]) => html`__TEMPLATE_PLACEHOLDER__`;

const PREVENTED_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

// One view for every game: renders once, then the loop repaints the board and HUD
// directly on each tick. Changing an option builds a new game and re-renders.
// The game is saved whenever it pauses, and comes back paused on the next visit.
export class GameView extends View {
  private game: Game;
  private _loop: GameLoop;
  private _settings: Settings = {};
  private readonly _storage = PersistenceService.getInstance();
  private _board: GameBoardComponent | null = null;
  private _canvas: GameCanvasComponent | null = null;
  private _preview: GameBoardComponent | null = null;
  private _scores: ScoreTableComponent | null = null;
  private _touch: TouchControlsComponent | null = null;
  private _started = false;
  // Restored from a save and not resumed yet.
  private _restored = false;
  // Game over handled (score recorded); `_rank` is where it placed, if it did.
  private _finished = false;
  private _rank: number | null = null;

  constructor(private readonly definition: GameDefinition) {
    super({ viewName: definition.id });
    this.game = this.openGame();
    this._loop = new GameLoop(this.game, () => this.update());
  }

  override registerChildren(): Nutin.ComponentConfig[] {
    const { width, height } = this.game;
    const children: Nutin.ComponentConfig[] = [{
      selector: 'board',
      // A new size (e.g. another maze) needs a new board.
      keep: `${width}x${height}`,
      // Canvas games draw themselves; grid games are painted cell by cell.
      factory: (el) => this.game.draw
        ? this._canvas = new GameCanvasComponent(el, { width, height })
        : this._board = new GameBoardComponent(el, { width, height }),
    }, {
      selector: 'scores',
      keep: 'scores',
      factory: (el) => this._scores = new ScoreTableComponent(el, { entries: this._storage.scores(this.definition.id), highlight: null }),
    }, {
      selector: 'touch',
      keep: this.definition.id,
      // Touch sends the same codes as the keyboard, through the same press/release path.
      factory: (el) => this._touch = new TouchControlsComponent(el, this.game.touch ?? DEFAULT_TOUCH, {
        press: (code) => this.press(code),
        release: (code) => this.release(code),
        togglePlay: () => this.togglePlay(),
      }),
    }];
    const preview = this.game.preview?.();
    if (preview) children.push({
      selector: 'preview',
      keep: 'preview',
      factory: (el) => this._preview = new GameBoardComponent(el, { width: preview[0]?.length ?? 0, height: preview.length }),
    });
    return children;
  }

  override onEnter(): void {
    document.addEventListener('keydown', this._onKeydown);
    document.addEventListener('keyup', this._onKeyup);
    document.addEventListener('visibilitychange', this._onBlur);
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('pagehide', this._onBlur);
  }

  override onExit(): void {
    this.pause();
    document.removeEventListener('keydown', this._onKeydown);
    document.removeEventListener('keyup', this._onKeyup);
    document.removeEventListener('visibilitychange', this._onBlur);
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('pagehide', this._onBlur);
  }

  protected override generateTemplate(): Nutin.Template {
    return templateFn(this.game, this.definition.options ?? []);
  }

  protected override onAfterRender(): void {
    this.update();
    this.showKeyHints();
  }

  // Labels can depend on the keyboard layout, which the browser reports asynchronously.
  private showKeyHints(): void {
    const hints = this.game.keyHints;
    const element = this.element.querySelector('.game__keys');
    if (!hints || !element) return;
    describeKeys(hints).then((text) => element.textContent = text);
  }

  // The saved game if there is a usable one, else a new game with the remembered options.
  private openGame(): Game {
    const { id, options } = this.definition;
    const save = this._storage.savedGame(id);
    if (save) {
      try {
        const game = this.definition.create(save.settings);
        if (!game.restore) throw new Error(`${id} can't restore a save.`);
        game.restore(save.state);
        this._settings = save.settings;
        this._started = true;
        this._restored = true;
        return game;
      } catch {
        // Corrupt or outdated save: start over.
        this._storage.deleteSave(id);
      }
    }
    this._settings = this._storage.settings(id, options);
    return this.definition.create(this._settings);
  }

  private readonly _onKeydown = (event: KeyboardEvent): void => {
    // Let a focused option select handle its own keys.
    if (event.target instanceof HTMLSelectElement) return;
    if (PREVENTED_KEYS.includes(event.code)) event.preventDefault();
    if (event.code === 'Space') return this.togglePlay();
    this.press(event.code);
  };

  private readonly _onKeyup = (event: KeyboardEvent): void => {
    this.release(event.code);
  };

  // Keyboard and touch controls both end up here.
  private press(code: string): void {
    if (!this._loop.isRunning) return;
    this.game.handleKey?.(code);
    this.update();
  }

  private release(code: string): void {
    this.game.handleKeyUp?.(code);
  }

  // Tapping the board starts or resumes, but never pauses: a stray tap can't stop a game.
  private _onBoardTap(): void {
    if (!this._loop.isRunning) this.togglePlay();
  }

  // Window blur, hidden tab (which doesn't always blur the window) or closed page.
  private readonly _onBlur = (): void => {
    this.pause();
    this.update();
  };

  // Every pause saves a game in progress.
  private pause(): void {
    this._loop.pause();
    this.game.releaseKeys?.();
    this._touch?.reset();
    this.save();
  }

  private save(): void {
    if (!this._started || this.game.isOver || !this.game.snapshot) return;
    this._storage.saveGame(this.definition.id, {
      version: SAVE_VERSION,
      settings: this._settings,
      state: this.game.snapshot(),
      savedAt: new Date().toISOString(),
    });
  }

  // Takes the select itself: Nutin's @value token doesn't read <select> elements.
  private _setOption(key: string, select: HTMLSelectElement): void {
    this._settings = { ...this._settings, [key]: select.value };
    this._storage.saveSettings(this.definition.id, this._settings);
    this.startNewGame();
  }

  private _newGame(): void {
    this.startNewGame();
  }

  // Drops the saved game and builds a fresh one with the current options.
  private startNewGame(): void {
    this._loop.pause();
    this.game.releaseKeys?.();
    this._storage.deleteSave(this.definition.id);
    this.game = this.definition.create(this._settings);
    this._loop = new GameLoop(this.game, () => this.update());
    this._started = false;
    this._restored = false;
    this._finished = false;
    this._rank = null;
    this.render();
  }

  private togglePlay(): void {
    if (this.game.isOver) {
      this.game.reset();
      this._finished = false;
      this._rank = null;
    }
    this._started = true;
    this._restored = false;
    if (this._loop.isRunning) this.pause();
    else this._loop.start();
    this.update();
  }

  // Records the result once per game: the score table, and no save to come back to.
  private finish(): void {
    const { id } = this.definition;
    this._finished = true;
    this._storage.deleteSave(id);
    this._rank = this._storage.addScore(id, {
      score: this.game.score,
      level: this.game.level,
      date: new Date().toISOString(),
    });
    this._scores?.update(this._storage.scores(id), this._rank);
  }

  private update(): void {
    if (this.game.isOver && !this._finished) this.finish();

    if (this.game.cells) this._board?.paint(this.game.cells());
    this._canvas?.paint(this.game);
    const preview = this.game.preview?.();
    if (preview) this._preview?.paint(preview);

    const values = { score: this.game.score, level: this.game.level, ...this.game.stats?.() };
    Object.entries(values).forEach(([key, value]) => {
      const element = this.element.querySelector(`[data-stat="${key}"]`);
      if (element) element.textContent = String(value);
    });

    // Options only change between games: locked while playing.
    this.element.querySelectorAll<HTMLSelectElement>('select[data-option]').forEach((select) => {
      select.value = this._settings[select.dataset.option ?? ''] ?? '';
      select.disabled = this._loop.isRunning;
    });

    const status = this.element.querySelector('.game__status');
    if (status) status.textContent = this.statusText();
  }

  private statusText(): string {
    const touch = isTouchDevice();
    const action = touch ? 'tap' : 'press Space';
    if (this.game.isOver) {
      const highScore = this._rank === null ? '' : ` — new high score! (#${this._rank + 1})`;
      return `Game over${highScore} — ${action} to play again`;
    }
    if (this._loop.isRunning) return '';
    if (this._restored) return `Saved game — ${action} to resume`;
    if (this._started) return `Paused — ${action} to resume`;
    return touch ? 'Tap to start' : 'Press Space to start';
  }

  private _goHome(): void {
    Navigation.navigateTo('/');
  }
}
