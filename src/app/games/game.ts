// A cell holds a CSS modifier (e.g. 'tetris-I', 'snake-head'), or null when empty.
export type Cell = string | null;
export type Grid = Cell[][];
export type Random = () => number;

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export interface Velocity {
  vx: number;
  vy: number;
}

// Same velocity direction, new speed.
export function withSpeed({ vx, vy }: Velocity, speed: number): Velocity {
  const current = Math.hypot(vx, vy) || 1;
  return { vx: (vx / current) * speed, vy: (vy / current) * speed };
}

// Turns a velocity by `angle` radians.
export function rotate({ vx, vy }: Velocity, angle: number): Velocity {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { vx: vx * cos - vy * sin, vy: vx * sin + vy * cos };
}

// A position on a field that wraps around: always within [0, size).
export const wrap = (value: number, size: number) => ((value % size) + size) % size;

// The fire keys: Z and W. KeyboardEvent.code names *physical* keys by their QWERTY position,
// and AZERTY swaps Z and W, so accepting both codes makes both letters fire on either layout.
export const FIRE_KEYS = ['KeyZ', 'KeyW'];

export const isFireKey = (code: string) => FIRE_KEYS.includes(code);

// A line of the HUD's controls hint, e.g. { action: 'Fire', codes: ['ArrowUp', ...FIRE_KEYS] }.
export interface KeyHint {
  action: string;
  codes: string[];
}

export const UP: Point = { x: 0, y: -1 };
export const DOWN: Point = { x: 0, y: 1 };
export const LEFT: Point = { x: -1, y: 0 };
export const RIGHT: Point = { x: 1, y: 0 };

// KeyboardEvent.code → direction.
export const ARROW_DIRECTIONS: Record<string, Point | undefined> = { ArrowUp: UP, ArrowDown: DOWN, ArrowLeft: LEFT, ArrowRight: RIGHT };

export const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

export const directionName = ({ x, y }: Point) => y < 0 ? 'up' : y > 0 ? 'down' : x < 0 ? 'left' : 'right';

// Touch controls: which way the D-pad or virtual stick points, and the right-thumb button.
// They send the same key codes as the keyboard, so games need no touch-specific rules.
export type StickDirection = 'up' | 'down' | 'left' | 'right';

export interface TouchLayout {
  // 'cross' (default): a D-pad of buttons, one press per tap. 'stick': a joystick,
  // for steering (Snake).
  pad?: 'stick' | 'cross';
  directions: StickDirection[];
  // Re-sends the held direction every repeatMs, on either pad (e.g. Tetris sliding a piece).
  repeatMs?: number;
  // onPad: the button takes the D-pad's empty up slot (Tetris's Rotate) instead of the right thumb.
  action?: { label: string; code: string; onPad?: boolean };
  // The action key stays pressed while playing; holding the button lets go of it (cease fire).
  autoFire?: boolean;
}

export const DEFAULT_TOUCH: TouchLayout = { directions: ['up', 'down', 'left', 'right'] };

// Contract between a game and the GameView: the game owns its state and rules,
// knows nothing about the DOM or timers. It is either a GridGame or a CanvasGame.
interface BaseGame {
  readonly id: string;
  readonly title: string;
  readonly width: number;
  readonly height: number;
  readonly score: number;
  readonly level: number;
  readonly isOver: boolean;
  // False for games without levels (e.g. Pong): the HUD and score table leave the level out.
  readonly showsLevel?: boolean;

  // Touch layout, when it differs from DEFAULT_TOUCH (4-way D-pad, no button).
  readonly touch?: TouchLayout;
  // Keys worth mentioning in the HUD (the ones beyond arrows and Space).
  readonly keyHints?: KeyHint[];

  reset(): void;
  // dt: ms elapsed since the previous tick (most grid games ignore it).
  tick(dt: number): void;
  handleKey?(code: string): void;
  // For keys held down, e.g. Arkanoid's paddle.
  handleKeyUp?(code: string): void;
  // Called when the game pauses, so no key stays held down.
  releaseKeys?(): void;
  // Saving: a JSON-safe copy of the game's state, and putting it back.
  snapshot?(): Snapshot;
  restore?(snapshot: Snapshot): void;
  // Extra HUD values, e.g. { lines: 12 }.
  stats?(): Record<string, number>;
}

// Drawn as a grid of cells, ticking every speed() ms (e.g. Tetris).
export interface GridGame extends BaseGame {
  readonly kind: 'grid';
  // ms to wait before the next tick, read again before every tick.
  speed(): number;
  cells(): Grid;
  // Small side grid, e.g. Tetris's next piece.
  preview?(): Grid;
}

// Drawn on a canvas, ticking on every animation frame (e.g. Arkanoid's physics).
export interface CanvasGame extends BaseGame {
  readonly kind: 'canvas';
  draw(ctx: CanvasRenderingContext2D): void;
}

export type Game = GridGame | CanvasGame;

// A user-selectable setting shown in the HUD, e.g. Pacman's maze. The default is
// `defaultValue`, else the first choice. T narrows the values, read back with choiceOf().
export interface GameOption<T extends string = string> {
  key: string;
  label: string;
  choices: readonly { value: T; label: string }[];
  defaultValue?: T;
}

