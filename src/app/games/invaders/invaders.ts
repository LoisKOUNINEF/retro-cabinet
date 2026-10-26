import {
  applyFields, autoFireOption, cryptoRandom, isFireKey, isOn, FIRE_KEYS, levelFrom, levelOption, livesFrom, livesOption, onOff, overlaps, pick, pickFields,
  type CanvasGame, type GameDefinition, type KeyHint, type Random, type Rect, type Snapshot, type TouchLayout,
} from '../game.js';
import { spriteHeight, spriteWidth } from '../sprites.js';
import { drawInvaders } from './invaders.draw.js';
import {
  CANNON, CANNON_Y, GROUND_Y, HEIGHT, INVADER_SPRITES, SHIELD, SHIELD_Y, UFO, UFO_Y, WIDTH, type InvaderType,
} from './sprites.js';

export const SHIELD_XS = [32, 77, 122, 167];
export const CHUNK = 2;
export const SHOT_SIZE = { width: 1, height: 4 };
export const BOMB_SIZE = { width: 3, height: 7 };

const LIVES = 3;
const COLUMNS = 11;
const ROW_TYPES: InvaderType[] = ['squid', 'crab', 'crab', 'octopus', 'octopus'];
const POINTS: Record<InvaderType, number> = { squid: 30, crab: 20, octopus: 10 };
const SPACING = 16;
const CELL_WIDTH = 12;
const FLEET_X = 24;
const FLEET_Y = 48;
// How much lower each wave starts than the first, from the arcade's table; after wave 9
// it cycles back to wave 2's.
const WAVE_DROPS = [0, 24, 40, 48, 48, 48, 56, 56, 56];
const waveDrop = (level: number) => WAVE_DROPS[level <= WAVE_DROPS.length ? level - 1 : 1 + ((level - 2) % (WAVE_DROPS.length - 1))]!;
// [score below, ms between bombs]: the arcade's 48, 16, 11, 8 and 7 frames.
const BOMB_RELOAD: [number, number][] = [[200, 800], [1000, 267], [2000, 183], [3000, 133], [Infinity, 117]];
const WALL_MARGIN = 8;
const MARCH_STEP = 2;
const DROP = 8;
// Units per second.
// Arcade values (computerarcheology.com/Arcade/SpaceInvaders): 1 px per frame.
const CANNON_SPEED = 60;
const SHOT_SPEED = 240;
const BOMB_SPEED = 80;
// Bombs fall faster once 8 invaders or fewer are left.
const FAST_BOMB_SPEED = 100;
const FAST_BOMBS_AT = 8;
const UFO_SPEED = 40;
// Projectiles move at most this far before collisions are checked: nothing gets skipped.
const SUBSTEP = 2;
const MAX_BOMBS = 3;
const UFO_EVERY_MS = 25_000;
const UFO_MIN_INVADERS = 8;
// The arcade's UFO score, picked by how many shots were fired.
const UFO_POINTS = [100, 50, 50, 100, 150, 100, 100, 50, 300, 100, 100, 100, 50, 150, 100];

export interface Invader {
  type: InvaderType;
  col: number;
  row: number;
}

export interface InvadersOptions {
  firstLevel?: number;
  lives?: number;
  shields?: boolean;
  // See TouchLayout.autoFire (the keyboard's fire keys work the same way).
  autoFire?: boolean;
  random?: Random;
}

// What a save keeps (held keys and the random source never are).
const SAVED_FIELDS = [
  'invaders', 'fleet', 'cannonX', 'shot', 'bombs', 'shieldChunks', 'ufo', 'shotsFired', 'score', 'level', 'lives', 'isOver',
  '_marchMs', '_bombMs', '_ufoMs', '_nextUfoDirection',
];

export class Invaders implements CanvasGame {
  readonly kind = 'canvas';
  readonly id = 'invaders';
  readonly title = 'Space Invaders';
  readonly width = WIDTH;
  readonly height = HEIGHT;
  readonly touch: TouchLayout;
  readonly keyHints: KeyHint[];

