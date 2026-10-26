import {
  applyFields, cryptoRandom, ARROW_DIRECTIONS, directionName, isOn, levelFrom, levelOption, livesFrom, livesOption, onOff, overlaps, pick, pickFields, UP,
  type CanvasGame, type GameDefinition, type Point, type Random, type Rect, type Snapshot,
} from '../game.js';
import { drawFrogger } from './frogger.draw.js';
import {
  BAYS, DIVE_CYCLE_MS, DIVE_UNDER_MS, HEIGHT, HOME_ROW, LANES, MEDIAN_ROW, START_ROW, TILE, TIME_LIMIT, WIDTH,
  isRiver, laneObjects, objectRects, type LaneObject,
} from './field.js';

const LIVES = 3;
const STEP_POINTS = 10;
const HOME_POINTS = 50;
const LEVEL_POINTS = 1000;
const BONUS_POINTS = 200;
// With the time limit on: points per second left when a frog gets home.
const TIME_POINTS = 10;
const EXTRA_LIFE_AT = 20_000;
// A hop: 8 frames of 2px, as in the arcade.
export const HOP_MS = 133;
// The splat shown before the next frog.
export const DYING_MS = 1000;
// A car hits the frog when it overlaps the frog's body (not its outer pixels).
const FROG_INSET = 2;

// Bonuses: the fly waits in an empty bay; the lady frog rides a log of the row by the median.
const FLY_EVERY_MS: [number, number] = [6000, 10_000];
export const FLY_STAYS_MS = 4000;
const LADY_EVERY_MS: [number, number] = [15_000, 25_000];
export const LADY_LANE = LANES.findIndex((lane) => lane.row === 5);

// Hazards come with the levels, as in the arcade (its exact timings aren't published:
// these are estimates).
export const HAZARDS_FROM = { crocodile: 2, bayCrocodile: 2, snake: 2, logSnake: 3, otters: 3 };
export type Hazard = keyof typeof HAZARDS_FROM;
// The river crocodile's jaws open for the end of each cycle: its head then bites.
export const JAWS_CYCLE_MS = 2000;
const JAWS_OPEN_MS = 800;
// The bay crocodile peeks (harmless), then comes out (deadly), then leaves.
const BAY_CROCODILE_EVERY_MS: [number, number] = [8000, 12_000];
export const BAY_CROCODILE_PEEK_MS = 1500;
export const BAY_CROCODILE_OUT_MS = 3000;
// Snakes: a head and a tail, one tile each; only the head bites.
export const SNAKE_SPEED = 24;
export const SNAKE_LENGTH = 2 * TILE;
// The log snake crawls along this log of the LADY_LANE row.
const SNAKE_LOG = 1;
// Otters swim across a river row, against its flow.
const OTTER_EVERY_MS: [number, number] = [10_000, 15_000];
export const OTTER_SPEED = 60;

const LANE_OBJECTS: LaneObject[][] = LANES.map(laneObjects);
const RIVER_LANES = LANES.flatMap((lane, i) => (isRiver(lane.kind) ? [i] : []));

export interface FroggerOptions {
  firstLevel?: number;
  lives?: number;
  // Each frog has TIME_LIMIT ms to reach a bay.
  timeLimit?: boolean;
  // '~' turtles dive on a cycle, drowning a frog riding them.
  divingTurtles?: boolean;
  random?: Random;
}

export interface Frog {
  // Left edge, in px.
  x: number;
  row: number;
  facing: string;
}

// A hop in progress, from where the frog took off.
export interface Hop {
  fromX: number;
  fromRow: number;
  ms: number;
}

// What a save keeps (the random source never is).
const SAVED_FIELDS = [
  'frog', 'hop', 'homes', 'offsets', 'timeLeft', 'dyingMs', 'fly', 'lady', 'ladyOnBack',
  'bayCrocodile', 'snake', 'logSnake', 'otter', 'score', 'level', 'lives', 'isOver',
  '_clockMs', '_bestRow', '_flyInMs', '_ladyInMs', '_bayCrocodileInMs', '_otterInMs', '_extraLife',
];

export class Frogger implements CanvasGame {
  readonly kind = 'canvas';
  readonly id = 'frogger';
  readonly title = 'Frogger';
  readonly width = WIDTH;
  readonly height = HEIGHT;

