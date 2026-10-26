import {
  applyFields, autoFireOption, cryptoRandom, isFireKey, isOn, FIRE_KEYS, levelFrom, levelOption, livesFrom, livesOption, onOff,
  pick, pickFields, rotate, withSpeed, wrap,
  type CanvasGame, type GameDefinition, type KeyHint, type Random, type Snapshot, type TouchLayout,
} from '../game.js';
import { drawAsteroids } from './asteroids.draw.js';
import {
  BULLET_RADIUS, HEIGHT, ROCK_POINTS, ROCKS, SAUCERS, SHIP_RADIUS, WIDTH,
  type Bullet, type Mover, type Rock, type RockSize, type Saucer, type Ship,
} from './field.js';

const LIVES = 3;
const EXTRA_LIFE_EVERY = 10_000;
// Ship: radians per second, units per second (squared).
const TURN_SPEED = 4.5;
const THRUST = 160;
const MAX_SPEED = 200;
// Share of the ship's speed kept after one second of drifting.
const DRAG_PER_SECOND = 0.5;
const INVULNERABLE_MS = 2000;
// Bullets.
const MAX_BULLETS = 4;
const BULLET_SPEED = 300;
const BULLET_LIFE_MS = 900;
const FIRE_REPEAT_MS = 250;
// Projectiles move at most this far between collision checks: none skips over a small rock.
const SUBSTEP = 4;
// Waves.
const MAX_ROCKS = 11;
const SAFE_DISTANCE = 60;
const NEXT_WAVE_MS = 2000;
// Saucers.
const SAUCER_MIN_MS = 15_000;
const SAUCER_MAX_MS = 25_000;
const SAUCER_FIRE_MS = 1000;
const SAUCER_TURN_MS = 1500;
const SAUCER_BULLET_SPEED = 200;
const SAUCER_BULLET_LIFE_MS = 1200;
const SMALL_SAUCER_SCORE = 10_000;
const SMALL_SAUCER_AIM_ERROR = Math.PI / 18;
// Hyperspace.
const HYPERSPACE_COOLDOWN_MS = 1000;
const HYPERSPACE_FAIL_CHANCE = 0.1;

export interface AsteroidsOptions {
  firstLevel?: number;
  lives?: number;
  saucers?: boolean;
  hyperspace?: boolean;
  // Touch only: see TouchLayout.autoFire.
  autoFire?: boolean;
  random?: Random;
}

// Shortest offset from a to b on the wrapping field.
function wrappedOffset(a: Mover, b: Mover): { dx: number; dy: number } {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  if (Math.abs(dx) > WIDTH / 2) dx -= Math.sign(dx) * WIDTH;
  if (Math.abs(dy) > HEIGHT / 2) dy -= Math.sign(dy) * HEIGHT;
  return { dx, dy };
}

export function wrappedDistance(a: Mover, b: Mover): number {
  const { dx, dy } = wrappedOffset(a, b);
  return Math.hypot(dx, dy);
}

// What a save keeps (held keys and the random source never are).
const SAVED_FIELDS = [
  'ship', 'bullets', 'rocks', 'saucer', 'saucerBullets', 'score', 'level', 'lives', 'isOver',
  'invulnerableMs', '_fireMs', '_nextWaveMs', '_saucerMs', '_hyperspaceMs', '_nextExtraLife',
];

export class Asteroids implements CanvasGame {
  readonly kind = 'canvas';
  readonly id = 'asteroids';
  readonly title = 'Asteroids';
  readonly width = WIDTH;
  readonly height = HEIGHT;
  readonly touch: TouchLayout;
  readonly keyHints: KeyHint[];

  score = 0;
  // The wave.
  level = 1;
  lives = LIVES;
  isOver = false;
  ship: Ship = { x: WIDTH / 2, y: HEIGHT / 2, vx: 0, vy: 0, angle: 0 };
  bullets: Bullet[] = [];
  rocks: Rock[] = [];
  saucer: Saucer | null = null;
  saucerBullets: Bullet[] = [];
  invulnerableMs = 0;
  private _held = { left: false, right: false, thrust: false, fire: false };
  private _fireMs = 0;
  // Countdown to the next wave once the field is clear (null while rocks remain).
  private _nextWaveMs: number | null = null;
  private _saucerMs = 0;
  private _hyperspaceMs = 0;
  private _nextExtraLife = EXTRA_LIFE_EVERY;
  private readonly random: Random;

