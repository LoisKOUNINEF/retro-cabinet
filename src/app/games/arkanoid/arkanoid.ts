import {
  applyFields, cryptoRandom, isFireKey, isOn, FIRE_KEYS, levelFrom, levelOption, onOff, pick, pickFields, rotate, withSpeed,
  type CanvasGame, type GameDefinition, type KeyHint, type Random, type Rect, type Snapshot, type TouchLayout,
} from '../game.js';
import { drawArkanoid } from './arkanoid.draw.js';
import {
  BRICK_HEIGHT, BRICK_POINTS, BRICK_WIDTH, CAPSULE_HEIGHT, HEIGHT, LAYOUTS, PADDLE_HEIGHT, PADDLE_Y, TOP_ROWS, WIDTH,
  type BrickKind,
} from './layouts.js';
import { BALL_RADIUS, hitRect, paddleBounce, type Ball } from './physics.js';

const LIVES = 3;
const PADDLE_WIDTH = 32;
const WIDE_PADDLE_WIDTH = 48;
// Units per second.
const PADDLE_SPEED = 180;
const BALL_SPEED = 140;
const CAPSULE_SPEED = 60;
// Each lap through the 5 layouts makes the ball 10% faster.
const LAP_SPEEDUP = 1.1;
const SLOW_FACTOR = 0.7;
// Longest a ball moves before collisions are checked, so it can't tunnel through a brick.
const SUBSTEP = 4;
const CAPSULE_ODDS = 1 / 6;
const CATCH_RELEASE_MS = 3000;
const MULTI_BALL_ANGLE = Math.PI / 9;

export interface Brick extends Rect {
  kind: BrickKind;
  hits: number;
}

// E Enlarge, S Slow, D Disruption (multi-ball), C Catch, P extra Player.
export type CapsuleKind = 'E' | 'S' | 'D' | 'C' | 'P';
export const CAPSULE_KINDS: CapsuleKind[] = ['E', 'S', 'D', 'C', 'P'];

export interface Capsule {
  x: number;
  y: number;
  kind: CapsuleKind;
}

export interface ArkanoidOptions {
  firstLevel?: number;
  powerUps?: boolean;
  random?: Random;
}

// What a save keeps (held keys and the random source never are).
const SAVED_FIELDS = ['paddle', 'balls', 'bricks', 'capsule', 'effect', 'score', 'level', 'lives', 'isOver', '_stuckMs'];

export class Arkanoid implements CanvasGame {
  readonly kind = 'canvas';
  readonly id = 'arkanoid';
  readonly title = 'Arkanoid';
  readonly width = WIDTH;
  readonly height = HEIGHT;
  readonly touch: TouchLayout = { directions: ['left', 'right'], action: { label: 'Launch', code: 'ArrowUp' } };
  readonly keyHints: KeyHint[] = [
    { action: 'Move', codes: ['ArrowLeft', 'ArrowRight'] },
    { action: 'Launch', codes: ['ArrowUp', ...FIRE_KEYS] },
  ];

  score = 0;
  // The round: picks the layout and, every 5 rounds, speeds the ball up.
  level = 1;
  lives = LIVES;
  isOver = false;
  paddle = { x: 0, width: PADDLE_WIDTH };
  balls: Ball[] = [];
  bricks: Brick[] = [];
  capsule: Capsule | null = null;
  effect: 'enlarge' | 'slow' | 'catch' | null = null;
  private _held = { left: false, right: false };
  private _stuckMs = 0;
  private readonly random: Random;

  constructor(private readonly options: ArkanoidOptions = {}) {
    this.random = options.random ?? cryptoRandom;
    this.reset();
  }

  get paddleRect(): Rect {
    return { x: this.paddle.x, y: PADDLE_Y, width: this.paddle.width, height: PADDLE_HEIGHT };
  }

  ballSpeed(): number {
    const laps = Math.floor((this.level - 1) / LAYOUTS.length);
    return BALL_SPEED * LAP_SPEEDUP ** laps * (this.effect === 'slow' ? SLOW_FACTOR : 1);
  }

  reset(): void {
    this.score = 0;
    this.level = this.options.firstLevel ?? 1;
    this.lives = LIVES;
    this.isOver = false;
    this.startRound();
  }