  score = 0;
  // The wave: each one starts lower and marches faster.
  level = 1;
  lives = LIVES;
  isOver = false;
  invaders: Invader[] = [];
  // Top-left of the fleet grid; invaders sit at col/row offsets from it.
  fleet = { x: FLEET_X, y: 0, direction: 1 as 1 | -1, frame: 0 };
  cannonX = 0;
  shot: Rect | null = null;
  bombs: Rect[] = [];
  // Remaining 2×2 pieces of all four bunkers.
  shieldChunks: Rect[] = [];
  ufo: { x: number; direction: 1 | -1 } | null = null;
  shotsFired = 0;
  private _held = { left: false, right: false, fire: false };
  private _marchMs = 0;
  private _bombMs = 0;
  private _ufoMs = 0;
  private _nextUfoDirection: 1 | -1 = 1;
  private readonly random: Random;

  constructor(private readonly options: InvadersOptions = {}) {
    this.random = options.random ?? cryptoRandom;
    this.touch = {
      pad: 'stick',
      directions: ['left', 'right'],
      action: { label: options.autoFire ? 'Hold' : 'Fire', code: 'ArrowUp' },
      ...(options.autoFire && { autoFire: true }),
    };
    this.keyHints = [
      { action: 'Move', codes: ['ArrowLeft', 'ArrowRight'] },
      { action: options.autoFire ? 'Hold fire' : 'Fire', codes: ['ArrowUp', ...FIRE_KEYS] },
    ];
    this.reset();
  }

  // ms between march steps: the fewer invaders, the faster (one per frame at the end).
  // As in the arcade, later waves don't march faster: they start lower.
  get stepMs(): number {
    return Math.max(16, this.invaders.length * 16);
  }

  // The arcade reloads bombs faster as the score grows.
  get bombEveryMs(): number {
    return (BOMB_RELOAD.find(([below]) => this.score < below) ?? BOMB_RELOAD[BOMB_RELOAD.length - 1]!)[1];
  }

  get cannonRect(): Rect {
    return { x: this.cannonX, y: CANNON_Y, width: spriteWidth(CANNON), height: spriteHeight(CANNON) };
  }

  get ufoRect(): Rect | null {
    return this.ufo && { x: this.ufo.x, y: UFO_Y, width: spriteWidth(UFO), height: spriteHeight(UFO) };
  }

  // Each invader's sprite is centred in its 12-unit cell.
  invaderRect({ type, col, row }: Invader): Rect {
    const sprite = INVADER_SPRITES[type][0];
    const width = spriteWidth(sprite);
    return {
      x: this.fleet.x + col * SPACING + (CELL_WIDTH - width) / 2,
      y: this.fleet.y + row * SPACING,
      width,
      height: spriteHeight(sprite),
    };
  }

  reset(): void {
    this.score = 0;
    this.level = this.options.firstLevel ?? 1;
    this.lives = this.options.lives ?? LIVES;
    this.isOver = false;
    this.shotsFired = 0;
    this.startWave();
  }

  tick(dt: number): void {
    if (this.isOver) return;
    const seconds = dt / 1000;

    this.moveCannon(seconds);
    if (this._held.fire) this.fire();
    this.moveShot(seconds);
    this.moveBombs(seconds);
    this.march(dt);
    this.moveUfo(dt, seconds);
    this.dropBomb(dt);

    if (!this.isOver && !this.invaders.length) {
      this.level += 1;
      this.startWave();
    }
  }

  snapshot(): Snapshot {
    return pickFields(this, SAVED_FIELDS);
  }

  restore(snapshot: Snapshot): void {
    applyFields(this, snapshot, SAVED_FIELDS);
  }

  handleKey(code: string): void {
    if (code === 'ArrowLeft') this._held.left = true;
    if (code === 'ArrowRight') this._held.right = true;
    if (code === 'ArrowUp' || isFireKey(code)) {
      this._held.fire = true;
      this.fire();
    }
  }

  handleKeyUp(code: string): void {
    if (code === 'ArrowLeft') this._held.left = false;
    if (code === 'ArrowRight') this._held.right = false;
    if (code === 'ArrowUp' || isFireKey(code)) this._held.fire = false;
  }