  constructor(private readonly options: AsteroidsOptions = {}) {
    this.random = options.random ?? cryptoRandom;
    // On touch the stick turns and thrusts (up), and hyperspaces (down) if enabled.
    this.touch = {
      directions: options.hyperspace ? ['left', 'right', 'up', 'down'] : ['left', 'right', 'up'],
      action: { label: options.autoFire ? 'Hold' : 'Fire', code: FIRE_KEYS[0]! },
      ...(options.autoFire && { autoFire: true }),
    };
    this.keyHints = [
      { action: 'Turn', codes: ['ArrowLeft', 'ArrowRight'] },
      { action: 'Thrust', codes: ['ArrowUp'] },
      { action: 'Fire', codes: FIRE_KEYS },
      ...(options.hyperspace ? [{ action: 'Hyperspace', codes: ['ArrowDown'] }] : []),
    ];
    this.reset();
  }

  get thrusting(): boolean {
    return this._held.thrust && !this.isOver;
  }

  reset(): void {
    this.score = 0;
    this.level = this.options.firstLevel ?? 1;
    this.lives = this.options.lives ?? LIVES;
    this.isOver = false;
    this._nextExtraLife = EXTRA_LIFE_EVERY;
    this.respawn();
    this.invulnerableMs = 0;
    this.saucer = null;
    this.saucerBullets = [];
    this._saucerMs = this.nextSaucerDelay();
    this.startWave();
  }

  tick(dt: number): void {
    if (this.isOver) return;
    const seconds = dt / 1000;
    this.invulnerableMs = Math.max(0, this.invulnerableMs - dt);
    this._fireMs = Math.max(0, this._fireMs - dt);
    this._hyperspaceMs = Math.max(0, this._hyperspaceMs - dt);

    this.steerShip(seconds);
    if (this._held.fire) this.fire();
    this.rocks.forEach((rock) => this.move(rock, seconds));
    this.moveSaucer(dt, seconds);
    this.bullets = this.moveBullets(this.bullets, dt, (bullet) => this.playerBulletHits(bullet));
    this.saucerBullets = this.moveBullets(this.saucerBullets, dt, (bullet) => this.saucerBulletHits(bullet));
    this.checkShip();
    this.nextWave(dt);
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
    if (code === 'ArrowUp') this._held.thrust = true;
    if (code === 'ArrowDown') this.hyperspace();
    if (isFireKey(code)) {
      this._held.fire = true;
      this.fire();
    }
  }

  handleKeyUp(code: string): void {
    if (code === 'ArrowLeft') this._held.left = false;
    if (code === 'ArrowRight') this._held.right = false;
    if (code === 'ArrowUp') this._held.thrust = false;
    if (isFireKey(code)) this._held.fire = false;
  }

  releaseKeys(): void {
    this._held = { left: false, right: false, thrust: false, fire: false };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    drawAsteroids(ctx, this);
  }

  stats(): Record<string, number> {
    return { lives: this.lives };
  }

  // Ship.

  private steerShip(seconds: number): void {
    const ship = this.ship;
    ship.angle += (Number(this._held.right) - Number(this._held.left)) * TURN_SPEED * seconds;
    if (this._held.thrust) {
      ship.vx += Math.sin(ship.angle) * THRUST * seconds;
      ship.vy -= Math.cos(ship.angle) * THRUST * seconds;
    }
    const drag = DRAG_PER_SECOND ** seconds;
    Object.assign(ship, withSpeed(ship, Math.min(Math.hypot(ship.vx, ship.vy) * drag, MAX_SPEED)));
    this.move(ship, seconds);
  }

  private fire(): void {
    if (this.isOver || this._fireMs > 0 || this.bullets.length >= MAX_BULLETS) return;
    const { x, y, vx, vy, angle } = this.ship;
    const dx = Math.sin(angle);
    const dy = -Math.cos(angle);
    this.bullets.push({
      x: wrap(x + dx * SHIP_RADIUS, WIDTH),
      y: wrap(y + dy * SHIP_RADIUS, HEIGHT),
      vx: dx * BULLET_SPEED + vx,
      vy: dy * BULLET_SPEED + vy,
      life: BULLET_LIFE_MS,
    });
    this._fireMs = FIRE_REPEAT_MS;
  }

  // A jump to a random spot, risky: it sometimes ends in an explosion.
  private hyperspace(): void {
    if (!this.options.hyperspace || this.isOver || this._hyperspaceMs > 0) return;
    this._hyperspaceMs = HYPERSPACE_COOLDOWN_MS;
    Object.assign(this.ship, { x: this.random() * WIDTH, y: this.random() * HEIGHT, vx: 0, vy: 0 });
    if (this.random() < HYPERSPACE_FAIL_CHANCE) this.loseLife();
  }

