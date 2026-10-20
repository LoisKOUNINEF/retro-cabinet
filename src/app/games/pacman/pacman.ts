import {
  applyFields, choiceOf, cryptoRandom, ARROW_DIRECTIONS, directionName, LEFT, levelFrom, levelOption, pickFields, samePoint, setCell,
  type GridGame, type GameDefinition, type GameOption, type Grid, type Point, type Random, type Snapshot,
} from '../game.js';
import { chaseTarget, chooseDirection, reverse, scatterTarget } from './ghosts.js';
import {
  ARCADE, COMPACT, GHOST_NAMES, isTunnel, isWalkable, parseMaze, stepFrom, type GhostName, type Maze,
} from './mazes.js';

// Values from the arcade game, as documented by the Pac-Man Dossier (pacman.holenet.info).

// One tick is one tile at the arcade's 100% speed (75.76 px/s, 8px tiles).
export const TICK_MS = 106;
const LIVES = 3;
const EXTRA_LIFE_AT = 10_000;
const PELLET_POINTS = 10;
const POWER_POINTS = 50;
// Doubles with each ghost eaten on the same power pellet: 200, 400, 800, 1600.
const GHOST_POINTS = 200;
// Pacman stops for 1 frame per pellet, 3 per power pellet (one frame is ~16% of a tile).
const PELLET_PAUSE = 16;
const POWER_PAUSE = 48;
const EYES_SPEED = 150;
// Each flash at the end of frightened time.
const FLASH_MS = 400;

// Speeds in % of 100%: each tick, a mover adds its speed to its budget and takes a step per 100.
interface Speeds {
  pacman: number;
  pacmanFrightened: number;
  ghost: number;
  ghostFrightened: number;
  tunnel: number;
  // Blinky's two "Cruise Elroy" speed-ups, as the maze empties.
  elroy: [number, number];
}

// Levels 1, 2-4, 5-20, 21+.
const SPEEDS: Speeds[] = [
  { pacman: 80, pacmanFrightened: 90, ghost: 75, ghostFrightened: 50, tunnel: 40, elroy: [80, 85] },
  { pacman: 90, pacmanFrightened: 95, ghost: 85, ghostFrightened: 55, tunnel: 45, elroy: [90, 95] },
  { pacman: 100, pacmanFrightened: 100, ghost: 95, ghostFrightened: 60, tunnel: 50, elroy: [100, 105] },
  { pacman: 90, pacmanFrightened: 90, ghost: 95, ghostFrightened: 60, tunnel: 50, elroy: [100, 105] },
];

const speedsFor = (level: number): Speeds => SPEEDS[level === 1 ? 0 : level <= 4 ? 1 : level <= 20 ? 2 : 3]!;

