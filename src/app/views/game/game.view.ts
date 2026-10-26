import { Navigation, View, html } from '../../../core/index.js';
import { GameBoardComponent } from '../../components/game-board/game-board.component.js';
import { GameCanvasComponent } from '../../components/game-canvas/game-canvas.component.js';
import { GameOptionsComponent, type GameOptionsConfig } from '../../components/game-options/game-options.component.js';
import { ScoreTableComponent } from '../../components/score-table/score-table.component.js';
import { PlayControlsComponent, type PlayState } from '../../components/play-controls/play-controls.component.js';
import { PlayToggleComponent } from '../../components/play-toggle/play-toggle.component.js';
import { StatsComponent, type StatsConfig } from '../../components/stats/stats.component.js';
import { isTouchDevice } from '../../components/touch-controls/stick.js';
import { TouchControlsComponent } from '../../components/touch-controls/touch-controls.component.js';
import { GameLoop } from '../../games/game-loop.js';
import { isControlKey } from '../keyboard.js';
import { DEFAULT_TOUCH, SAVE_VERSION, type Game, type GameDefinition, type GameOption, type Grid, type Settings } from '../../games/game.js';
import { PersistenceService, validSettings } from '../../services/persistence/persistence.service.js';
import type { DrawerElement } from 'a11y-elements/overlays/drawer/element';

const templateFn = (game: Game, hasPreview: boolean, hasOptions: boolean) => html`__TEMPLATE_PLACEHOLDER__`;

const PREVENTED_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
// Phones ($breakpoints.medium in styles/base/_mixins.scss): the HUD panel moves into a drawer.
const MOBILE_QUERY = '(max-width: 768px)';

// One view for every game: renders once, then the loop repaints the board and HUD
// directly on each tick. Changing an option builds a new game and re-renders.
// The game is saved whenever it pauses, and comes back paused on the next visit.
export class GameView extends View {
  private _game: Game;
  private _loop: GameLoop;
  private _settings: Settings = {};
  private readonly _storage = PersistenceService.getInstance();
  private _board: GameBoardComponent | null = null;
  private _canvas: GameCanvasComponent | null = null;
  private _preview: GameBoardComponent | null = null;
  private _scores: ScoreTableComponent | null = null;
  private _play: PlayControlsComponent | null = null;
  private _stats: StatsComponent | null = null;
  private _options: GameOptionsComponent | null = null;
  private _touch: TouchControlsComponent | null = null;
  private _playToggle: PlayToggleComponent | null = null;
  // Phones: the HUD drawer, created on first use, and the media query that moves the panel.
  private _drawer: DrawerElement | null = null;
  private _mobileQuery: MediaQueryList | null = null;
  // The current render's panel and Next box, wherever they were moved.
  private _panel: HTMLElement | null = null;
  private _next: HTMLElement | null = null;
  // Focused in the drawer before a render (e.g. an option changed): focused again after it.
  private _drawerFocus: HTMLElement | null = null;
  private _started = false;
  // Restored from a save and not resumed yet.
  private _restored = false;
  // Game over handled (score recorded); `_rank` is where it placed, if it did.
  private _finished = false;
  private _rank: number | null = null;

  constructor(private readonly _definition: GameDefinition) {
    super({ viewName: _definition.id });
    this._game = this.openGame();
    this._loop = new GameLoop(this._game, () => this.update());
  }

  override registerChildren(): Nutin.ComponentConfig[] {
    const { width, height } = this._game;
    const touch = this._game.touch ?? DEFAULT_TOUCH;
    const children: Nutin.ComponentConfig[] = [{
      selector: 'board',
      // A new size (e.g. another maze) needs a new board.
      keep: `${width}x${height}`,
      // Canvas games draw themselves; grid games are painted cell by cell.
      factory: (el) => this._game.kind === 'canvas'
        ? this._canvas = new GameCanvasComponent(el, { width, height })
        : this._board = new GameBoardComponent(el, { width, height }),
    }, {
      selector: 'play',
      keep: 'play',
      factory: (el) => this._play = new PlayControlsComponent(el, this.playState(), {
        togglePlay: () => this.togglePlay(),
        newGame: () => this.startNewGame(),
      }, this._game.keyHints),
    }, {
      selector: 'play-toggle',
      keep: 'play-toggle',
      factory: (el) => this._playToggle = new PlayToggleComponent(el, { running: this._loop.isRunning }, () => this.togglePlay()),
    }, {
      selector: 'stats',
      keep: 'stats',
      factory: (el) => this._stats = new StatsComponent(el, this.statsConfig()),
    }, {
      selector: 'options',
      keep: 'options',
      factory: (el) => this._options = new GameOptionsComponent(el, this.optionsConfig()),
    }, {
      selector: 'scores',
      keep: 'scores',
      factory: (el) => this._scores = new ScoreTableComponent(el, { entries: this._storage.scores(this._definition.id), highlight: null, showLevel: this.showsLevel }),
    }, {
      selector: 'touch',
      // A new layout (an option changed it, e.g. auto-fire) needs new controls.
      keep: JSON.stringify(touch),
      // Touch sends the same codes as the keyboard, through the same press/release path.
      factory: (el) => this._touch = new TouchControlsComponent(el, touch, {
        press: (code) => this.press(code),
        release: (code) => this.release(code),
      }),
    }];
    const preview = this.previewGrid();
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
    this._mobileQuery = window.matchMedia?.(MOBILE_QUERY) ?? null;
    this._mobileQuery?.addEventListener('change', this._onLayoutChange);
  }