  private respawn(): void {
    this.ship = { x: WIDTH / 2, y: HEIGHT / 2, vx: 0, vy: 0, angle: 0 };
    this.bullets = [];
    this.invulnerableMs = INVULNERABLE_MS;
  }

  private loseLife(): void {
    this.lives -= 1;
    if (this.lives === 0) this.isOver = true;
    else this.respawn();
  }

  // The ship dies on touching a rock, the saucer or a saucer bullet, unless just respawned.
  private checkShip(): void {
    if (this.isOver || this.invulnerableMs > 0) return;
    const ship = this.ship;
    const touches = (thing: Mover, radius: number) => wrappedDistance(ship, thing) < SHIP_RADIUS + radius;

    const rock = this.rocks.find((r) => touches(r, ROCKS[r.size].radius));
    if (rock) {
      this.splitRock(rock);
      return this.loseLife();
    }
    if (this.saucer && touches(this.saucer, this.saucerRadius(this.saucer))) {
      this.saucer = null;
      return this.loseLife();
    }
    const bullet = this.saucerBullets.find((b) => touches(b, BULLET_RADIUS));
    if (bullet) {
      this.saucerBullets = this.saucerBullets.filter((b) => b !== bullet);
      this.loseLife();
    }
  }

  // Rocks and waves.

  private startWave(): void {
    // As in the arcade: 4 large rocks, then 2 more each wave, up to 11.
    const count = Math.min(2 + 2 * this.level, MAX_ROCKS);
    this.rocks = Array.from({ length: count }, () => {
      let position = { x: this.random() * WIDTH, y: this.random() * HEIGHT, vx: 0, vy: 0 };
      // Too close to the ship: across the field instead.
      if (wrappedDistance(position, this.ship) < SAFE_DISTANCE) {
        position = { ...position, x: wrap(position.x + WIDTH / 2, WIDTH), y: wrap(position.y + HEIGHT / 2, HEIGHT) };
      }
      return this.newRock('large', position.x, position.y);
    });
    this._nextWaveMs = null;
  }

  private nextWave(dt: number): void {
    if (this.rocks.length) return;
    this._nextWaveMs = (this._nextWaveMs ?? NEXT_WAVE_MS) - dt;
    if (this._nextWaveMs > 0) return;
    this.level += 1;
    this.startWave();
  }

  private newRock(size: RockSize, x: number, y: number): Rock {
    const { minSpeed, maxSpeed } = ROCKS[size];
    const angle = this.random() * Math.PI * 2;
    const speed = minSpeed + this.random() * (maxSpeed - minSpeed);
    return {
      x, y, size,
      vx: Math.sin(angle) * speed,
      vy: -Math.cos(angle) * speed,
      shape: Array.from({ length: ROCK_POINTS }, () => 0.75 + this.random() * 0.4),
    };
  }

  private splitRock(rock: Rock): void {
    const next = ROCKS[rock.size].splitsInto;
    this.rocks = this.rocks.filter((r) => r !== rock);
    if (next) this.rocks.push(this.newRock(next, rock.x, rock.y), this.newRock(next, rock.x, rock.y));
  }

  // Bullets.

  // Moves bullets in small steps; `hits` says whether a bullet struck something (and is used up).
  private moveBullets(bullets: Bullet[], dt: number, hits: (bullet: Bullet) => boolean): Bullet[] {
    const seconds = dt / 1000;
    return bullets.filter((bullet) => {
      bullet.life -= dt;
      if (bullet.life <= 0) return false;
      const steps = Math.max(1, Math.ceil((Math.hypot(bullet.vx, bullet.vy) * seconds) / SUBSTEP));
      for (let i = 0; i < steps; i++) {
        this.move(bullet, seconds / steps);
        if (hits(bullet)) return false;
      }
      return true;
    });
  }

  private playerBulletHits(bullet: Bullet): boolean {
    const rock = this.rocks.find((r) => wrappedDistance(bullet, r) < ROCKS[r.size].radius);
    if (rock) {
      this.addScore(ROCKS[rock.size].points);
      this.splitRock(rock);
      return true;
    }
    const saucer = this.saucer;
    if (saucer && wrappedDistance(bullet, saucer) < this.saucerRadius(saucer)) {
      this.addScore(saucer.small ? SAUCERS.small.points : SAUCERS.large.points);
      this.saucer = null;
      this._saucerMs = this.nextSaucerDelay();
      return true;
    }
    return false;
  }

