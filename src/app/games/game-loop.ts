import type { Game } from './game.js';

// Longest step a canvas game gets: a stalled frame can't make the ball jump through bricks.
const MAX_FRAME_MS = 50;

// Drives a game: grid games with chained timeouts, reading speed() before every
// tick so a level-up takes effect immediately; canvas games on every animation frame.
export class GameLoop {
  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _frame: number | null = null;
  private _lastTick = 0;

  constructor(
    private readonly game: Game,
    private readonly onTick: () => void,
  ) {}

  get isRunning(): boolean {
    return this._timer !== null || this._frame !== null;
  }

  start(): void {
    if (this.isRunning || this.game.isOver) return;
    this._lastTick = Date.now();
    this.schedule();
  }

  pause(): void {
    if (this._timer !== null) clearTimeout(this._timer);
    if (this._frame !== null) cancelAnimationFrame(this._frame);
    this._timer = null;
    this._frame = null;
  }

  toggle(): void {
    if (this.isRunning) this.pause();
    else this.start();
  }

  private schedule(): void {
    if (this.game.kind === 'canvas') this._frame = requestAnimationFrame(() => this.step());
    else this._timer = setTimeout(() => this.step(), this.game.speed());
  }

  private step(): void {
    // Cleared first: if tick() throws, the loop is stopped rather than stuck "running".
    this._timer = null;
    this._frame = null;
    const now = Date.now();
    // Never negative: Date.now() goes back when the system clock is set back.
    const elapsed = Math.max(0, now - this._lastTick);
    this._lastTick = now;
    this.game.tick(this.game.kind === 'canvas' ? Math.min(elapsed, MAX_FRAME_MS) : elapsed);
    if (!this.game.isOver) this.schedule();
    this.onTick();
  }
}