  releaseKeys(): void {
    this._held = { left: false, right: false, fire: false };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    drawInvaders(ctx, this);
  }

  stats(): Record<string, number> {
    return { lives: this.lives };
  }

  private startWave(): void {
    this.invaders = ROW_TYPES.flatMap((type, row) =>
      Array.from({ length: COLUMNS }, (_, col) => ({ type, col, row })));
    this.fleet = { x: FLEET_X, y: FLEET_Y + waveDrop(this.level), direction: 1, frame: 0 };
    this.cannonX = Math.floor((WIDTH - spriteWidth(CANNON)) / 2);
    this.shot = null;
    this.bombs = [];
    this.ufo = null;
    this._marchMs = 0;
    this._bombMs = 0;
    this._ufoMs = 0;
    this.shieldChunks = this.options.shields === false ? [] : buildShields();
  }

  private moveCannon(seconds: number): void {
    const direction = Number(this._held.right) - Number(this._held.left);
    const x = this.cannonX + direction * CANNON_SPEED * seconds;
    this.cannonX = Math.min(Math.max(x, 0), WIDTH - spriteWidth(CANNON));
  }

  // One shot on screen at a time (arcade rule).
  private fire(): void {
    if (this.shot || this.isOver) return;
    this.shot = { x: this.cannonX + Math.floor(spriteWidth(CANNON) / 2), y: CANNON_Y - SHOT_SIZE.height, ...SHOT_SIZE };
    this.shotsFired += 1;
  }

  private moveShot(seconds: number): void {
    const shot = this.shot;
    if (!shot) return;
    const distance = SHOT_SPEED * seconds;
    const steps = Math.max(1, Math.ceil(distance / SUBSTEP));
    for (let i = 0; i < steps && this.shot; i++) {
      shot.y -= distance / steps;
      if (shot.y + shot.height < 0) this.shot = null;
      else this.hitWithShot(shot);
    }
  }

  // What the shot hits first: a bomb, a shield, an invader or the UFO.
  private hitWithShot(shot: Rect): void {
    const bomb = this.bombs.find((b) => overlaps(b, shot));
    if (bomb) {
      this.bombs = this.bombs.filter((b) => b !== bomb);
      this.shot = null;
      return;
    }
    if (this.erodeShield(shot)) {
      this.shot = null;
      return;
    }
    const invader = this.invaders.find((inv) => overlaps(this.invaderRect(inv), shot));
    if (invader) {
      this.invaders = this.invaders.filter((inv) => inv !== invader);
      this.score += POINTS[invader.type];
      this.shot = null;
      return;
    }
    const ufo = this.ufoRect;
    if (ufo && overlaps(ufo, shot)) {
      this.score += UFO_POINTS[(this.shotsFired - 1) % UFO_POINTS.length] ?? 100;
      this.ufo = null;
      this._ufoMs = 0;
      this.shot = null;
    }
  }

  private moveBombs(seconds: number): void {
    const speed = this.invaders.length <= FAST_BOMBS_AT ? FAST_BOMB_SPEED : BOMB_SPEED;
    const distance = speed * seconds;
    const steps = Math.max(1, Math.ceil(distance / SUBSTEP));
    for (let i = 0; i < steps && !this.isOver; i++) {
      this.bombs.forEach((bomb) => bomb.y += distance / steps);
      this.bombs = this.bombs.filter((bomb) => bomb.y < GROUND_Y && !this.erodeShield(bomb));
      if (this.bombs.some((bomb) => overlaps(bomb, this.cannonRect))) return this.loseLife();
    }
  }

  private loseLife(): void {
    this.lives -= 1;
    this.bombs = [];
    this.shot = null;
    if (this.lives === 0) this.isOver = true;
  }