  override onExit(): void {
    this.pause();
    document.removeEventListener('keydown', this._onKeydown);
    document.removeEventListener('keyup', this._onKeyup);
    document.removeEventListener('visibilitychange', this._onBlur);
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('pagehide', this._onBlur);
    this._mobileQuery?.removeEventListener('change', this._onLayoutChange);
    this._mobileQuery = null;
  }

  override documentTitle(): string {
    return this._game.title;
  }

  protected override generateTemplate(): Nutin.Template {
    return templateFn(this._game, this._game.kind === 'grid' && Boolean(this._game.preview), this.options.length > 0);
  }

  protected override onBeforeRender(): void {
    const active = document.activeElement;
    this._drawerFocus = active instanceof HTMLElement && this._drawer?.contains(active) ? active : null;
  }

  protected override onAfterRender(): void {
    this._panel = this.element.querySelector<HTMLElement>('.game__panel');
    this._next = this.element.querySelector<HTMLElement>('.game__next');
    if (this.isMobile) this.undockPanel();
    this.update();
  }

  protected override onBeforeDestroy(): void {
    // Overlays live in <body>: nothing removes them with the view.
    this._drawer?.remove();
    this._drawer = null;
  }

  private get isMobile(): boolean {
    return window.matchMedia?.(MOBILE_QUERY).matches ?? false;
  }

  private readonly _onLayoutChange = (event: MediaQueryListEvent): void => {
    if (event.matches) this.undockPanel();
    else this.dockPanel();
  };

  // Phones: the HUD panel goes into the drawer and Next above the board, so the board
  // gets the whole screen. Runs after each render, which builds both anew in the view.
  private undockPanel(): void {
    const panel = this._panel;
    if (!panel) return;
    const drawer = this.drawer();
    // The previous render's panel, emptied of its kept children.
    drawer.querySelectorAll(':scope > .game__panel').forEach((old) => old !== panel && old.remove());
    drawer.append(panel);
    if (this._next) this.element.querySelector('.game__stage')?.prepend(this._next);
    if (this._drawerFocus?.isConnected) this._drawerFocus.focus();
    this._drawerFocus = null;
  }

  // Back to the side of the board, as on desktop.
  private dockPanel(): void {
    const panel = this._panel;
    if (!panel) return;
    if (this._drawer) this._drawer.open = false;
    this.element.querySelector('.game__stage')?.after(panel);
    if (this._next) panel.prepend(this._next);
  }

  private drawer(): DrawerElement {
    if (this._drawer) return this._drawer;
    // Loaded on first use. Until it's defined, the element stays hidden (a11y.css) and
    // `open` is applied once it upgrades.
    import('a11y-elements/overlays/drawer').catch(() => {});
    const drawer = document.createElement('a11y-drawer') as DrawerElement;
    drawer.id = 'game-hud';
    drawer.setAttribute('edge', 'right');
    drawer.setAttribute('dialog-label', 'Game info');
    document.body.append(drawer);
    return this._drawer = drawer;
  }

  // The drawer covers the board: the game pauses first.
  private _openHud(): void {
    this.pause();
    this.update();
    this.drawer().open = true;
  }

  // The saved game if there is a usable one, else a new game with the remembered options.
  private openGame(): Game {
    const { id } = this._definition;
    const options = this.options;
    const save = this._storage.savedGame(id, this.saveVersion);
    if (save) {
      try {
        // Settings no longer valid (an option or choice removed): the state may not fit either.
        // An option added since the save takes its default.
        const settings = validSettings(save.settings, options);
        const outdated = options.some(({ key }) => key in save.settings && settings[key] !== save.settings[key]);
        if (outdated) throw new Error(`${id}'s saved options are outdated.`);
        const game = this._definition.create(settings);
        if (!game.restore) throw new Error(`${id} can't restore a save.`);
        game.restore(save.state);
        this._settings = settings;
        this._started = true;
        this._restored = true;
        return game;
      } catch {
        // Corrupt or outdated save: start over.
        this._storage.deleteSave(id);
      }
    }
    this._settings = this._storage.settings(id, options);
    return this._definition.create(this._settings);
  }

  private readonly _onKeydown = (event: KeyboardEvent): void => {
    if (isControlKey(event)) return;
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
    this._game.handleKey?.(code);
    this.update();
  }