  score = 0;
  level = 1;
  lives = LIVES;
  isOver = false;
  frog: Frog = { x: 0, row: START_ROW, facing: 'up' };
  hop: Hop | null = null;
  homes: boolean[] = [];
  // How far each lane has moved, in px (same order as LANES).
  offsets: number[] = [];
  // ms left for the current frog (only counts down with the time limit on).
  timeLeft = TIME_LIMIT;
  // While > 0, the frog lies splatted and everything waits.
  dyingMs = 0;
  // The fly, in bay `bay`, for `ms` more.
  fly: { bay: number; ms: number } | null = null;
  // The lady frog, riding object `object` of the LADY_LANE row, until the frog picks her up.
  lady: { object: number } | null = null;
  ladyOnBack = false;
  // In bay `bay`, out for `ms` so far (peeking, then deadly).
  bayCrocodile: { bay: number; ms: number } | null = null;
  // Along the median: x is the snake's left end.
  snake: { x: number; direction: 1 | -1 } | null = null;
  // On a log of the LADY_LANE row: `along` px from the log's left end.
  logSnake: { object: number; along: number; direction: 1 | -1 } | null = null;
  // Swimming across a river row.
  otter: { row: number; x: number; direction: 1 | -1 } | null = null;
  // Game time, for the diving turtles' cycle.
  private _clockMs = 0;
  // Furthest row reached by this frog: only new rows score.
  private _bestRow = START_ROW;
  private _flyInMs = 0;
  private _ladyInMs = 0;
  private _bayCrocodileInMs = 0;
  private _otterInMs = 0;
  private _extraLife = false;
  private readonly random: Random;

  constructor(private readonly options: FroggerOptions = {}) {
    this.random = options.random ?? cryptoRandom;
    this.reset();
  }

  reset(): void {
    this.score = 0;
    this.level = this.options.firstLevel ?? 1;
    this.lives = this.options.lives ?? LIVES;
    this.isOver = false;
    this.homes = BAYS.map(() => false);
    this.offsets = LANES.map(() => 0);
    this.dyingMs = 0;
    this.fly = null;
    this.lady = null;
    this.ladyOnBack = false;
    this._clockMs = 0;
    this._extraLife = false;
    this._flyInMs = this.between(FLY_EVERY_MS);
    this._ladyInMs = this.between(LADY_EVERY_MS);
    this._bayCrocodileInMs = this.between(BAY_CROCODILE_EVERY_MS);
    this._otterInMs = this.between(OTTER_EVERY_MS);
    this.bayCrocodile = null;
    this.snake = null;
    this.logSnake = null;
    this.otter = null;
    this.addHazards();
    this.resetFrog();
  }