// Pellets left when Blinky turns Elroy 1, then 2 (half as many), by level.
function elroyPellets(level: number): number {
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
const RELEASE_PELLETS: Record<'pinky' | 'inky' | 'clyde', number>[] = [
  { pinky: 0, inky: 30, clyde: 60 },
  { pinky: 0, inky: 0, clyde: 50 },
  { pinky: 0, inky: 0, clyde: 0 },
];
const RELEASE_AFTER_DEATH = { pinky: 7, inky: 17, clyde: 32 };
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

export interface PacmanMover {
  position: Point;
  direction: Point;
  budget?: number;
}

// What a save keeps (held keys and the random source never are).
const SAVED_FIELDS = [
  'pellets', 'pacman', 'wanted', 'ghosts', 'frightenedMs', 'score', 'level', 'lives', 'isOver', 'waiting',
  '_modeIndex', '_modeMs', '_ghostsEaten', '_pelletsEaten', '_idleMs', '_lostLife', '_extraLife',
];

export interface PacmanOptions {
  // The maze, as rows of characters (see mazes.ts).
  layout?: string[];
  firstLevel?: number;
  random?: Random;
}

export class Pacman implements GridGame {
  readonly kind = 'grid';
  readonly id = 'pacman';
  readonly title = 'Pacman';
  readonly maze: Maze;
  readonly width: number;
  readonly height: number;

  score = 0;
  level = 1;
  lives = LIVES;
  isOver = false;
  pellets: (string | null)[][] = [];
  pacman: PacmanMover = { position: { x: 0, y: 0 }, direction: LEFT };
  // Last arrow pressed, taken at the first open turn.
  wanted: Point | null = null;
  ghosts: Ghost[] = [];
  frightenedMs = 0;
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

  constructor({ layout = COMPACT, firstLevel = 1, random = cryptoRandom }: PacmanOptions = {}) {
    this.random = random;
    this.firstLevel = firstLevel;
    this.maze = parseMaze(layout);
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

  // 0, then 1 and 2 as Blinky speeds up near the end of the maze.
  get elroy(): 0 | 1 | 2 {
    const pellets = elroyPellets(this.level);
    if (this.pelletsLeft <= pellets / 2) return 2;
    return this.pelletsLeft <= pellets ? 1 : 0;
  }

  reset(): void {
    this.score = 0;
    this.level = this.firstLevel;
    this.lives = LIVES;
    this.isOver = false;
    this._extraLife = false;
    this.startLevel();
  }

  tick(dt = TICK_MS): void {
    if (this.isOver || this.waiting) return;
    this.updateMode(dt);
    this.releaseGhosts(dt);

    const pacmanBefore = this.pacman.position;
    const ghostsBefore = this.ghosts.map((ghost) => ghost.position);
    this.movePacman();
    this.ghosts.forEach((ghost) => this.moveGhost(ghost));

    // Same tile, or Pacman and a ghost swapped tiles this tick.
    this.ghosts.forEach((ghost, i) => {
      const crossed = samePoint(ghost.position, pacmanBefore) && samePoint(ghostsBefore[i]!, this.pacman.position);
      if (samePoint(ghost.position, this.pacman.position) || crossed) this.collide(ghost);
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

  // The first arrow starts Pacman off that way (or at the first open turn).
  handleKey(code: string): void {
    const direction = ARROW_DIRECTIONS[code];
    if (!direction) return;
    if (this.waiting) {
      this.waiting = false;
      if (this.canGo(direction)) {
        this.pacman.direction = direction;
        return;
      }
    }
    this.wanted = direction;
  }

  cells(): Grid {
    const grid: Grid = this.maze.tiles.map((row, y) => row.map((tile, x) => {
      if (tile === 'wall' || tile === 'door') return tile;
      return this.pellets[y]?.[x] ?? null;
    }));
    setCell(grid, this.pacman.position.x, this.pacman.position.y, `pacman-${directionName(this.pacman.direction)}`);
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
    this.pacman = { position: this.maze.pacmanStart, direction: LEFT };
    this.wanted = null;
    this.waiting = true;
    this.ghosts = GHOST_NAMES.map((name) => ({
      name,
      position: this.maze.ghostStarts[name],
      direction: LEFT,
      state: name === 'blinky' ? 'active' : 'house',
      frightened: false,
    }));
    this.frightenedMs = 0;
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
  // Pacman stops eating for a while. Released ghosts are placed on the exit, above the door.
  private releaseGhosts(dt: number): void {
    this._idleMs += dt;
    const ghost = this.ghosts.find((g) => g.state === 'house');
    if (!ghost || ghost.name === 'blinky') return;

    const pellets = this._lostLife ? RELEASE_AFTER_DEATH : RELEASE_PELLETS[Math.min(this.level, 3) - 1]!;
    if (this._pelletsEaten < pellets[ghost.name] && this._idleMs < idleReleaseMs(this.level)) return;
    this._idleMs = 0;
    ghost.state = 'active';
    ghost.position = this.maze.ghostStarts.blinky;
    ghost.direction = LEFT;
  }

  private canGo(direction: Point): boolean {
    return isWalkable(this.maze, stepFrom(this.maze, this.pacman.position, direction));
  }

  private movePacman(): void {
    const speed = this.frightenedMs > 0 ? this.speeds.pacmanFrightened : this.speeds.pacman;
    this.pacman.budget = (this.pacman.budget ?? 0) + speed;
    while (this.pacman.budget >= 100) {
      this.pacman.budget -= 100;
      if (this.wanted && this.canGo(this.wanted)) {
        this.pacman.direction = this.wanted;
        this.wanted = null;
      }
      if (!this.canGo(this.pacman.direction)) return;

      const position = stepFrom(this.maze, this.pacman.position, this.pacman.direction);
      this.pacman.position = position;
      this.eat(position);
    }
  }

  private eat({ x, y }: Point): void {
    const pellet = this.pellets[y]?.[x];
    if (!pellet) return;
    setCell(this.pellets, x, y, null);
    this._pelletsEaten += 1;
    this._idleMs = 0;
    this.pacman.budget = (this.pacman.budget ?? 0) - (pellet === 'power' ? POWER_PAUSE : PELLET_PAUSE);
    this.addScore(pellet === 'power' ? POWER_POINTS : PELLET_POINTS);
    if (pellet === 'power') this.frighten();
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
    const elroy = ghost.name === 'blinky' ? this.elroy : 0;
    return elroy ? this.speeds.elroy[elroy - 1]! : this.speeds.ghost;
  }

  private moveGhost(ghost: Ghost): void {
    if (ghost.state === 'house') return;
    ghost.budget = (ghost.budget ?? 0) + this.ghostSpeed(ghost);
    while (ghost.budget >= 100) {
      ghost.budget -= 100;
      ghost.direction = chooseDirection(this.maze, ghost, this.ghostTarget(ghost), this.random);
      ghost.position = stepFrom(this.maze, ghost.position, ghost.direction);

      const exit = this.maze.ghostStarts.blinky;
      if (ghost.state === 'eyes' && samePoint(ghost.position, exit)) ghost.state = 'active';
    }
  }

  private ghostTarget(ghost: Ghost): Point | null {
    if (ghost.state === 'eyes') return this.maze.ghostStarts.blinky;
    if (ghost.frightened) return null;
    // Elroy keeps chasing through scatter time.
    const elroy = ghost.name === 'blinky' && this.elroy > 0;
    if (this.mode === 'scatter' && !elroy) return scatterTarget(ghost.name, this.maze);
    const blinky = this.ghosts[0]!.position;
    return chaseTarget(ghost.name, ghost.position, this.pacman, blinky, this.maze);
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

const MAZE_OPTION: GameOption<keyof typeof MAZES> = {
  key: 'maze',
  label: 'Maze',
  choices: [{ value: 'compact', label: 'Compact' }, { value: 'arcade', label: 'Arcade' }],
};

export const pacmanGame: GameDefinition = {
  id: 'pacman',
  options: [MAZE_OPTION, levelOption],
  create: (settings) => new Pacman({ layout: MAZES[choiceOf(settings, MAZE_OPTION)], firstLevel: levelFrom(settings) }),
};
