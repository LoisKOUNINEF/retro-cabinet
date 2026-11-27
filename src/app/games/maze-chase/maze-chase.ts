import {
  applyFields, choiceOf, cryptoRandom, ARROW_DIRECTIONS, directionName, isOn, LEFT, levelFrom, levelOption, livesFrom, livesOption, onOff,
  pickFields, quarterTurn, samePoint, SAVE_VERSION, setCell,
  type GridGame, type GameDefinition, type GameOption, type Grid, type MouseButton, type Point, type Random, type Snapshot, type TouchLayout,
  ARROW_CODES,
  type KeyHint,
} from '../game.js';
import { chaseTarget, chooseDirection, reverse, scatterTarget } from './ghosts.js';
import {
  ARCADE, COMPACT, GHOST_NAMES, isTunnel, isWalkable, parseMaze, stepFrom, type GhostName, type Maze,
} from './mazes.js';

// Values from the original arcade game.

// One tick is one tile at the arcade's 100% speed (75.76 px/s, 8px tiles).
export const TICK_MS = 106;
// How long a click's turn waits for an opening (about 4 tiles).
export const CLICK_TURN_MS = 500;
const LIVES = 3;
const EXTRA_LIFE_AT = 10_000;
const PELLET_POINTS = 10;
const POWER_POINTS = 50;
// Doubles with each ghost eaten on the same power pellet: 200, 400, 800, 1600.
const GHOST_POINTS = 200;
// The runner stops for 1 frame per pellet, 3 per power pellet (one frame is ~16% of a tile).
const PELLET_PAUSE = 16;
const POWER_PAUSE = 48;
const EYES_SPEED = 150;
// Each flash at the end of frightened time.
const FLASH_MS = 400;

// Bonus prizes (when the option is on): one appears below the ghost house after 70 and 170
// of the arcade maze's 244 pellets are eaten (the same share of a smaller maze), and stays
// 9⅓ to 10 s. Levels 1, 2, 3-4, 5-6, 7-8, 9-10, 11-12, 13+.
export type PrizeKind = 'cherry' | 'strawberry' | 'orange' | 'apple' | 'melon' | 'ship' | 'bell' | 'key';

export const PRIZES: { kind: PrizeKind; points: number }[] = [
  { kind: 'cherry', points: 100 },
  { kind: 'strawberry', points: 300 },
  { kind: 'orange', points: 500 },
  { kind: 'apple', points: 700 },
  { kind: 'melon', points: 1000 },
  { kind: 'ship', points: 2000 },
  { kind: 'bell', points: 3000 },
  { kind: 'key', points: 5000 },
];

export const prizeFor = (level: number) => PRIZES[level <= 2 ? level - 1 : Math.min(Math.floor((level + 1) / 2), 7)]!;

const PRIZE_AT = [70 / 244, 170 / 244];
const PRIZE_MIN_MS = 9333;
const PRIZE_MAX_MS = 10_000;

export interface Prize {
  kind: PrizeKind;
  // Time left before it goes.
  ms: number;
}

// Speeds in % of 100%: each tick, a mover adds its speed to its budget and takes a step per 100.
interface Speeds {
  runner: number;
  runnerFrightened: number;
  ghost: number;
  ghostFrightened: number;
  tunnel: number;
  // The chaser's two "rush" speed-ups, as the maze empties.
  rush: [number, number];
}

// Levels 1, 2-4, 5-20, 21+.
const SPEEDS: Speeds[] = [
  { runner: 80, runnerFrightened: 90, ghost: 75, ghostFrightened: 50, tunnel: 40, rush: [80, 85] },
  { runner: 90, runnerFrightened: 95, ghost: 85, ghostFrightened: 55, tunnel: 45, rush: [90, 95] },
  { runner: 100, runnerFrightened: 100, ghost: 95, ghostFrightened: 60, tunnel: 50, rush: [100, 105] },
  { runner: 90, runnerFrightened: 90, ghost: 95, ghostFrightened: 60, tunnel: 50, rush: [100, 105] },
];

const speedsFor = (level: number): Speeds => SPEEDS[level === 1 ? 0 : level <= 4 ? 1 : level <= 20 ? 2 : 3]!;

// Pellets left when the chaser rushes (1, then 2) (half as many), by level.
function rushPellets(level: number): number {
  if (level === 1) return 20;
  if (level === 2) return 30;
  if (level <= 5) return 40;
  if (level <= 8) return 50;
  if (level <= 11) return 60;
  if (level <= 14) return 80;
  if (level <= 18) return 100;
  return 120;
}