  private release(code: string): void {
    this._game.handleKeyUp?.(code);
  }

  // Window blur, hidden tab (which doesn't always blur the window) or closed page.
  private readonly _onBlur = (): void => {
    this.pause();
    this.update();
  };

  // Every pause saves a game in progress.
  private pause(): void {
    this._loop.pause();
    this._game.releaseKeys?.();
    this._touch?.reset();
    this.save();
  }

  private save(): void {
    if (!this._started || this._game.isOver || !this._game.snapshot) return;
    this._storage.saveGame(this._definition.id, {
      version: this.saveVersion,
      settings: this._settings,
      state: this._game.snapshot(),
      savedAt: new Date().toISOString(),
    });
  }

  // One function for the options box, so its config stays the same between ticks.
  private readonly _setOption = (key: string, value: string): void => {
    this._settings = { ...this._settings, [key]: value };
    this._storage.saveSettings(this._definition.id, this._settings);
    this.startNewGame();
  };

  // Drops the saved game and builds a fresh one with the current options.
  private startNewGame(): void {
    this._loop.pause();
    this._game.releaseKeys?.();
    this._storage.deleteSave(this._definition.id);
    this._game = this._definition.create(this._settings);
    this._loop = new GameLoop(this._game, () => this.update());
    this._started = false;
    this._restored = false;
    this._finished = false;
    this._rank = null;
    this.render();
  }

  private togglePlay(): void {
    if (this._game.isOver) {
      this._game.reset();
      this._finished = false;
      this._rank = null;
    }
    this._started = true;
    this._restored = false;
    if (this._loop.isRunning) this.pause();
    else {
      this._loop.start();
      // Auto-fire is for touch screens only: keyboards fire as before.
      if (isTouchDevice()) this._touch?.resume();
    }
    this.update();
  }

  // Records the result once per game: the score table, and no save to come back to.
  private finish(): void {
    const { id } = this._definition;
    this._finished = true;
    this._storage.deleteSave(id);
    this._rank = this._storage.addScore(id, {
      score: this._game.score,
      level: this._game.level,
      date: new Date().toISOString(),
    });
    this._scores?.update({ entries: this._storage.scores(id), highlight: this._rank, showLevel: this.showsLevel });
  }

  private update(): void {
    if (this._game.isOver && !this._finished) this.finish();

    if (this._game.kind === 'canvas') {
      this._canvas?.paint(this._game);
    } else {
      this._board?.paint(this._game.cells());
      const preview = this.previewGrid();
      if (preview) this._preview?.paint(preview);
    }

    this._play?.update(this.playState());
    this._playToggle?.update({ running: this._loop.isRunning });
    this._stats?.update(this.statsConfig());
    this._options?.update(this.optionsConfig());
  }

  private previewGrid(): Grid | undefined {
    return this._game.kind === 'grid' ? this._game.preview?.() : undefined;
  }

  private get saveVersion(): number {
    return this._definition.saveVersion ?? SAVE_VERSION;
  }

  private get showsLevel(): boolean {
    return this._game.showsLevel !== false;
  }

  private get options(): GameOption[] {
    return this._definition.options ?? [];
  }

  private statsConfig(): StatsConfig {
    const values = { score: this._game.score, ...(this.showsLevel && { level: this._game.level }), ...this._game.stats?.() };
    return {
      items: Object.entries(values).map(([key, value]) => ({ key, label: key[0]!.toUpperCase() + key.slice(1), value })),
    };
  }

  private optionsConfig(): GameOptionsConfig {
    return {
      options: this.options,
      settings: this._settings,
      // Options only change between games: the whole box is locked while playing.
      locked: this._loop.isRunning,
      onChange: this._setOption,
    };
  }

  private playState(): PlayState {
    return {
      label: this.toggleLabel(),
      status: this.statusText(),
      over: this._game.isOver,
      // Only when there is a game to drop: Play again already covers a finished one.
      canStartOver: this._started && !this._game.isOver,
      running: this._loop.isRunning,
    };
  }

  private toggleLabel(): string {
    if (this._game.isOver) return '↻ Play again';
    if (this._loop.isRunning) return '⏸ Pause';
    return this._started ? '▶ Resume' : '▶ Start';
  }

  private statusText(): string {
    const touch = isTouchDevice();
    const action = touch ? 'tap ▶' : 'press Space';
    if (this._game.isOver) {
      const highScore = this._rank === null ? '' : ` - New high score!`;
      return `Game over${highScore}`;
    }
    if (this._loop.isRunning) return `Playing - ${action} to pause`;
    if (this._restored) return `${action} to resume`;
    if (this._started) return `Paused - ${action} to resume`;
    return touch ? 'Tap ▶ to start' : 'Press Space to start';
  }

  private _goHome(): void {
    Navigation.navigateTo('/');
  }
}
