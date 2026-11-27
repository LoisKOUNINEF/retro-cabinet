import { View, html, nutinIf } from '../../../../core/index.js';
import { GameOptionsComponent, type GameOptionsConfig } from '../../../components/game-options/game-options.component.js';
import { createGamesMenu } from '../../../components/games-menu/games-menu.js';
import { discoverBonus } from '../../../components/reward-notices/reward-notices.js';
import { PlayControlsComponent, type PlayState } from '../../../components/play-controls/play-controls.component.js';
import { ScoreTableComponent, type ScoreTableConfig } from '../../../components/score-table/score-table.component.js';
import { StatsComponent, type StatsConfig } from '../../../components/stats/stats.component.js';
import { isTouchDevice } from '../../../components/touch-controls/stick.js';
import { cryptoRandom, pick, type Random, type Settings } from '../../../games/game.js';
import { BONUS_GAMES, BONUS_PATH, bonusGamePath, bonusGameTitle } from '../../../games/bonus/registry.js';
import type { BoardComponent, BonusGame, BonusGameDefinition } from '../../../games/bonus/bonus-game.js';
import { PersistenceService } from '../../../services/persistence/persistence.service.js';
import { isControlKey } from '../../keyboard.js';
import type { DropdownElement } from 'a11y-elements/overlays/dropdown/element';

const templateFn = (id: string, title: string, hasStats: boolean, results: 'tally' | 'scores') => html`__TEMPLATE_PLACEHOLDER__`;

// One view for every bonus game, as the GameView is for the cabinet's: renders once,
// then updates its children (board, play, stats, results, options) after each move or tick.
// The game asks for ticks (nextTickIn): the view waits that long, ticks it, and asks again.
// Realtime games only tick while running: Start/Pause (or Space), paused when the page
// loses focus. Changing an option, or New round, builds a new round from the definition.
export class BonusGameView extends View {
  private readonly _storage = PersistenceService.getInstance();
  private _settings: Settings;
  private _game: BonusGame;
  private _board: BoardComponent<object> | null = null;
  private _play: PlayControlsComponent | null = null;
  private _stats: StatsComponent | null = null;
  private _tally: StatsComponent | null = null;
  private _scores: ScoreTableComponent | null = null;
  private _options: GameOptionsComponent | null = null;
  private _menu: DropdownElement | null = null;
  private _timer: ReturnType<typeof setTimeout> | null = null;
  // When the pending wait was set (Date.now()).
  private _timerSetAt = 0;
  // The ticks only run while the page is shown (between onEnter and onExit).
  private _shown = false;
  // Realtime games: the clock runs, and the round has been started (so it's paused, not new).
  private _running = false;
  private _started = false;
  // The round's result has been recorded; `_rank` is where its score placed, if it did.
  private _recorded = false;
  private _rank: number | null = null;

  constructor(private readonly _definition: BonusGameDefinition, private readonly _random: Random = cryptoRandom) {
    super({ viewName: _definition.id });
    this._settings = this._storage.settings(this.storageId, _definition.options);
    this._game = _definition.create(this._settings, _random);
  }

  private get storageId(): string {
    return this._definition.storageId ?? this._definition.id;
  }

  private get isRealtime(): boolean {
    return this._definition.realtime !== undefined;
  }

  // Whether the player's input goes to the game: always for turn-based games, while running for realtime ones.
  private get isActive(): boolean {
    return !this.isRealtime || this._running;
  }

  // The results key for the current settings, e.g. the difficulty.
  private get resultKey(): string {
    return this._definition.results.key(this._settings);
  }

  // Score tables are kept per key, each under its own id.
  private get scoresId(): string {
    return `${this.storageId}:${this.resultKey}`;
  }

  override registerChildren(): Nutin.ComponentConfig[] {
    const { board } = this._definition;
    return [{
      selector: 'board',
      keep: 'board',
      factory: (el) => this._board = board.create(el, board.config(this._game, this.isActive), this._onSelect),
    }, {
      selector: 'play',
      // New rules or key hints (another option, e.g. Code Breaker's difficulty) need new controls.
      keep: this.infoKey,
      factory: (el) => this._play = new PlayControlsComponent(el, this.playState(), {
        togglePlay: () => (this.isRealtime ? this.togglePlay() : this.newRound()),
        newGame: () => this.newRound(),
      }, { rules: this._game.rules, keyHints: this._game.keyHints, clickHints: this.clickHints }),
    }, {
      selector: 'stats',
      keep: 'stats',
      factory: (el) => this._stats = new StatsComponent(el, { items: this._game.stats?.() ?? [] }),
    }, {
      selector: 'tally',
      keep: 'tally',
      factory: (el) => this._tally = new StatsComponent(el, this.tallyConfig()),
    }, {
      selector: 'scores',
      keep: 'scores',
      factory: (el) => this._scores = new ScoreTableComponent(el, this.scoresConfig()),
    }, {
      selector: 'options',
      keep: 'options',
      factory: (el) => this._options = new GameOptionsComponent(el, this.optionsConfig()),
    }];
  }