// ms in each mode, alternating scatter, chase, scatter… then chase forever.
// Levels 1, 2-4, 5+.
const MODE_SCHEDULES = [
  [7000, 20_000, 7000, 20_000, 5000, 20_000, 5000, Infinity],
  [7000, 20_000, 7000, 20_000, 5000, 1_033_000, 17, Infinity],
  [5000, 20_000, 5000, 20_000, 5000, 1_037_000, 17, Infinity],
];

const scheduleFor = (level: number) => MODE_SCHEDULES[level === 1 ? 0 : level <= 4 ? 1 : 2]!;

// Frightened seconds and flashes, by level (none after the table).
const FRIGHT_SECONDS = [6, 5, 4, 3, 2, 5, 2, 2, 1, 5, 2, 1, 1, 3, 1, 1, 0, 1];
const FLASHES = [5, 5, 5, 5, 5, 5, 5, 5, 3, 5, 5, 3, 3, 5, 3, 3, 0, 3];

// Pellets eaten before each ghost leaves the house: levels 1, 2, 3+, and after a lost life.
const RELEASE_PELLETS: Record<'ambusher' | 'flanker' | 'wanderer', number>[] = [
  { ambusher: 0, flanker: 30, wanderer: 60 },
  { ambusher: 0, flanker: 0, wanderer: 50 },
  { ambusher: 0, flanker: 0, wanderer: 0 },
];
const RELEASE_AFTER_DEATH = { ambusher: 7, flanker: 17, wanderer: 32 };
// Without a pellet eaten for this long, the next ghost comes out anyway (3 s from level 5).
const idleReleaseMs = (level: number) => (level < 5 ? 4000 : 3000);

export interface Ghost {
  name: GhostName;
  position: Point;
  direction: Point;
  // In the house, roaming the maze, or eaten (eyes heading back to the house).
  state: 'house' | 'active' | 'eyes';
  frightened: boolean;
  // Speed points towards the next step.
  budget?: number;
}

export interface RunnerMover {
  position: Point;
  direction: Point;
  budget?: number;
}

// What a save keeps (held keys and the random source never are).
const SAVED_FIELDS = [
  'pellets', 'runner', 'wanted', 'wantedMs', 'ghosts', 'frightenedMs', 'prize', 'score', 'level', 'lives', 'isOver', 'waiting',
  '_modeIndex', '_modeMs', '_ghostsEaten', '_pelletsEaten', '_idleMs', '_lostLife', '_extraLife',
];

export interface MazeChaseOptions {
  // The maze, as rows of characters (see mazes.ts).
  layout?: string[];
  firstLevel?: number;
  lives?: number;
  prizes?: boolean;
  random?: Random;
}

export class MazeChase implements GridGame {
  get rules(): string[] {
    return [
      'Goal: eat every pellet without being caught.',
      'A power pellet makes the ghosts edible for a while: 200, 400, 800, then 1600.',
      'A ghost catches you: you lose a life. Extra life at 10,000.',
      ...(this.prizes ? ['A prize appears twice per maze, for bonus points.'] : []),
      'A cleared maze raises the level.',
    ];
  }

  readonly keyHints: KeyHint[] = [{ action: 'Move', codes: ARROW_CODES }];
  readonly kind = 'grid';
  readonly id = 'maze-chase';
  readonly title = 'Maze Chase';
  readonly touch: TouchLayout = { pad: 'stick', directions: ['up', 'down', 'left', 'right'] };
  readonly mouseHint = 'Mouse: left click turns left, right click turns right (twice turns back)';
  readonly maze: Maze;
  readonly width: number;
  readonly height: number;

  score = 0;
  level = 1;
  lives = LIVES;
  isOver = false;
  pellets: (string | null)[][] = [];
  runner: RunnerMover = { position: { x: 0, y: 0 }, direction: LEFT };
  // Last arrow pressed, taken at the first open turn.
  wanted: Point | null = null;
  // A click's turn only waits this long (ms left); an arrow's waits for good (null).
  wantedMs: number | null = null;
  ghosts: Ghost[] = [];
  frightenedMs = 0;
  prize: Prize | null = null;
  // Before the first arrow (at start and after a lost life): everything holds still.
  waiting = true;
  private _modeIndex = 0;
  private _modeMs = 0;
  private _ghostsEaten = 0;
  // Pellets eaten since the level started or a life was lost, and ms since the last one.
  private _pelletsEaten = 0;
  private _idleMs = 0;
  private _lostLife = false;
  private _extraLife = false;

  private readonly random: Random;
  private readonly firstLevel: number;
  private readonly startLives: number;
  private readonly prizes: boolean;
  private readonly totalPellets: number;
  // Pellets eaten on a level when each prize appears.
  private readonly prizeAt: number[];

