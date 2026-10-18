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
  action?: { label: string; code: string };
}

export const DEFAULT_TOUCH: TouchLayout = { directions: ['up', 'down', 'left', 'right'] };

// Contract between a game and the GameView: the game owns its state and rules,
// knows nothing about the DOM or timers.
export interface Game {
  readonly id: string;
  readonly title: string;
  readonly width: number;
  readonly height: number;
  readonly score: number;
  readonly level: number;
  readonly isOver: boolean;
  // False for games without levels (e.g. Pong): the HUD and score table leave the level out.
  readonly showsLevel?: boolean;

  // Ticks on every animation frame instead of every speed() ms (e.g. Arkanoid's physics).
  readonly realtime?: boolean;
  // Touch layout, when it differs from DEFAULT_TOUCH (4-way D-pad, no button).
  readonly touch?: TouchLayout;
  // Keys worth mentioning in the HUD (the ones beyond arrows and Space).
  readonly keyHints?: KeyHint[];

  reset(): void;
  // dt: ms elapsed since the previous tick (most grid games ignore it).
  tick(dt: number): void;
  // ms to wait before the next tick (unused by realtime games).
  speed(): number;
  // A game is drawn either as a grid of cells or on a canvas.
  cells?(): Grid;
  draw?(ctx: CanvasRenderingContext2D): void;
  handleKey?(code: string): void;
  // For keys held down, e.g. Arkanoid's paddle.
  handleKeyUp?(code: string): void;
  // Called when the game pauses, so no key stays held down.
  releaseKeys?(): void;
  // Saving: a JSON-safe copy of the game's state, and putting it back.
  snapshot?(): Snapshot;
  restore?(snapshot: Snapshot): void;
  // Small side grid, e.g. Tetris's next piece.
  preview?(): Grid;
  // Extra HUD values, e.g. { lines: 12 }.
  stats?(): Record<string, number>;
}

// A user-selectable setting shown in the HUD, e.g. Pacman's maze. The default is
// `defaultValue`, else the first choice.
export interface GameOption {
  key: string;
  label: string;
  choices: { value: string; label: string }[];
  defaultValue?: string;
}

export function defaultChoice({ choices, defaultValue }: GameOption): string {
  return defaultValue ?? choices[0]?.value ?? '';
}

export type Settings = Record<string, string>;

// What a route hands to the GameView: how to build the game from the chosen options.
export interface GameDefinition {
  // Same as the game's id: names its stored options, scores and save.
  id: string;
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

// A boolean setting, off unless defaultOn; read it with settings[key] === 'on'.
export function onOff(key: string, label: string, defaultOn = false): GameOption {
  const choices = [{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }];
  return { key, label, choices, defaultValue: defaultOn ? 'on' : 'off' };
}

// A game's saved state. Bump SAVE_VERSION whenever a game's saved fields change:
// older saves are then dropped instead of restored into the wrong shape.
export type Snapshot = Record<string, unknown>;
export const SAVE_VERSION = 7;

// Deep copies of the listed fields (private ones included: they are plain properties at runtime).
export function pickFields(game: object, fields: readonly string[]): Snapshot {
  const source = game as Record<string, unknown>;
  return Object.fromEntries(fields.map((field) => [field, structuredClone(source[field])]));
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