  override onEnter(): void {
    discoverBonus();
    this._shown = true;
    document.addEventListener('keydown', this._onKeydown);
    if (this.isRealtime) {
      document.addEventListener('visibilitychange', this._onBlur);
      window.addEventListener('blur', this._onBlur);
      window.addEventListener('pagehide', this._onBlur);
    }
    this.schedule();
  }

  override onExit(): void {
    this._shown = false;
    this.pause();
    // A turn-based game's wait (the AI thinking) resumes on the next visit.
    this.cancelTick();
    document.removeEventListener('keydown', this._onKeydown);
    document.removeEventListener('visibilitychange', this._onBlur);
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('pagehide', this._onBlur);
  }

  override documentTitle(): string {
    return bonusGameTitle(this._definition.id);
  }

  protected override generateTemplate(): Nutin.Template {
    return templateFn(this._definition.id, this.documentTitle(), Boolean(this._game.stats), this._definition.results.kind);
  }

  protected override onAfterRender(): void {
    // A new render has a new button: the menu follows it.
    this.gamesMenu().anchorElement = this.element.querySelector<HTMLElement>('#game-menu-button');
    this.update();
  }

  protected override onBeforeDestroy(): void {
    this.cancelTick();
    // Overlays live in <body>: nothing removes them with the view.
    this._menu?.remove();
    this._menu = null;
  }

  private readonly _onKeydown = (event: KeyboardEvent): void => {
    if (isControlKey(event)) return;
    const { code } = event;
    // Realtime games: Space starts and pauses, as in the cabinet's games.
    if (this.isRealtime && code === 'Space') {
      event.preventDefault();
      return this.togglePlay();
    }
    // A finished round: Enter (or Space) starts the next one.
    if (this._game.isOver && (code === 'Enter' || code === 'Space')) {
      event.preventDefault();
      return this.isRealtime ? this.togglePlay() : this.newRound();
    }
    if (!this.isActive || !this._game.handleKey(code)) return;
    event.preventDefault();
    this.afterAction();
  };

  // Passed to the board once: unchanged, so its cells stay equal and are kept.
  private readonly _onSelect = (index: number, action?: string): void => {
    if (!this.isActive) return;
    this._game.select(index, action);
    this.afterAction();
  };

  // Window blur, hidden tab or closed page: a realtime game pauses.
  private readonly _onBlur = (): void => this.pause();

  private newRound(): void {
    this.cancelTick();
    const hints = this.infoKey;
    this._game = this._definition.create(this._settings, this._random);
    this._running = false;
    this._started = false;
    this._recorded = false;
    this._rank = null;
    // Other options may mean other rules or keys: the Play controls are rebuilt with them.
    if (this.infoKey !== hints) this.render();
    this.afterAction();
  }

  private get infoKey(): string {
    return JSON.stringify([this._game.rules, this._game.keyHints ?? null, this.clickHints]);
  }

  private get clickHints(): string[] {
    const { mouse, touch } = this._game.clickHints;
    return isTouchDevice() ? touch : mouse;
  }

  // Realtime games: start, pause or resume; a finished round starts over.
  private togglePlay(): void {
    if (this._game.isOver) this.newRound();
    if (this._running) return this.pause();
    this._running = true;
    this._started = true;
    this.afterAction();
  }

  private pause(): void {
    if (!this._running) return;
    this._running = false;
    this.cancelTick();
    this.update();
  }

  // After the player or a tick changed the game: results, next tick, children.
  private afterAction(): void {
    if (this._game.isOver) this._running = false;
    this.record();
    this.schedule();
    this.update();
  }

  // Waits for whatever the game asks to wait for (the AI thinking...), replacing any earlier wait.
  // The time already spent on a replaced wait is ticked first: a running clock loses none of it.
  private schedule(): void {
    if (this._timer !== null) {
      const waited = Date.now() - this._timerSetAt;
      this.cancelTick();
      if (waited > 0) this._game.tick(waited);
    }
    const delay = this._game.nextTickIn();
    if (!this._shown || !this.isActive || delay === null) return;
    this._timerSetAt = Date.now();
    this._timer = setTimeout(() => {
      this._timer = null;
      this._game.tick(delay);
      this.afterAction();
    }, delay);
  }