  constructor({
    layout = COMPACT, firstLevel = 1, lives = LIVES, prizes = false, random = cryptoRandom,
  }: MazeChaseOptions = {}) {
    this.random = random;
    this.firstLevel = firstLevel;
    this.startLives = lives;
    this.prizes = prizes;
    this.maze = parseMaze(layout);
    this.totalPellets = this.maze.pellets.flat().filter(Boolean).length;
    this.prizeAt = PRIZE_AT.map((share) => Math.round(this.totalPellets * share));
    this.width = this.maze.width;
    this.height = this.maze.height;
    this.reset();
  }

  get mode(): 'scatter' | 'chase' {
    return this._modeIndex % 2 === 0 ? 'scatter' : 'chase';
  }

  get pelletsLeft(): number {
    return this.pellets.flat().filter(Boolean).length;
  }

  // 0, then 1 and 2 as the chaser speeds up near the end of the maze.
  get rush(): 0 | 1 | 2 {
    const pellets = rushPellets(this.level);
    if (this.pelletsLeft <= pellets / 2) return 2;
    return this.pelletsLeft <= pellets ? 1 : 0;
  }

  reset(): void {
    this.score = 0;
    this.level = this.firstLevel;
    this.lives = this.startLives;
    this.isOver = false;
    this._extraLife = false;
    this.startLevel();
  }

  tick(dt = TICK_MS): void {
    if (this.isOver || this.waiting) return;
    this.updateMode(dt);
    this.releaseGhosts(dt);
    this.agePrize(dt);

    const runnerBefore = this.runner.position;
    const ghostsBefore = this.ghosts.map((ghost) => ghost.position);
    this.moveRunner();
    this.ageWanted(dt);
    this.ghosts.forEach((ghost) => this.moveGhost(ghost));

    // Same tile, or the runner and a ghost swapped tiles this tick.
    this.ghosts.forEach((ghost, i) => {
      const crossed = samePoint(ghost.position, runnerBefore) && samePoint(ghostsBefore[i]!, this.runner.position);
      if (samePoint(ghost.position, this.runner.position) || crossed) this.collide(ghost);
    });

    if (!this.isOver && this.pelletsLeft === 0) {
      this.level += 1;
      this.startLevel();
    }
  }

  speed(): number {
    return TICK_MS;
  }

  snapshot(): Snapshot {
    return pickFields(this, SAVED_FIELDS);
  }

  restore(snapshot: Snapshot): void {
    applyFields(this, snapshot, SAVED_FIELDS);
  }

  // The first arrow starts the runner off that way (or at the first open turn).
  handleKey(code: string): void {
    const direction = ARROW_DIRECTIONS[code];
    if (!direction) return;
    if (this.waiting) {
      this.waiting = false;
      if (this.canGo(direction)) {
        this.runner.direction = direction;
        return;
      }
    }
    this.wanted = direction;
    this.wantedMs = null;
  }

  // The first click picks the starting direction, as an arrow does: left click left, right
  // click right. After that each click turns a quarter (left click counter-clockwise):
  // - moving, the turn is taken at the next opening within CLICK_TURN_MS, and clicks add up
  //   from the turn still waiting (two make a U-turn);
  // - stopped against a wall, the runner turns on the spot, from the way it is drawn facing,
  //   so a turn into another wall shows, and the next click turns from there.
  handleMouseDown(button: MouseButton): void {
    if (this.waiting) return this.handleKey(button === 'left' ? 'ArrowLeft' : 'ArrowRight');
    const clockwise = button === 'right';
    if (this.canGo(this.runner.direction)) {
      this.wanted = quarterTurn(this.wanted ?? this.runner.direction, clockwise);
      this.wantedMs = CLICK_TURN_MS;
      return;
    }
    this.runner.direction = quarterTurn(this.runner.direction, clockwise);
    this.forgetWanted();
  }

  cells(): Grid {
    const grid: Grid = this.maze.tiles.map((row, y) => row.map((tile, x) => {
      if (tile === 'wall' || tile === 'door') return tile;
      return this.pellets[y]?.[x] ?? null;
    }));
    if (this.prize) setCell(grid, this.maze.prizeSpot.x, this.maze.prizeSpot.y, `prize-${this.prize.kind}`);
    setCell(grid, this.runner.position.x, this.runner.position.y, `runner-${directionName(this.runner.direction)}`);
    this.ghosts.forEach((ghost) => setCell(grid, ghost.position.x, ghost.position.y, this.ghostCell(ghost)));
    return grid;
  }

