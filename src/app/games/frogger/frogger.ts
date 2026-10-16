import {
  applyFields, ARROW_DIRECTIONS, emptyGrid, levelFrom, levelOption, onOff, pickFields, setCell,
  type Game, type GameDefinition, type Grid, type Point, type Snapshot, type TouchLayout,
} from '../game.js';
import {
  DIVE_CYCLE, DIVE_UNDER_AT, DIVE_WARNING_AT, HEIGHT, HOME_COLUMNS, HOME_ROW, LANES, START_ROW, WIDTH,
  isRiver, type Lane,
} from './lanes.js';

const BASE_SPEED = 50;
const LIVES = 3;
const STEP_POINTS = 10;
const HOME_POINTS = 50;
const LEVEL_POINTS = 1000;
// The arcade's 60 seconds per frog.
const TIME_LIMIT = 60_000;

export interface FroggerOptions {
  firstLevel?: number;
  // Each frog has TIME_LIMIT ms to reach a home.
  timeLimit?: boolean;
  // '~' turtles dive on a cycle, drowning a frog riding them.
  divingTurtles?: boolean;
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

// What a save keeps (held keys and the random source never are).
const SAVED_FIELDS = ['frog', 'homes', 'offsets', 'timeLeft', 'score', 'level', 'lives', 'isOver', '_ticks', '_bestRow'];

export class Frogger implements Game {
  readonly id = 'frogger';
  readonly title = 'Frogger';
  readonly width = WIDTH;
  readonly height = HEIGHT;
  // One hop per tap: a D-pad suits repeated hops better than a stick.
  readonly touch: TouchLayout = { pad: 'cross', directions: ['up', 'down', 'left', 'right'] };

  score = 0;
  level = 1;
  lives = LIVES;
  isOver = false;
  frog: Point = { x: 0, y: 0 };
  homes: boolean[] = [];
  // How far each lane has shifted, in cells (same order as LANES).
  offsets: number[] = [];
  // ms left for the current frog (only counts down with the time limit on).
  timeLeft = TIME_LIMIT;
  private _ticks = 0;
  // Furthest row reached by this frog: only new rows score.
  private _bestRow = START_ROW;

  constructor(private readonly options: FroggerOptions = {}) {
    this.reset();
  }

  reset(): void {
    this.score = 0;
    this.level = this.options.firstLevel ?? 1;
    this.lives = LIVES;
    this.isOver = false;
    this.homes = HOME_COLUMNS.map(() => false);
    this.offsets = LANES.map(() => 0);
    this._ticks = 0;
    this.resetFrog();
  }

  tick(dt: number): void {
    if (this.isOver) return;
    if (this.options.timeLimit) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) return this.die();
    }
    this._ticks += 1;
    LANES.forEach((lane, i) => {
      if (this._ticks % lane.period !== 0) return;
      this.offsets[i] = (this.offsets[i] ?? 0) + lane.direction;
      // Logs and turtles carry the frog along.
      if (lane.row === this.frog.y && isRiver(lane.kind)) this.frog.x += lane.direction;
    });
    this.checkFrog();
  }

  speed(): number {
    // Each level is 10% faster.
    return BASE_SPEED / (1 + (this.level - 1) / 10);
  }

  snapshot(): Snapshot {
    return pickFields(this, SAVED_FIELDS);
  }

  restore(snapshot: Snapshot): void {
    applyFields(this, snapshot, SAVED_FIELDS);
  }

  handleKey(code: string): void {
    const direction = ARROW_DIRECTIONS[code];
    if (!direction || this.isOver) return;

    const x = Math.min(Math.max(this.frog.x + direction.x, 0), WIDTH - 1);
    const y = Math.min(Math.max(this.frog.y + direction.y, 0), START_ROW);
    this.frog = { x, y };

    if (y === HOME_ROW) return this.reachHome(x);
    if (y < this._bestRow) {
      this._bestRow = y;
      this.score += STEP_POINTS;
    }
    this.checkFrog();
  }

  cells(): Grid {
    const grid = emptyGrid(WIDTH, HEIGHT);
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) setCell(grid, x, y, this.terrain(x, y));
    }
    LANES.forEach((lane, i) => {
      for (let x = 0; x < WIDTH; x++) {
        if (!this.isOccupied(lane, i, x)) continue;
        const warning = this.isDiving(lane, i, x) && this.divePhase() >= DIVE_WARNING_AT;
        setCell(grid, x, lane.row, warning ? 'turtle-diving' : lane.kind);
      }
    });
    setCell(grid, this.frog.x, this.frog.y, 'frog');
    return grid;
  }

  stats(): Record<string, number> {
    if (!this.options.timeLimit) return { lives: this.lives };
    return { lives: this.lives, time: Math.max(0, Math.ceil(this.timeLeft / 1000)) };
  }

  // Lane i's pattern char at column x, once shifted by the lane's offset.
  private charAt(lane: Lane, i: number, x: number): string | undefined {
    return lane.pattern[mod(x - (this.offsets[i] ?? 0), WIDTH)];
  }

  // Is there something (log, turtle above water, vehicle) at column x?
  private isOccupied(lane: Lane, i: number, x: number): boolean {
    const char = this.charAt(lane, i, x);
    if (char === '~') return !this.isDiving(lane, i, x) || this.divePhase() < DIVE_UNDER_AT;
    return char === '=';
  }

  // A '~' turtle with the diving option on.
  private isDiving(lane: Lane, i: number, x: number): boolean {
    return Boolean(this.options.divingTurtles) && this.charAt(lane, i, x) === '~';
  }

  private divePhase(): number {
    return this._ticks % DIVE_CYCLE;
  }

  private terrain(x: number, y: number): string {
    if (y === HOME_ROW) {
      const home = HOME_COLUMNS.indexOf(x);
      if (home === -1) return 'hedge';
      return this.homes[home] ? 'home-filled' : 'home';
    }
    const lane = LANES.find((l) => l.row === y);
    if (!lane) return 'grass';
    return isRiver(lane.kind) ? 'water' : 'road';
  }

  // Dies when carried off the board, in the water, or under a vehicle.
  private checkFrog(): void {
    const { x, y } = this.frog;
    if (x < 0 || x >= WIDTH) return this.die();

    const i = LANES.findIndex((lane) => lane.row === y);
    const lane = LANES[i];
    if (!lane) return;
    if (this.isOccupied(lane, i, x) !== isRiver(lane.kind)) this.die();
  }

  private reachHome(x: number): void {
    const home = HOME_COLUMNS.indexOf(x);
    if (home === -1 || this.homes[home]) return this.die();

    this.homes[home] = true;
    this.score += HOME_POINTS;
    if (this.homes.every(Boolean)) {
      this.score += LEVEL_POINTS;
      this.level += 1;
      this.homes = HOME_COLUMNS.map(() => false);
    }
    this.resetFrog();
  }

  private die(): void {
    this.lives -= 1;
    if (this.lives === 0) this.isOver = true;
    this.resetFrog();
  }

  private resetFrog(): void {
    this.frog = { x: Math.floor(WIDTH / 2), y: START_ROW };
    this._bestRow = START_ROW;
    this.timeLeft = TIME_LIMIT;
  }
}

export const froggerGame: GameDefinition = {
  id: 'frogger',
  options: [levelOption, onOff('time', 'Time limit'), onOff('turtles', 'Diving turtles')],
  create: (settings) => new Frogger({
    firstLevel: levelFrom(settings),
    timeLimit: settings.time === 'on',
    divingTurtles: settings.turtles === 'on',
  }),
};