  private cancelTick(): void {
    if (this._timer !== null) clearTimeout(this._timer);
    this._timer = null;
  }

  // Records the round once, when it ends: its tally (and best), or its score.
  private record(): void {
    if (!this._game.isOver || this._recorded) return;
    this._recorded = true;
    const { results } = this._definition;
    if (results.kind === 'scores') {
      const { score = 0, level = 1 } = this._game;
      this._rank = this._storage.addScore(this.scoresId, { score, level, date: new Date().toISOString() });
      return;
    }
    const { outcome } = this._game;
    if (!outcome) return;
    this._storage.recordResult(this.storageId, this.resultKey, outcome);
    if (results.best && (outcome === 'wins' || results.best.everyRound)) this._storage.recordBest(this.storageId, this.resultKey, results.best.score(this._game));
  }

  // One function for the options box, so its config stays the same between moves.
  private readonly _setOption = (key: string, value: string): void => {
    this._settings = { ...this._settings, [key]: value };
    this._storage.saveSettings(this.storageId, this._settings);
    this.newRound();
  };

  // The bonus hub, each bonus game, and a random other bonus game: no way back to the main cabinet's.
  private gamesMenu(): DropdownElement {
    return this._menu ??= createGamesMenu({
      home: [{ label: 'All bonus games', path: BONUS_PATH }],
      games: BONUS_GAMES.map(({ id, title }) => ({ label: title, path: bonusGamePath(id) })),
      currentPath: bonusGamePath(this._definition.id),
      randomPath: () => {
        const others = BONUS_GAMES.filter(({ id }) => id !== this._definition.id);
        // While there is a single bonus game, Random has nowhere else to go but the hub.
        return others.length ? bonusGamePath(pick(others, cryptoRandom).id) : BONUS_PATH;
      },
      // The menu covers the board: a realtime game pauses first.
      onOpen: () => this.pause(),
    });
  }

  private update(): void {
    this._board?.update(this._definition.board.config(this._game, this.isActive));
    this._play?.update(this.playState());
    this._stats?.update({ items: this._game.stats?.() ?? [] });
    this._tally?.update(this.tallyConfig());
    this._scores?.update(this.scoresConfig());
    this._options?.update(this.optionsConfig());
  }

  private playState(): PlayState {
    if (!this.isRealtime) return { label: 'New round', status: this._game.status, over: false, canStartOver: false, running: false };
    const over = this._game.isOver;
    return {
      label: over ? '↻ Play again' : this._running ? '⏸ Pause' : this._started ? '▶ Resume' : '▶ Start',
      status: this.realtimeStatus(),
      over,
      // Only when there is a round to drop: Play again already covers a finished one.
      canStartOver: this._started && !over,
      running: this._running,
    };
  }

  private realtimeStatus(): string {
    const action = isTouchDevice() ? 'tap ▶' : 'press Space';
    if (this._game.isOver) return `${this._game.status}${this._rank === null ? '' : ' New high score!'}`;
    if (this._running) return this._game.status;
    if (this._started) return `Paused - ${action} to resume`;
    return isTouchDevice() ? 'Tap ▶ to start' : 'Press Space to start';
  }

  // The results under the current key, and the best round if kept.
  private tallyConfig(): StatsConfig {
    const { results } = this._definition;
    if (results.kind !== 'tally') return { items: [] };
    const { draws: showsDraws = true, best, labels = { wins: 'Wins', losses: 'Losses' } } = results;
    const hasDraws = typeof showsDraws === 'function' ? showsDraws(this._settings) : showsDraws;
    const { wins, draws, losses } = this._storage.tally(this.storageId, this.resultKey);
    return {
      items: [
        { key: 'wins', label: labels.wins, value: wins },
        ...(hasDraws ? [{ key: 'draws', label: 'Draws', value: draws }] : []),
        { key: 'losses', label: labels.losses, value: losses },
        ...(best ? [{ key: 'best', label: best.label, value: this._storage.best(this.storageId, this.resultKey) ?? '-' }] : []),
      ],
    };
  }

  private scoresConfig(): ScoreTableConfig {
    return { entries: this._storage.scores(this.scoresId), highlight: this._rank };
  }

  private optionsConfig(): GameOptionsConfig {
    return {
      options: this._definition.options,
      settings: this._settings,
      // Realtime games: options only change between rounds, the box is locked while running.
      locked: this.isRealtime && this._running,
      onChange: this._setOption,
    };
  }
}