export function defaultChoice<T extends string>({ choices, defaultValue }: GameOption<T>): T | '' {
  return defaultValue ?? choices[0]?.value ?? '';
}

// The option's value in `settings`, typed; its default when missing or not one of its choices.
export function choiceOf<T extends string>(settings: Settings, option: GameOption<T>): T {
  const chosen = option.choices.find((choice) => choice.value === settings[option.key]);
  return chosen?.value ?? option.defaultValue ?? option.choices[0]!.value;
}

export type Settings = Record<string, string>;

// What a route hands to the GameView: how to build the game from the chosen options.
export interface GameDefinition {
  // Same as the game's id: names its stored options, scores and save.
  id: string;
  // Bump whenever this game's saved fields change: its older saves are then dropped
  // instead of restored into the wrong shape. Defaults to SAVE_VERSION.
  saveVersion?: number;
  options?: GameOption[];
  create(settings: Settings): Game;
}

export function defaultSettings(options: GameOption[] = []): Settings {
  return Object.fromEntries(options.map((option) => [option.key, defaultChoice(option)]));
}

const MAX_START_LEVEL = 10;

// "Select level": the game starts there and keeps levelling up.
export const levelOption: GameOption = {
  key: 'level',
  label: 'Level',
  choices: Array.from({ length: MAX_START_LEVEL }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
};

export function levelFrom(settings: Settings): number {
  const level = Math.floor(Number(settings.level));
  return Number.isFinite(level) ? Math.min(Math.max(level, 1), MAX_START_LEVEL) : 1;
}

const LIVES_CHOICES = [3, 6, 9, 99];

// "Lives": the game's original count (its arcade cabinet's default), or a fixed one other than it.
export function livesOption(original: number): GameOption {
  return {
    key: 'lives',
    label: 'Lives',
    choices: [
      { value: 'original', label: `Original (${original})` },
      ...LIVES_CHOICES.filter((n) => n !== original).map((n) => ({ value: String(n), label: String(n) })),
    ],
  };
}

// The chosen lives; `original` when missing, 'original' or not one of the choices.
export function livesFrom(settings: Settings, original: number): number {
  const lives = Number(settings.lives);
  return LIVES_CHOICES.includes(lives) ? lives : original;
}

export type OnOff = GameOption<'on' | 'off'>;

// A boolean setting, off unless defaultOn; read it with isOn().
export function onOff(key: string, label: string, defaultOn = false): OnOff {
  return { key, label, choices: [{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }], defaultValue: defaultOn ? 'on' : 'off' };
}

export const isOn = (settings: Settings, option: OnOff) => choiceOf(settings, option) === 'on';

// Shooters on touch screens: the action button fires on its own, held to cease fire (TouchLayout.autoFire).
export const autoFireOption = onOff('autoFire', 'Auto-fire');

// A game's saved state; versioned per game (GameDefinition.saveVersion).
export type Snapshot = Record<string, unknown>;
// The version every game's saves started at. Bump a game's own saveVersion, not this.
export const SAVE_VERSION = 7;

// Deep copies of the listed fields (private ones included: they are plain properties at runtime).
// A field the game doesn't have is a typo or a rename: it throws rather than save nothing.
export function pickFields(game: object, fields: readonly string[]): Snapshot {
  const source = game as Record<string, unknown>;
  return Object.fromEntries(fields.map((field) => {
    if (!(field in source)) throw new Error(`Can't save "${field}": the game has no such field.`);
    return [field, structuredClone(source[field])];
  }));
}

export function applyFields(game: object, snapshot: Snapshot, fields: readonly string[]): void {
  const target = game as Record<string, unknown>;
  fields.forEach((field) => {
    if (!(field in snapshot)) throw new Error(`Saved game is missing "${field}".`);
    target[field] = structuredClone(snapshot[field]);
  });
}

// Each level is 20% faster than the base.
export function levelSpeed(base: number, level: number): number {
  return base / (1 + (level - 1) / 5);
}

export function emptyGrid(width: number, height: number): Grid {
  return Array.from({ length: height }, () => Array<Cell>(width).fill(null));
}

// undefined when (x, y) is outside the grid.
export function cellAt(grid: Grid, x: number, y: number): Cell | undefined {
  return grid[y]?.[x];
}

// Writes outside the grid are ignored.
export function setCell(grid: Grid, x: number, y: number, value: Cell): void {
  const row = grid[y];
  if (row && x >= 0 && x < row.length) row[x] = value;
}

// Unpredictable, unlike Math.random: the browser's cryptographic generator, in [0, 1).
export const cryptoRandom: Random = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;

export function pick<T>(items: readonly T[], random: Random): T {
  return items[Math.floor(random() * items.length)]!;
}

// A shuffled copy (Fisher–Yates); the input is left as is.
export function shuffle<T>(items: readonly T[], random: Random = cryptoRandom): T[] {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j]!, array[i]!];
  }
  return array;
}

export function randomFreeCell(grid: Grid, random: Random): Point | null {
  const free: Point[] = [];
  grid.forEach((row, y) => row.forEach((cell, x) => {
    if (cell === null) free.push({ x, y });
  }));
  return free.length ? pick(free, random) : null;
}