  // The whole fleet steps sideways, or drops and turns at a wall.
  private march(dt: number): void {
    this._marchMs += dt;
    if (this._marchMs < this.stepMs || !this.invaders.length) return;
    this._marchMs = 0;

    const rects = this.invaders.map((inv) => this.invaderRect(inv));
    const left = Math.min(...rects.map((r) => r.x));
    const right = Math.max(...rects.map((r) => r.x + r.width));
    const hitsWall = this.fleet.direction > 0
      ? right + MARCH_STEP > WIDTH - WALL_MARGIN
      : left - MARCH_STEP < WALL_MARGIN;

    if (hitsWall) {
      this.fleet.y += DROP;
      this.fleet.direction = this.fleet.direction > 0 ? -1 : 1;
    } else {
      this.fleet.x += MARCH_STEP * this.fleet.direction;
    }
    this.fleet.frame = 1 - this.fleet.frame;

    // Invaders crush the bunkers they walk over; reaching the cannon's row ends the game.
    this.invaders.forEach((inv) => this.erodeShield(this.invaderRect(inv), false));
    const bottom = Math.max(...this.invaders.map((inv) => this.invaderRect(inv)).map((r) => r.y + r.height));
    if (bottom >= CANNON_Y) this.isOver = true;
  }

  private moveUfo(dt: number, seconds: number): void {
    if (!this.ufo) {
      this._ufoMs += dt;
      if (this._ufoMs < UFO_EVERY_MS || this.invaders.length < UFO_MIN_INVADERS) return;
      const direction = this._nextUfoDirection;
      this._nextUfoDirection = direction > 0 ? -1 : 1;
      this.ufo = { x: direction > 0 ? -spriteWidth(UFO) : WIDTH, direction };
      this._ufoMs = 0;
      return;
    }
    this.ufo.x += this.ufo.direction * UFO_SPEED * seconds;
    if (this.ufo.x > WIDTH || this.ufo.x < -spriteWidth(UFO)) this.ufo = null;
  }

  // The lowest invader of a random column drops a bomb.
  private dropBomb(dt: number): void {
    this._bombMs += dt;
    if (this._bombMs < this.bombEveryMs) return;
    this._bombMs = 0;
    if (this.bombs.length >= MAX_BOMBS || !this.invaders.length) return;

    const columns = [...new Set(this.invaders.map((inv) => inv.col))];
    const col = pick(columns, this.random);
    const lowest = this.invaders.filter((inv) => inv.col === col).reduce((a, b) => (b.row > a.row ? b : a));
    const rect = this.invaderRect(lowest);
    this.bombs.push({ x: rect.x + Math.floor(rect.width / 2) - 1, y: rect.y + rect.height, ...BOMB_SIZE });
  }

  // Removes the shield chunks hit by `rect`: with `blast`, also the chunks around the
  // first one hit (a shot or bomb); without, only the overlapped ones (a marching invader).
  // Returns whether anything was hit.
  private erodeShield(rect: Rect, blast = true): boolean {
    const hit = this.shieldChunks.find((chunk) => overlaps(chunk, rect));
    if (!hit) return false;
    this.shieldChunks = this.shieldChunks.filter((chunk) => blast
      ? Math.abs(chunk.x - hit.x) > CHUNK || Math.abs(chunk.y - hit.y) > CHUNK
      : !overlaps(chunk, rect));
    return true;
  }
}

// Four bunkers, each SHIELD cut into 2×2 chunks (kept when their top-left pixel is lit).
export function buildShields(): Rect[] {
  return SHIELD_XS.flatMap((shieldX) => SHIELD.flatMap((row, y) => [...row].flatMap((pixel, x) =>
    pixel === '#' && x % CHUNK === 0 && y % CHUNK === 0
      ? [{ x: shieldX + x, y: SHIELD_Y + y, width: CHUNK, height: CHUNK }]
      : [])));
}

const SHIELDS_OPTION = onOff('shields', 'Shields', true);

export const invadersGame: GameDefinition = {
  id: 'invaders',
  options: [levelOption, livesOption(LIVES), SHIELDS_OPTION, autoFireOption],
  create: (settings) => new Invaders({
    firstLevel: levelFrom(settings),
    lives: livesFrom(settings, LIVES),
    shields: isOn(settings, SHIELDS_OPTION),
    autoFire: isOn(settings, autoFireOption),
  }),
};
