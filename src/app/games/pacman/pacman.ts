import {
  applyFields, ARROW_DIRECTIONS, directionName, LEFT, levelFrom, levelOption, levelSpeed, pickFields, samePoint, setCell,
  type Game, type GameDefinition, type Grid, type Point, type Random, type Snapshot,
} from '../game.js';
import { chaseTarget, chooseDirection, reverse, scatterTarget } from './ghosts.js';
import { ARCADE, COMPACT, GHOST_NAMES, isWalkable, parseMaze, stepFrom, type GhostName, type Maze } from './mazes.js';

const BASE_SPEED = 150;
const LIVES = 3;
const PELLET_POINTS = 10;
const POWER_POINTS = 50;
// Doubles with each ghost eaten on the same power pellet: 200, 400, 800, 1600.
const GHOST_POINTS = 200;

// Ticks spent in each mode, alternating scatter, chase, scatter… then chase forever.
const MODE_SCHEDULE = [56, 160, 56, 160, 40, 160, 40, Infinity];
const FRIGHTENED_TICKS = 48;
// Frightened ghosts flash for the last ticks.
const FRIGHTENED_ENDING_TICKS = 16;
// Ticks after a (re)start before each ghost leaves the house.
const RELEASE_TICKS: Record<GhostName, number> = { blinky: 0, pinky: 0, inky: 40, clyde: 80 };

export interface Ghost {
  name: GhostName;
  position: Point;
  direction: Point;
  // In the house, roaming the maze, or eaten (eyes heading back to the house).
  state: 'house' | 'active' | 'eyes';
  frightened: boolean;
}

// What a save keeps (held keys and the random source never are).
const SAVED_FIELDS = [
  'pellets', 'pacman', 'wanted', 'ghosts', 'ticks', 'frightenedTicks', 'score', 'level', 'lives', 'isOver',
  '_modeIndex', '_modeTicks', '_ghostsEaten',
];

export class Pacman implements Game {
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
  pacman = { position: { x: 0, y: 0 }, direction: LEFT };
  // Last arrow pressed, taken at the first open turn.
  wanted: Point | null = null;
  ghosts: Ghost[] = [];
  ticks = 0;
  frightenedTicks = 0;
  private _modeIndex = 0;
  private _modeTicks = 0;
  private _ghostsEaten = 0;