  stats(): Record<string, number> {
    return { lives: this.lives };
  }

  private get speeds(): Speeds {
    return speedsFor(this.level);
  }

  private startLevel(): void {
    this.pellets = this.maze.pellets.map((row) => [...row]);
    this._lostLife = false;
    this.resetPositions();
  }

  private resetPositions(): void {
    this.runner = { position: this.maze.runnerStart, direction: LEFT };
    this.forgetWanted();
    this.waiting = true;
    this.ghosts = GHOST_NAMES.map((name) => ({
      name,
      position: this.maze.ghostStarts[name],
      direction: LEFT,
      state: name === 'chaser' ? 'active' : 'house',
      frightened: false,
    }));
    this.frightenedMs = 0;
    this.prize = null;
    this._modeIndex = 0;
    this._modeMs = 0;
    this._pelletsEaten = 0;
    this._idleMs = 0;
  }

  // Frightened time freezes the scatter/chase schedule.
  private updateMode(dt: number): void {
    if (this.frightenedMs > 0) {
      this.frightenedMs -= dt;
      if (this.frightenedMs <= 0) {
        this.frightenedMs = 0;
        this.ghosts.forEach((ghost) => ghost.frightened = false);
      }
      return;
    }
    this._modeMs += dt;
    const schedule = scheduleFor(this.level);
    // A loop: the 1/60 s scatter of later levels starts and ends within one tick.
    while (this._modeMs >= (schedule[this._modeIndex] ?? Infinity)) {
      this._modeMs -= schedule[this._modeIndex]!;
      this._modeIndex += 1;
      // Ghosts turn around on every mode switch.
      this.activeGhosts().forEach((ghost) => ghost.direction = reverse(ghost.direction));
    }
  }

  // The next ghost in the house comes out once enough pellets are eaten, or when
  // The runner stops eating for a while. Released ghosts are placed on the exit, above the door.
  private releaseGhosts(dt: number): void {
    this._idleMs += dt;
    const ghost = this.ghosts.find((g) => g.state === 'house');
    if (!ghost || ghost.name === 'chaser') return;

    const pellets = this._lostLife ? RELEASE_AFTER_DEATH : RELEASE_PELLETS[Math.min(this.level, 3) - 1]!;
    if (this._pelletsEaten < pellets[ghost.name] && this._idleMs < idleReleaseMs(this.level)) return;
    this._idleMs = 0;
    ghost.state = 'active';
    ghost.position = this.maze.ghostStarts.chaser;
    ghost.direction = LEFT;
  }

  // A click's turn not taken in time is dropped: the runner keeps going.
  private ageWanted(dt: number): void {
    if (this.wantedMs === null) return;
    this.wantedMs -= dt;
    if (this.wantedMs <= 0) this.forgetWanted();
  }

  private forgetWanted(): void {
    this.wanted = null;
    this.wantedMs = null;
  }

  private canGo(direction: Point): boolean {
    return isWalkable(this.maze, stepFrom(this.maze, this.runner.position, direction));
  }

  private moveRunner(): void {
    const speed = this.frightenedMs > 0 ? this.speeds.runnerFrightened : this.speeds.runner;
    this.runner.budget = (this.runner.budget ?? 0) + speed;
    while (this.runner.budget >= 100) {
      this.runner.budget -= 100;
      if (this.wanted && this.canGo(this.wanted)) {
        this.runner.direction = this.wanted;
        this.forgetWanted();
      }
      if (!this.canGo(this.runner.direction)) return;

      const position = stepFrom(this.maze, this.runner.position, this.runner.direction);
      this.runner.position = position;
      this.eat(position);
      this.eatPrize(position);
    }
  }

  private eat({ x, y }: Point): void {
    const pellet = this.pellets[y]?.[x];
    if (!pellet) return;
    setCell(this.pellets, x, y, null);
    this._pelletsEaten += 1;
    this._idleMs = 0;
    this.runner.budget = (this.runner.budget ?? 0) - (pellet === 'power' ? POWER_PAUSE : PELLET_PAUSE);
    this.addScore(pellet === 'power' ? POWER_POINTS : PELLET_POINTS);
    if (pellet === 'power') this.frighten();
    this.maybeShowPrize();
  }

  private maybeShowPrize(): void {
    if (!this.prizes || !this.prizeAt.includes(this.totalPellets - this.pelletsLeft)) return;
    const ms = PRIZE_MIN_MS + this.random() * (PRIZE_MAX_MS - PRIZE_MIN_MS);
    this.prize = { kind: prizeFor(this.level).kind, ms };
  }

