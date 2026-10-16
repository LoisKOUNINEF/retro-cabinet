import {
  applyFields, pickFields,
  type Game, type GameDefinition, type GameOption, type KeyHint, type Random, type Snapshot, type TouchLayout,
} from '../game.js';
import { drawPong } from './pong.draw.js';
import { AI_X, BALL_SIZE, HEIGHT, PADDLE_HEIGHT, PADDLE_WIDTH, PLAYER_X, WIDTH, type Ball, type Difficulty } from './field.js';

const WIN_POINTS = 11;
const POINT_SCORE = 100;
const WIN_BONUS: Record<Difficulty, number> = { easy: 500, medium: 1000, hard: 2000 };
// Units per second.
const PLAYER_SPEED = 220;
const SERVE_SPEED = 160;
const MAX_SPEED = 420;
// Each paddle hit makes the ball this much faster (reset on each serve).
const SPEED_UP = 1.05;
const SERVE_MS = 1000;
const SERVE_ANGLE = Math.PI / 6;
// Steepest return, off a paddle's end.
const MAX_RETURN_ANGLE = Math.PI / 3;
// The ball moves at most this far between collision checks: it can't skip a 4-unit paddle.
const SUBSTEP = 2;

// How each AI plays: paddle speed, aiming error, when it reacts, where it aims.
// It stays beatable because it starts late (reactionMs) and aims imperfectly: fast,
// flat shots to the corners can get past it.
export const DIFFICULTIES: Record<Difficulty, {
  speed: number;
  error: number;
  // Only once the ball is past mid-court, or as soon as it comes its way.
  reactsAt: 'midcourt' | 'incoming';
  // How long it keeps still after the player returns the ball.
  reactionMs: number;
  // Aims where the ball will arrive (wall bounces included), or at its current height.
  predicts: boolean;
  // Drifts back to the centre while the ball goes away.
  recentres: boolean;
}> = {
  easy: { speed: 110, error: 24, reactsAt: 'midcourt', reactionMs: 0, predicts: false, recentres: false },
  medium: { speed: 150, error: 22, reactsAt: 'incoming', reactionMs: 300, predicts: true, recentres: true },
  hard: { speed: 210, error: 19, reactsAt: 'incoming', reactionMs: 150, predicts: true, recentres: true },
};

const LEVELS: Difficulty[] = ['easy', 'medium', 'hard'];

// Where the ball will cross x, bouncing off the top and bottom walls on the way.
export function predictY(ball: Ball, x: number): number {
  if (ball.vx === 0) return ball.y;
  const time = (x - ball.x) / ball.vx;
  if (time < 0) return ball.y;
  // Unfold the bounces: the court's height, mirrored again and again.
  const half = BALL_SIZE / 2;
  const span = HEIGHT - BALL_SIZE;
  const folded = (((ball.y + ball.vy * time - half) % (2 * span)) + 2 * span) % (2 * span);
  return (folded <= span ? folded : 2 * span - folded) + half;
}

// Where the AI paddle heads, or null to stay where it is (`reacting`: its reaction time is over).
export function aiTarget(difficulty: Difficulty, ball: Ball, error: number, reacting = true): number | null {
  const ai = DIFFICULTIES[difficulty];
  if (ball.vx <= 0) return ai.recentres ? HEIGHT / 2 : null;
  if (!reacting) return null;
  if (ai.reactsAt === 'midcourt' && ball.x < WIDTH / 2) return null;
  return (ai.predicts ? predictY(ball, AI_X - PADDLE_WIDTH / 2) : ball.y) + error;
}

// What a save keeps (held keys and the random source never are).
const SAVED_FIELDS = [
  'ball', 'playerY', 'aiY', 'playerPoints', 'aiPoints', 'score', 'isOver', 'serveMs', 'servingTo', 'aiError', 'hits',
  'aiReactMs',
];

export interface PongOptions {
  difficulty?: Difficulty;
  random?: Random;
}

export class Pong implements Game {
  readonly id = 'pong';
  readonly title = 'Pong';
  readonly width = WIDTH;
  readonly height = HEIGHT;
  readonly realtime = true;
  readonly touch: TouchLayout = { directions: ['up', 'down'] };
  readonly keyHints: KeyHint[] = [{ action: 'Move', codes: ['ArrowUp', 'ArrowDown'] }];
  readonly difficulty: Difficulty;
  // The HUD's level is the difficulty: 1 easy, 2 medium, 3 hard.
  readonly level: number;