  tick(dt: number): void {
    if (this.isOver) return;
    if (this.dyingMs > 0) {
      this.dyingMs -= dt;
      if (this.dyingMs <= 0) this.afterDeath();
      return;
    }
    if (this.options.timeLimit) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) return this.die();
    }
    this._clockMs += dt;
    this.moveLanes(dt / 1000);
    this.updateFly(dt);
    this.updateLady(dt);
    this.updateBayCrocodile(dt);
    this.moveSnakes(dt / 1000);
    this.updateOtter(dt);

    if (this.hop) {
      this.hop.ms += dt;
      if (this.hop.ms < HOP_MS) return;
      this.hop = null;
      if (this.frog.row === HOME_ROW) return this.reachHome();
    }
    this.checkFrog();
  }

  snapshot(): Snapshot {
    return pickFields(this, SAVED_FIELDS);
  }

  restore(snapshot: Snapshot): void {
    applyFields(this, snapshot, SAVED_FIELDS);
  }

  // One hop per press; presses during a hop (or a splat) are ignored, as in the arcade.
  handleKey(code: string): void {
    const direction = ARROW_DIRECTIONS[code];
    if (!direction || this.isOver || this.hop || this.dyingMs > 0) return;

    const { x, row } = this.frog;
    this.frog = {
      x: Math.min(Math.max(x + direction.x * TILE, 0), WIDTH - TILE),
      row: Math.min(Math.max(row + direction.y, HOME_ROW), START_ROW),
      facing: directionName(direction),
    };
    this.hop = { fromX: x, fromRow: row, ms: 0 };
    if (this.frog.row < this._bestRow) {
      this._bestRow = this.frog.row;
      this.addScore(STEP_POINTS);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    drawFrogger(ctx, this);
  }

  stats(): Record<string, number> {
    if (!this.options.timeLimit) return { lives: this.lives };
    return { lives: this.lives, time: Math.max(0, Math.ceil(this.timeLeft / 1000)) };
  }

  get hasTimeLimit(): boolean {
    return Boolean(this.options.timeLimit);
  }

  // Where the frog is drawn: part-way through its hop, if any.
  get frogPosition(): Point {
    const y = this.frog.row * TILE;
    if (!this.hop) return { x: this.frog.x, y };
    const t = Math.min(this.hop.ms / HOP_MS, 1);
    return {
      x: this.hop.fromX + (this.frog.x - this.hop.fromX) * t,
      y: this.hop.fromRow * TILE + (y - this.hop.fromRow * TILE) * t,
    };
  }

  // Lane i's objects where they are now, with whether each is under water.
  laneRects(i: number): { rect: Rect; object: LaneObject; index: number }[] {
    const lane = LANES[i]!;
    return LANE_OBJECTS[i]!.flatMap((object, index) =>
      objectRects(object, lane.row, this.offsets[i] ?? 0).map((rect) => ({ rect, object, index })));
  }

  // 0 to DIVE_CYCLE_MS; diving turtles warn, then go under, late in the cycle.
  get divePhase(): number {
    return this._clockMs % DIVE_CYCLE_MS;
  }

  isUnderWater(object: LaneObject): boolean {
    return Boolean(this.options.divingTurtles) && object.diving && this.divePhase >= DIVE_UNDER_MS;
  }

  isDiving(object: LaneObject): boolean {
    return Boolean(this.options.divingTurtles) && object.diving;
  }

  hasHazard(hazard: Hazard): boolean {
    return this.level >= HAZARDS_FROM[hazard];
  }

  // A 'C' log, once crocodiles have come.
  isCrocodile(object: LaneObject): boolean {
    return object.crocodile && this.hasHazard('crocodile');
  }

  get jawsOpen(): boolean {
    return this._clockMs % JAWS_CYCLE_MS >= JAWS_CYCLE_MS - JAWS_OPEN_MS;
  }

  get bayCrocodileOut(): boolean {
    return (this.bayCrocodile?.ms ?? 0) >= BAY_CROCODILE_PEEK_MS;
  }

  // Each snake's head and tail.
  get snakeRects(): { head: Rect; tail: Rect }[] {
    const snakes: { x: number; y: number; direction: 1 | -1 }[] = [];
    if (this.snake) snakes.push({ ...this.snake, y: MEDIAN_ROW * TILE });
    const log = this.logSnakeLog;
    if (this.logSnake && log) snakes.push({ x: log.x + this.logSnake.along, y: log.y, direction: this.logSnake.direction });
    return snakes.map(({ x, y, direction }) => {
      const front = { x: direction === 1 ? x + TILE : x, y, width: TILE, height: TILE };
      return { head: front, tail: { ...front, x: direction === 1 ? x : x + TILE } };
    });
  }

  get otterRect(): Rect | null {
    return this.otter && { x: this.otter.x, y: this.otter.row * TILE, width: TILE, height: TILE };
  }

  // The lady frog's rect while she waits on her log.
  get ladyRect(): Rect | null {
    if (!this.lady) return null;
    const log = this.laneRects(LADY_LANE).find(({ index }) => index === this.lady!.object)?.rect;
    return log ? { x: log.x + (log.width - TILE) / 2, y: log.y, width: TILE, height: TILE } : null;
  }

  private laneSpeed(i: number): number {
    // Each level is 10% faster.
    return LANES[i]!.speed * (1 + (this.level - 1) / 10);
  }

  // Lanes slide; a log or turtle carries the frog standing on it.
  private moveLanes(seconds: number): void {
    LANES.forEach((lane, i) => {
      const distance = lane.direction * this.laneSpeed(i) * seconds;
      this.offsets[i] = ((this.offsets[i] ?? 0) + distance) % WIDTH;
      if (!this.hop && lane.row === this.frog.row && isRiver(lane.kind)) this.frog.x += distance;
    });
  }

  // The log the log snake crawls on (its first rect when it straddles an edge).
  private get logSnakeLog(): Rect | null {
    return this.laneRects(LADY_LANE).find(({ index }) => index === this.logSnake?.object)?.rect ?? null;
  }

  // Carried off the field, in the water, under a vehicle, or caught by a hazard.
  private checkFrog(): void {
    const centre = this.frog.x + TILE / 2;
    if (centre < 0 || centre > WIDTH) return this.die();

    const body = {
      x: this.frog.x + FROG_INSET,
      y: this.frog.row * TILE + FROG_INSET,
      width: TILE - 2 * FROG_INSET,
      height: TILE - 2 * FROG_INSET,
    };
    const biters = [...this.snakeRects.map(({ head }) => head), this.otterRect];
    if (biters.some((rect) => rect && overlaps(rect, body))) return this.die();

    const i = LANES.findIndex((lane) => lane.row === this.frog.row);
    if (i === -1) return;
    const rects = this.laneRects(i);
    if (isRiver(LANES[i]!.kind)) {
      const under = rects.find(({ rect }) => centre >= rect.x && centre < rect.x + rect.width);
      if (!under || this.isUnderWater(under.object)) return this.die();
      if (this.isCrocodile(under.object) && this.jawsOpen && this.isOnHead(under.rect, i, centre)) return this.die();
      this.pickUpLady();
      return;
    }
    if (rects.some(({ rect }) => overlaps(rect, body))) this.die();
  }

  // The crocodile's head is its front tile, in the direction it swims.
  private isOnHead(rect: Rect, lane: number, centre: number): boolean {
    const head = LANES[lane]!.direction === 1 ? rect.x + rect.width - TILE : rect.x;
    return centre >= head && centre < head + TILE;
  }

  private pickUpLady(): void {
    const lady = this.ladyRect;
    if (!lady || this.frog.row !== LANES[LADY_LANE]!.row) return;
    if (Math.abs(this.frog.x - lady.x) >= TILE) return;
    this.lady = null;
    this.ladyOnBack = true;
  }

  // The frog lands in the hedge row: an empty bay takes it, anything else kills.
  private reachHome(): void {
    const centre = this.frog.x + TILE / 2;
    const bay = BAYS.findIndex((rect) => centre >= rect.x && centre < rect.x + rect.width);
    if (bay === -1 || this.homes[bay]) return this.die();
    if (this.bayCrocodile?.bay === bay) {
      if (this.bayCrocodileOut) return this.die();
      // A frog landing on a peeking crocodile scares it away.
      this.bayCrocodile = null;
    }

    this.homes[bay] = true;
    let points = HOME_POINTS;
    if (this.options.timeLimit) points += TIME_POINTS * Math.floor(this.timeLeft / 1000);
    if (this.fly?.bay === bay) {
      points += BONUS_POINTS;
      this.fly = null;
    }
    if (this.ladyOnBack) points += BONUS_POINTS;
    this.ladyOnBack = false;
    this.addScore(points);

    if (this.homes.every(Boolean)) {
      this.addScore(LEVEL_POINTS);
      this.level += 1;
      this.homes = BAYS.map(() => false);
      this.fly = null;
      this.bayCrocodile = null;
      this.addHazards();
    }
    this.resetFrog();
  }

  // The fly turns up in a random empty bay now and then, and stays a few seconds.
  private updateFly(dt: number): void {
    if (this.fly) {
      this.fly.ms -= dt;
      if (this.fly.ms <= 0) this.fly = null;
      return;
    }
    this._flyInMs -= dt;
    if (this._flyInMs > 0) return;
    this._flyInMs = this.between(FLY_EVERY_MS);
    const empty = this.emptyBays().filter((bay) => bay !== this.bayCrocodile?.bay);
    if (empty.length) this.fly = { bay: pick(empty, this.random), ms: FLY_STAYS_MS };
  }

  private emptyBays(): number[] {
    return this.homes.flatMap((filled, bay) => (filled ? [] : [bay]));
  }

  // From its level, a crocodile now and then peeks out of an empty bay (never the fly's).
  private updateBayCrocodile(dt: number): void {
    if (this.bayCrocodile) {
      this.bayCrocodile.ms += dt;
      if (this.bayCrocodile.ms >= BAY_CROCODILE_PEEK_MS + BAY_CROCODILE_OUT_MS) this.bayCrocodile = null;
      return;
    }
    if (!this.hasHazard('bayCrocodile')) return;
    this._bayCrocodileInMs -= dt;
    if (this._bayCrocodileInMs > 0) return;
    this._bayCrocodileInMs = this.between(BAY_CROCODILE_EVERY_MS);
    const empty = this.emptyBays().filter((bay) => bay !== this.fly?.bay);
    if (empty.length) this.bayCrocodile = { bay: pick(empty, this.random), ms: 0 };
  }

  // The snakes their level brings, if not already out.
  private addHazards(): void {
    if (this.hasHazard('snake') && !this.snake) this.snake = { x: -SNAKE_LENGTH, direction: 1 };
    if (this.hasHazard('logSnake') && !this.logSnake) this.logSnake = { object: SNAKE_LOG, along: 0, direction: 1 };
  }

  // The median snake leaves one edge and comes back in at the other; the log snake
  // crawls to and fro along its log, which carries it.
  private moveSnakes(seconds: number): void {
    const distance = SNAKE_SPEED * seconds;
    if (this.snake) {
      this.snake.x += this.snake.direction * distance;
      if (this.snake.x > WIDTH) this.snake.x = -SNAKE_LENGTH;
      if (this.snake.x < -SNAKE_LENGTH) this.snake.x = WIDTH;
    }
    const log = this.logSnakeLog;
    if (this.logSnake && log) {
      const end = log.width - SNAKE_LENGTH;
      this.logSnake.along += this.logSnake.direction * distance;
      if (this.logSnake.along >= end) {
        this.logSnake.along = end;
        this.logSnake.direction = -1;
      }
      if (this.logSnake.along <= 0) {
        this.logSnake.along = 0;
        this.logSnake.direction = 1;
      }
    }
  }

  // From its level, an otter now and then swims across a river row, against its flow.
  private updateOtter(dt: number): void {
    if (this.otter) {
      this.otter.x += this.otter.direction * OTTER_SPEED * (dt / 1000);
      if (this.otter.x < -TILE || this.otter.x > WIDTH) this.otter = null;
      return;
    }
    if (!this.hasHazard('otters')) return;
    this._otterInMs -= dt;
    if (this._otterInMs > 0) return;
    this._otterInMs = this.between(OTTER_EVERY_MS);
    const lane = LANES[pick(RIVER_LANES, this.random)]!;
    const direction = lane.direction === 1 ? -1 : 1;
    this.otter = { row: lane.row, x: direction === 1 ? -TILE : WIDTH, direction };
  }

  // The lady frog boards a log, and leaves with it at the edge.
  private updateLady(dt: number): void {
    if (this.lady) {
      const log = this.laneRects(LADY_LANE).filter(({ index }) => index === this.lady!.object);
      if (log.length > 1) this.lady = null;
      return;
    }
    if (this.ladyOnBack) return;
    this._ladyInMs -= dt;
    if (this._ladyInMs > 0) return;
    this._ladyInMs = this.between(LADY_EVERY_MS);
    // A whole log on screen, without the log snake.
    const logs = this.laneRects(LADY_LANE).filter(({ rect, index }) =>
      rect.x >= 0 && rect.x + rect.width <= WIDTH && index !== this.logSnake?.object);
    if (logs.length) this.lady = { object: pick(logs, this.random).index };
  }

  private addScore(points: number): void {
    this.score += points;
    if (!this._extraLife && this.score >= EXTRA_LIFE_AT) {
      this._extraLife = true;
      this.lives += 1;
    }
  }

  private die(): void {
    this.lives -= 1;
    this.hop = null;
    this.ladyOnBack = false;
    this.dyingMs = DYING_MS;
  }

  private afterDeath(): void {
    this.dyingMs = 0;
    if (this.lives === 0) {
      this.isOver = true;
      return;
    }
    this.resetFrog();
  }

  private resetFrog(): void {
    this.frog = { x: Math.floor(WIDTH / 2 / TILE) * TILE, row: START_ROW, facing: directionName(UP) };
    this.hop = null;
    this._bestRow = START_ROW;
    this.timeLeft = TIME_LIMIT;
  }

  // A random duration in [min, max) ms.
  private between([min, max]: [number, number]): number {
    return min + this.random() * (max - min);
  }
}

const TIME_OPTION = onOff('time', 'Time limit');
const TURTLES_OPTION = onOff('turtles', 'Diving turtles');

export const froggerGame: GameDefinition = {
  id: 'frogger',
  options: [levelOption, livesOption(LIVES), TIME_OPTION, TURTLES_OPTION],
  create: (settings) => new Frogger({
    firstLevel: levelFrom(settings),
    lives: livesFrom(settings, LIVES),
    timeLimit: isOn(settings, TIME_OPTION),
    divingTurtles: isOn(settings, TURTLES_OPTION),
  }),
};