  private eatPrize(position: Point): void {
    if (!this.prize || !samePoint(position, this.maze.prizeSpot)) return;
    this.addScore(prizeFor(this.level).points);
    this.prize = null;
  }

  private agePrize(dt: number): void {
    if (!this.prize) return;
    this.prize.ms -= dt;
    if (this.prize.ms <= 0) this.prize = null;
  }

  private addScore(points: number): void {
    this.score += points;
    if (!this._extraLife && this.score >= EXTRA_LIFE_AT) {
      this._extraLife = true;
      this.lives += 1;
    }
  }

  private frighten(): void {
    this.frightenedMs = (FRIGHT_SECONDS[this.level - 1] ?? 0) * 1000;
    this._ghostsEaten = 0;
    // Ghosts still turn around, even when there's no frightened time left (later levels).
    this.activeGhosts().forEach((ghost) => {
      ghost.direction = reverse(ghost.direction);
      ghost.frightened = this.frightenedMs > 0;
    });
  }

  private ghostSpeed(ghost: Ghost): number {
    if (ghost.state === 'eyes') return EYES_SPEED;
    if (isTunnel(this.maze, ghost.position)) return this.speeds.tunnel;
    if (ghost.frightened) return this.speeds.ghostFrightened;
    const rush = ghost.name === 'chaser' ? this.rush : 0;
    return rush ? this.speeds.rush[rush - 1]! : this.speeds.ghost;
  }

  private moveGhost(ghost: Ghost): void {
    if (ghost.state === 'house') return;
    ghost.budget = (ghost.budget ?? 0) + this.ghostSpeed(ghost);
    while (ghost.budget >= 100) {
      ghost.budget -= 100;
      ghost.direction = chooseDirection(this.maze, ghost, this.ghostTarget(ghost), this.random);
      ghost.position = stepFrom(this.maze, ghost.position, ghost.direction);

      const exit = this.maze.ghostStarts.chaser;
      if (ghost.state === 'eyes' && samePoint(ghost.position, exit)) ghost.state = 'active';
    }
  }

  private ghostTarget(ghost: Ghost): Point | null {
    if (ghost.state === 'eyes') return this.maze.ghostStarts.chaser;
    if (ghost.frightened) return null;
    // A rushing chaser keeps chasing through scatter time.
    const rush = ghost.name === 'chaser' && this.rush > 0;
    if (this.mode === 'scatter' && !rush) return scatterTarget(ghost.name, this.maze);
    const chaser = this.ghosts[0]!.position;
    return chaseTarget(ghost.name, ghost.position, this.runner, chaser, this.maze);
  }

  private collide(ghost: Ghost): void {
    if (ghost.state !== 'active') return;
    if (ghost.frightened) {
      ghost.state = 'eyes';
      ghost.frightened = false;
      this.addScore(GHOST_POINTS * 2 ** this._ghostsEaten);
      this._ghostsEaten += 1;
      return;
    }
    this.lives -= 1;
    if (this.lives === 0) {
      this.isOver = true;
      return;
    }
    this.resetPositions();
    this._lostLife = true;
  }

  private activeGhosts(): Ghost[] {
    return this.ghosts.filter((ghost) => ghost.state === 'active');
  }

  private ghostCell(ghost: Ghost): string {
    if (ghost.state === 'eyes') return 'ghost-eyes';
    if (!ghost.frightened) return `ghost-${ghost.name}`;
    const flashingMs = (FLASHES[this.level - 1] ?? 0) * FLASH_MS;
    return this.frightenedMs <= flashingMs ? 'ghost-frightened-ending' : 'ghost-frightened';
  }
}

const MAZES = { compact: COMPACT, arcade: ARCADE };

const PRIZE_OPTION = onOff('prizes', 'Bonus prizes', true);

const MAZE_OPTION: GameOption<keyof typeof MAZES> = {
  key: 'maze',
  label: 'Maze',
  choices: [{ value: 'compact', label: 'Compact' }, { value: 'arcade', label: 'Arcade' }],
};

export const mazeChaseGame: GameDefinition = {
  id: 'maze-chase',
  // Saves gained the prize field, then wantedMs.
  saveVersion: SAVE_VERSION + 2,
  options: [MAZE_OPTION, levelOption, livesOption(LIVES), PRIZE_OPTION],
  create: (settings) => new MazeChase({
    layout: MAZES[choiceOf(settings, MAZE_OPTION)],
    firstLevel: levelFrom(settings),
    lives: livesFrom(settings, LIVES),
    prizes: isOn(settings, PRIZE_OPTION),
  }),
};