  // Saucer fire breaks rocks too, but scores nothing.
  private saucerBulletHits(bullet: Bullet): boolean {
    const rock = this.rocks.find((r) => wrappedDistance(bullet, r) < ROCKS[r.size].radius);
    if (!rock) return false;
    this.splitRock(rock);
    return true;
  }

  private addScore(points: number): void {
    this.score += points;
    while (this.score >= this._nextExtraLife) {
      this.lives += 1;
      this._nextExtraLife += EXTRA_LIFE_EVERY;
    }
  }

  // Saucers.

  private saucerRadius(saucer: Saucer): number {
    return saucer.small ? SAUCERS.small.radius : SAUCERS.large.radius;
  }

  private nextSaucerDelay(): number {
    return SAUCER_MIN_MS + this.random() * (SAUCER_MAX_MS - SAUCER_MIN_MS);
  }

  private moveSaucer(dt: number, seconds: number): void {
    if (!this.options.saucers) return;
    if (!this.saucer) {
      this._saucerMs -= dt;
      if (this._saucerMs <= 0) this.spawnSaucer();
      return;
    }
    const saucer = this.saucer;
    // It crosses once, horizontally: no wrapping on x.
    saucer.x += saucer.vx * seconds;
    saucer.y = wrap(saucer.y + saucer.vy * seconds, HEIGHT);
    if (saucer.x < -SAUCERS.large.radius * 2 || saucer.x > WIDTH + SAUCERS.large.radius * 2) {
      this.saucer = null;
      this._saucerMs = this.nextSaucerDelay();
      return;
    }
    saucer.turnMs -= dt;
    if (saucer.turnMs <= 0) {
      saucer.vy = pick([-40, 0, 40], this.random);
      saucer.turnMs = SAUCER_TURN_MS;
    }
    saucer.fireMs -= dt;
    if (saucer.fireMs <= 0) {
      this.saucerFire(saucer);
      saucer.fireMs = SAUCER_FIRE_MS;
    }
  }

  // Small and dangerous once the score is high, else small one time in three.
  private spawnSaucer(): void {
    const small = this.score >= SMALL_SAUCER_SCORE || this.random() < 1 / 3;
    const { radius, speed } = small ? SAUCERS.small : SAUCERS.large;
    const fromLeft = this.random() < 0.5;
    this.saucer = {
      small,
      x: fromLeft ? -radius : WIDTH + radius,
      y: 20 + this.random() * (HEIGHT - 40),
      vx: fromLeft ? speed : -speed,
      vy: 0,
      fireMs: SAUCER_FIRE_MS,
      turnMs: SAUCER_TURN_MS,
    };
  }

  // The large saucer fires anywhere; the small one aims at the ship, give or take 10°.
  private saucerFire(saucer: Saucer): void {
    let angle: number;
    if (saucer.small) {
      const { dx, dy } = wrappedOffset(saucer, this.ship);
      angle = Math.atan2(dx, -dy) + (this.random() * 2 - 1) * SMALL_SAUCER_AIM_ERROR;
    } else {
      angle = this.random() * Math.PI * 2;
    }
    const velocity = rotate({ vx: 0, vy: -SAUCER_BULLET_SPEED }, angle);
    this.saucerBullets.push({ x: wrap(saucer.x, WIDTH), y: saucer.y, ...velocity, life: SAUCER_BULLET_LIFE_MS });
  }

  private move(thing: Mover, seconds: number): void {
    thing.x = wrap(thing.x + thing.vx * seconds, WIDTH);
    thing.y = wrap(thing.y + thing.vy * seconds, HEIGHT);
  }
}

const SAUCERS_OPTION = onOff('saucers', 'Saucers', true);
const HYPERSPACE_OPTION = onOff('hyperspace', 'Hyperspace', true);

export const asteroidsGame: GameDefinition = {
  id: 'asteroids',
  options: [levelOption, livesOption(LIVES), SAUCERS_OPTION, HYPERSPACE_OPTION, autoFireOption],
  create: (settings) => new Asteroids({
    firstLevel: levelFrom(settings),
    lives: livesFrom(settings, LIVES),
    saucers: isOn(settings, SAUCERS_OPTION),
    hyperspace: isOn(settings, HYPERSPACE_OPTION),
    autoFire: isOn(settings, autoFireOption),
  }),
};