  score = 0;
  isOver = false;
  playerPoints = 0;
  aiPoints = 0;
  playerY = HEIGHT / 2;
  aiY = HEIGHT / 2;
  ball: Ball = { x: WIDTH / 2, y: HEIGHT / 2, vx: 0, vy: 0 };
  // Countdown before the ball is served (it waits in the centre meanwhile).
  serveMs = SERVE_MS;
  // The serve goes to whoever lost the last point; the AI receives the first one.
  servingTo: 'player' | 'ai' = 'ai';
  // The AI's aiming mistake, re-rolled for each ball heading its way.
  aiError = 0;
  // Paddle hits since the serve: each one speeds the ball up.
  hits = 0;
  // The AI's reaction time left before it starts tracking an incoming ball.
  aiReactMs = 0;
  private _held = { up: false, down: false };
  private readonly random: Random;

  constructor(options: PongOptions = {}) {
    this.difficulty = options.difficulty ?? 'medium';
    this.level = LEVELS.indexOf(this.difficulty) + 1;
    this.random = options.random ?? Math.random;
    this.reset();
  }

  reset(): void {
    this.score = 0;
    this.isOver = false;
    this.playerPoints = 0;
    this.aiPoints = 0;
    this.playerY = HEIGHT / 2;
    this.aiY = HEIGHT / 2;
    this.servingTo = 'ai';
    this.aiError = 0;
    this.prepareServe();
  }

  tick(dt: number): void {
    if (this.isOver) return;
    const seconds = dt / 1000;
    this.aiReactMs = Math.max(0, this.aiReactMs - dt);
    this.movePlayer(seconds);
    this.moveAi(seconds);

    if (this.serveMs > 0) {
      this.serveMs -= dt;
      if (this.serveMs <= 0) this.serve();
      return;
    }
    this.moveBall(seconds);
  }

  // Unused: realtime games tick on every animation frame.
  speed(): number {
    return 16;
  }

  snapshot(): Snapshot {
    return pickFields(this, SAVED_FIELDS);
  }

  restore(snapshot: Snapshot): void {
    applyFields(this, snapshot, SAVED_FIELDS);
  }

  handleKey(code: string): void {
    if (code === 'ArrowUp') this._held.up = true;
    if (code === 'ArrowDown') this._held.down = true;
  }

  handleKeyUp(code: string): void {
    if (code === 'ArrowUp') this._held.up = false;
    if (code === 'ArrowDown') this._held.down = false;
  }

  releaseKeys(): void {
    this._held = { up: false, down: false };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    drawPong(ctx, this);
  }

  stats(): Record<string, number> {
    // Shown as "You" and "Computer" (the HUD capitalises stat names).
    return { you: this.playerPoints, computer: this.aiPoints };
  }

  private movePlayer(seconds: number): void {
    const direction = Number(this._held.down) - Number(this._held.up);
    this.playerY = clampPaddle(this.playerY + direction * PLAYER_SPEED * seconds);
  }

  private moveAi(seconds: number): void {
    const target = aiTarget(this.difficulty, this.ball, this.aiError, this.aiReactMs === 0);
    if (target === null) return;
    const step = DIFFICULTIES[this.difficulty].speed * seconds;
    const gap = target - this.aiY;
    this.aiY = clampPaddle(this.aiY + Math.sign(gap) * Math.min(Math.abs(gap), step));
  }

  private prepareServe(): void {
    this.ball = { x: WIDTH / 2, y: HEIGHT / 2, vx: 0, vy: 0 };
    this.serveMs = SERVE_MS;
    this.hits = 0;
  }

  private serve(): void {
    const angle = (this.random() * 2 - 1) * SERVE_ANGLE;
    const direction = this.servingTo === 'ai' ? 1 : -1;
    this.ball.vx = direction * SERVE_SPEED * Math.cos(angle);
    this.ball.vy = SERVE_SPEED * Math.sin(angle);
    if (direction === 1) this.primeAi();
  }