  constructor(
    layout: string[] = COMPACT,
    private readonly random: Random = Math.random,
    private readonly firstLevel = 1,
  ) {
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

  reset(): void {
    this.score = 0;
    this.level = this.firstLevel;
    this.lives = LIVES;
    this.isOver = false;
    this.startLevel();
  }

  tick(): void {
    if (this.isOver) return;
    this.ticks += 1;
    this.updateMode();
    this.releaseGhosts();

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
    return levelSpeed(BASE_SPEED, this.level);
  }

  snapshot(): Snapshot {
    return pickFields(this, SAVED_FIELDS);
  }

  restore(snapshot: Snapshot): void {
    applyFields(this, snapshot, SAVED_FIELDS);
  }

  handleKey(code: string): void {
    const direction = ARROW_DIRECTIONS[code];
    if (direction) this.wanted = direction;
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

  private startLevel(): void {
    this.pellets = this.maze.pellets.map((row) => [...row]);
    this.resetPositions();
  }

  private resetPositions(): void {
    this.pacman = { position: this.maze.pacmanStart, direction: LEFT };
    this.wanted = null;
    this.ghosts = GHOST_NAMES.map((name) => ({
      name,
      position: this.maze.ghostStarts[name],
      direction: LEFT,
      state: name === 'blinky' ? 'active' : 'house',
      frightened: false,
    }));
    this.ticks = 0;
    this.frightenedTicks = 0;
    this._modeIndex = 0;
    this._modeTicks = 0;
  }

  // Frightened time freezes the scatter/chase schedule.
  private updateMode(): void {
    if (this.frightenedTicks > 0) {
      this.frightenedTicks -= 1;
      if (this.frightenedTicks === 0) this.ghosts.forEach((ghost) => ghost.frightened = false);
      return;
    }
    this._modeTicks += 1;
    if (this._modeTicks < (MODE_SCHEDULE[this._modeIndex] ?? Infinity)) return;
    this._modeIndex += 1;
    this._modeTicks = 0;
    // Ghosts turn around on every mode switch.
    this.activeGhosts().forEach((ghost) => ghost.direction = reverse(ghost.direction));
  }

  // Released ghosts are placed on the exit, above the door.
  private releaseGhosts(): void {
    this.ghosts.forEach((ghost) => {
      if (ghost.state !== 'house' || this.ticks < RELEASE_TICKS[ghost.name]) return;
      ghost.state = 'active';
      ghost.position = this.maze.ghostStarts.blinky;
      ghost.direction = LEFT;
    });
  }

  private movePacman(): void {
    const canGo = (direction: Point) => isWalkable(this.maze, stepFrom(this.maze, this.pacman.position, direction));
    if (this.wanted && canGo(this.wanted)) {
      this.pacman.direction = this.wanted;
      this.wanted = null;
    }
    if (!canGo(this.pacman.direction)) return;

    const position = stepFrom(this.maze, this.pacman.position, this.pacman.direction);
    this.pacman.position = position;
    this.eat(position);
  }

  private eat({ x, y }: Point): void {
    const pellet = this.pellets[y]?.[x];
    if (!pellet) return;
    setCell(this.pellets, x, y, null);
    this.score += pellet === 'power' ? POWER_POINTS : PELLET_POINTS;
    if (pellet === 'power') this.frighten();
  }

  private frighten(): void {
    this.frightenedTicks = Math.max(0, FRIGHTENED_TICKS - 4 * (this.level - 1));
    this._ghostsEaten = 0;
    if (!this.frightenedTicks) return;
    this.activeGhosts().forEach((ghost) => {
      ghost.frightened = true;
      ghost.direction = reverse(ghost.direction);
    });
  }

  // Normal ghosts skip every 5th tick, frightened ones move every other tick, eyes every tick.
  private moveGhost(ghost: Ghost): void {
    if (ghost.state === 'house') return;
    if (ghost.frightened && this.ticks % 2 !== 0) return;
    if (ghost.state === 'active' && !ghost.frightened && this.ticks % 5 === 0) return;

    ghost.direction = chooseDirection(this.maze, ghost, this.ghostTarget(ghost), this.random);
    ghost.position = stepFrom(this.maze, ghost.position, ghost.direction);

    const exit = this.maze.ghostStarts.blinky;
    if (ghost.state === 'eyes' && samePoint(ghost.position, exit)) ghost.state = 'active';
  }

  private ghostTarget(ghost: Ghost): Point | null {
    if (ghost.state === 'eyes') return this.maze.ghostStarts.blinky;
    if (ghost.frightened) return null;
    if (this.mode === 'scatter') return scatterTarget(ghost.name, this.maze);
    const blinky = this.ghosts[0]!.position;
    return chaseTarget(ghost.name, ghost.position, this.pacman, blinky, this.maze);
  }

  private collide(ghost: Ghost): void {
    if (ghost.state !== 'active') return;
    if (ghost.frightened) {
      ghost.state = 'eyes';
      ghost.frightened = false;
      this.score += GHOST_POINTS * 2 ** this._ghostsEaten;
      this._ghostsEaten += 1;
      return;
    }
    this.lives -= 1;
    if (this.lives === 0) this.isOver = true;
    else this.resetPositions();
  }

  private activeGhosts(): Ghost[] {
    return this.ghosts.filter((ghost) => ghost.state === 'active');
  }

  private ghostCell(ghost: Ghost): string {
    if (ghost.state === 'eyes') return 'ghost-eyes';
    if (!ghost.frightened) return `ghost-${ghost.name}`;
    return this.frightenedTicks <= FRIGHTENED_ENDING_TICKS ? 'ghost-frightened-ending' : 'ghost-frightened';
  }
}

export const pacmanGame: GameDefinition = {
  id: 'pacman',
  options: [{
    key: 'maze',
    label: 'Maze',
    choices: [{ value: 'compact', label: 'Compact' }, { value: 'arcade', label: 'Arcade' }],
  }, levelOption],
  create: (settings) => new Pacman(settings.maze === 'arcade' ? ARCADE : COMPACT, Math.random, levelFrom(settings)),
};