  tick(dt: number): void {
    if (this.isOver) return;
    const seconds = dt / 1000;

    this.movePaddle(seconds);
    this.releaseCaughtBalls(dt);
    this.balls.forEach((ball) => this.moveBall(ball, seconds));
    this.balls = this.balls.filter((ball) => ball.y - BALL_RADIUS <= HEIGHT);
    this.moveCapsule(seconds);

    if (!this.balls.length) return this.loseLife();
    if (!this.bricks.some((brick) => brick.kind !== 'G')) {
      this.level += 1;
      this.startRound();
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
    if (code === 'ArrowUp' || isFireKey(code)) this.launch();
  }

  handleKeyUp(code: string): void {
    if (code === 'ArrowLeft') this._held.left = false;
    if (code === 'ArrowRight') this._held.right = false;
  }

  releaseKeys(): void {
    this._held = { left: false, right: false };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    drawArkanoid(ctx, this);
  }

  stats(): Record<string, number> {
    return { lives: this.lives };
  }

  private startRound(): void {
    const layout = LAYOUTS[(this.level - 1) % LAYOUTS.length] ?? [];
    const silverHits = 2 + Math.floor((this.level - 1) / 8);
    this.bricks = layout.flatMap((row, y) => [...row].flatMap((char, x) => char === '.' ? [] : [{
      x: x * BRICK_WIDTH,
      y: (TOP_ROWS + y) * BRICK_HEIGHT,
      width: BRICK_WIDTH,
      height: BRICK_HEIGHT,
      kind: char as BrickKind,
      hits: char === 's' ? silverHits : 1,
    }]));
    this.serve();
  }

  // A new ball waits on the centre of a normal paddle.
  private serve(): void {
    this.paddle = { x: (WIDTH - PADDLE_WIDTH) / 2, width: PADDLE_WIDTH };
    this.effect = null;
    this.capsule = null;
    // Slightly off-centre, so the launch isn't straight up.
    this.balls = [this.stuckBall(PADDLE_WIDTH / 2 + 4)];
  }

  private stuckBall(offset: number): Ball {
    return { x: this.paddle.x + offset, y: PADDLE_Y - BALL_RADIUS, vx: 0, vy: 0, stuck: true, offset };
  }

  private launch(): void {
    this.balls.filter((ball) => ball.stuck).forEach((ball) => {
      Object.assign(ball, paddleBounce(ball.x, this.paddleRect, this.ballSpeed()), { stuck: false });
    });
    this._stuckMs = 0;
  }

  private loseLife(): void {
    this.lives -= 1;
    if (this.lives === 0) this.isOver = true;
    else this.serve();
  }

  private movePaddle(seconds: number): void {
    const direction = Number(this._held.right) - Number(this._held.left);
    const x = this.paddle.x + direction * PADDLE_SPEED * seconds;
    this.paddle.x = Math.min(Math.max(x, 0), WIDTH - this.paddle.width);
    this.balls.filter((ball) => ball.stuck).forEach((ball) => ball.x = this.paddle.x + ball.offset);
  }

  // Catch holds the ball for a few seconds at most.
  private releaseCaughtBalls(dt: number): void {
    if (!this.balls.some((ball) => ball.stuck) || this.effect !== 'catch') return;
    this._stuckMs += dt;
    if (this._stuckMs >= CATCH_RELEASE_MS) this.launch();
  }

  private moveBall(ball: Ball, seconds: number): void {
    if (ball.stuck) return;
    const steps = Math.max(1, Math.ceil((Math.hypot(ball.vx, ball.vy) * seconds) / SUBSTEP));
    for (let i = 0; i < steps && !ball.stuck; i++) {
      ball.x += (ball.vx * seconds) / steps;
      ball.y += (ball.vy * seconds) / steps;
      this.bounceOffWalls(ball);
      this.bounceOffPaddle(ball);
      this.bounceOffBricks(ball);
    }
  }

  private bounceOffWalls(ball: Ball): void {
    if (ball.x - BALL_RADIUS < 0) ball.vx = Math.abs(ball.vx);
    if (ball.x + BALL_RADIUS > WIDTH) ball.vx = -Math.abs(ball.vx);
    if (ball.y - BALL_RADIUS < 0) ball.vy = Math.abs(ball.vy);
  }

  private bounceOffPaddle(ball: Ball): void {
    if (ball.vy <= 0 || !hitRect(ball, this.paddleRect)) return;
    ball.y = PADDLE_Y - BALL_RADIUS;
    if (this.effect === 'catch') {
      Object.assign(ball, { vx: 0, vy: 0, stuck: true, offset: ball.x - this.paddle.x });
      this._stuckMs = 0;
      return;
    }
    Object.assign(ball, paddleBounce(ball.x, this.paddleRect, this.ballSpeed()));
  }

  // Bounces off the first brick it's moving into. A ball still overlapping a brick
  // it just bounced off is moving away from it: no second flip, no second hit.
  private bounceOffBricks(ball: Ball): void {
    for (const brick of this.bricks) {
      const side = hitRect(ball, brick);
      if (!side) continue;
      const towards = side === 'x'
        ? Math.sign(ball.vx) === Math.sign(brick.x + brick.width / 2 - ball.x)
        : Math.sign(ball.vy) === Math.sign(brick.y + brick.height / 2 - ball.y);
      if (!towards) continue;
      if (side === 'x') ball.vx = -ball.vx;
      else ball.vy = -ball.vy;
      this.hitBrick(brick);
      return;
    }
  }

  private hitBrick(brick: Brick): void {
    if (brick.kind === 'G') return;
    brick.hits -= 1;
    if (brick.hits > 0) return;

    this.bricks = this.bricks.filter((b) => b !== brick);
    this.score += brick.kind === 's' ? BRICK_POINTS.s * this.level : BRICK_POINTS[brick.kind];
    this.dropCapsule(brick);
  }

  // One capsule at a time, none during multi-ball (arcade rules).
  private dropCapsule(brick: Brick): void {
    if (!this.options.powerUps || this.capsule || this.balls.length > 1) return;
    if (this.random() >= CAPSULE_ODDS) return;
    this.capsule = { x: brick.x, y: brick.y, kind: pick(CAPSULE_KINDS, this.random) };
  }

  private moveCapsule(seconds: number): void {
    if (!this.capsule) return;
    this.capsule.y += CAPSULE_SPEED * seconds;
    const caught = hitRect(
      { x: this.capsule.x + BRICK_WIDTH / 2, y: this.capsule.y + CAPSULE_HEIGHT / 2, vx: 0, vy: 0, stuck: false, offset: 0 },
      this.paddleRect,
    );
    if (caught) {
      this.applyCapsule(this.capsule.kind);
      this.capsule = null;
    } else if (this.capsule.y > HEIGHT) {
      this.capsule = null;
    }
  }

  // Each power-up replaces the previous one (an extra life aside).
  private applyCapsule(kind: CapsuleKind): void {
    if (kind === 'P') {
      this.lives += 1;
      return;
    }
    if (this.effect === 'catch') this.launch();
    this.effect = null;
    this.resizePaddle(PADDLE_WIDTH);

    if (kind === 'E') {
      this.effect = 'enlarge';
      this.resizePaddle(WIDE_PADDLE_WIDTH);
    }
    if (kind === 'C') this.effect = 'catch';
    if (kind === 'S') this.effect = 'slow';
    if (kind === 'D') this.splitBall();
    this.balls.filter((ball) => !ball.stuck).forEach((ball) => Object.assign(ball, withSpeed(ball, this.ballSpeed())));
  }

  // Keeps the paddle's centre, within the walls.
  private resizePaddle(width: number): void {
    const centre = this.paddle.x + this.paddle.width / 2;
    this.paddle = { x: Math.min(Math.max(centre - width / 2, 0), WIDTH - width), width };
  }

  // Disruption: the ball splits into three, fanned out by ±20°.
  private splitBall(): void {
    const ball = this.balls.find((b) => !b.stuck);
    if (!ball) return;
    this.balls.push(
      { ...ball, ...rotate(ball, MULTI_BALL_ANGLE) },
      { ...ball, ...rotate(ball, -MULTI_BALL_ANGLE) },
    );
  }
}

const POWER_UPS_OPTION = onOff('powerups', 'Power-ups');

export const arkanoidGame: GameDefinition = {
  id: 'arkanoid',
  options: [levelOption, POWER_UPS_OPTION],
  create: (settings) => new Arkanoid({ firstLevel: levelFrom(settings), powerUps: isOn(settings, POWER_UPS_OPTION) }),
};