  private moveBall(seconds: number): void {
    const ball = this.ball;
    const steps = Math.max(1, Math.ceil((Math.hypot(ball.vx, ball.vy) * seconds) / SUBSTEP));
    for (let i = 0; i < steps; i++) {
      ball.x += (ball.vx * seconds) / steps;
      ball.y += (ball.vy * seconds) / steps;
      this.bounceOffWalls();
      if (ball.vx < 0 && this.touchesPaddle(PLAYER_X, this.playerY)) this.returnBall(PLAYER_X, this.playerY, 1);
      if (ball.vx > 0 && this.touchesPaddle(AI_X, this.aiY)) this.returnBall(AI_X, this.aiY, -1);
      if (ball.x < -BALL_SIZE) return this.point('ai');
      if (ball.x > WIDTH + BALL_SIZE) return this.point('player');
    }
  }

  private bounceOffWalls(): void {
    const half = BALL_SIZE / 2;
    if (this.ball.y - half < 0) {
      this.ball.y = half;
      this.ball.vy = Math.abs(this.ball.vy);
    }
    if (this.ball.y + half > HEIGHT) {
      this.ball.y = HEIGHT - half;
      this.ball.vy = -Math.abs(this.ball.vy);
    }
  }

  private touchesPaddle(paddleX: number, paddleY: number): boolean {
    const reach = (PADDLE_WIDTH + BALL_SIZE) / 2;
    return Math.abs(this.ball.x - paddleX) < reach && Math.abs(this.ball.y - paddleY) < (PADDLE_HEIGHT + BALL_SIZE) / 2;
  }

  // Back across the court, faster, at an angle set by where it hit the paddle.
  private returnBall(paddleX: number, paddleY: number, direction: 1 | -1): void {
    const speed = Math.min(Math.hypot(this.ball.vx, this.ball.vy) * SPEED_UP, MAX_SPEED);
    Object.assign(this.ball, paddleReturn(this.ball.y, paddleY, speed, direction));
    this.ball.x = paddleX + direction * (PADDLE_WIDTH + BALL_SIZE) / 2;
    this.hits += 1;
    if (direction === 1) this.primeAi();
  }

  // Each ball heading the AI's way (a return or a serve) gets a fresh reaction delay and
  // aiming mistake. Re-rolling on serves too matters: after losing a point the AI receives
  // the serve, so a mistake kept from the last return would make it miss every serve.
  private primeAi(): void {
    const { error, reactionMs } = DIFFICULTIES[this.difficulty];
    this.aiError = (this.random() * 2 - 1) * error;
    this.aiReactMs = reactionMs;
  }

  private point(winner: 'player' | 'ai'): void {
    if (winner === 'player') {
      this.playerPoints += 1;
      this.score += POINT_SCORE;
    } else {
      this.aiPoints += 1;
    }
    this.servingTo = winner === 'player' ? 'ai' : 'player';

    if (this.playerPoints >= WIN_POINTS || this.aiPoints >= WIN_POINTS) {
      if (this.playerPoints >= WIN_POINTS) this.score += WIN_BONUS[this.difficulty];
      this.isOver = true;
      return;
    }
    this.prepareServe();
  }
}

// Arkanoid's paddle bounce turned sideways: flat off the centre, up to 60° off the ends.
export function paddleReturn(ballY: number, paddleY: number, speed: number, direction: 1 | -1): { vx: number; vy: number } {
  const offset = Math.min(Math.max((ballY - paddleY) / (PADDLE_HEIGHT / 2), -1), 1);
  const angle = offset * MAX_RETURN_ANGLE;
  return { vx: direction * speed * Math.cos(angle), vy: speed * Math.sin(angle) };
}

function clampPaddle(y: number): number {
  return Math.min(Math.max(y, PADDLE_HEIGHT / 2), HEIGHT - PADDLE_HEIGHT / 2);
}

export const PONG_DIFFICULTY: GameOption = {
  key: 'difficulty',
  label: 'Difficulty',
  choices: [{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }],
  defaultValue: 'medium',
};

export const pongGame: GameDefinition = {
  id: 'pong',
  options: [PONG_DIFFICULTY],
  create: (settings) => new Pong({ difficulty: (settings.difficulty as Difficulty | undefined) ?? 'medium' }),
};
