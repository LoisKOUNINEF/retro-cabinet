import {
  applyFields, cryptoRandom, ARROW_DIRECTIONS, directionName, emptyGrid, isOn, levelFrom, levelOption, levelSpeed, onOff,
  pickFields, quarterTurn, randomFreeCell, RIGHT, samePoint, setCell, SAVE_VERSION,
  type GridGame, type GameDefinition, type Grid, type MouseButton, type Point, type Random, type Snapshot, type TouchLayout,
  ARROW_CODES,
  type KeyHint,
} from '../game.js';

const SIZE = 21;
const BASE_SPEED = 250;
const FOOD_POINTS = 10;

// Bonus food (when the option is on): after an apple, sometimes one of these appears for a while.
const BONUS_CHANCE = 1 / 4;
// Moves a bonus stays on the board; it blinks during the last ones.
export const BONUS_TICKS = 50;
export const BONUS_ENDING_TICKS = 15;
// The golden apple is worth this many apples (and grows the snake like one).
const GOLDEN_MULTIPLIER = 5;
// Segments the shrink berry cuts off the tail.
const SHRINK_LENGTH = 3;

export type BonusKind = 'golden' | 'shrink';

export interface Bonus extends Point {
  kind: BonusKind;
  // Moves left before it disappears.
  ticksLeft: number;
}

// Score needed to leave a level: 100, then +200, +300… (100, 300, 600, 1000…).
const levelThreshold = (level: number) => 100 * level * (level + 1) / 2;

// What a save keeps (held keys and the random source never are).
const SAVED_FIELDS = ['body', 'direction', 'heading', 'food', 'bonus', 'score', 'level', 'isOver', '_turned'];

export interface SnakeOptions {
  firstLevel?: number;
  bonuses?: boolean;
  random?: Random;
}

export class Snake implements GridGame {
  get rules(): string[] {
    return [
      'Goal: eat apples and grow as long as you can.',
      'Apples score 10 x level.',
      'Hitting a wall or yourself ends the game.',
      ...(this.bonuses ? ['Golden apples score 50 x level; berries cut 3 off your tail. Both vanish after a while.'] : []),
      'The level rises with the score: the snake speeds up.',
    ];
  }

  readonly keyHints: KeyHint[] = [{ action: 'Turn', codes: ARROW_CODES }];
  readonly kind = 'grid';
  readonly id = 'snake';
  readonly title = 'Snake';
  readonly width = SIZE;
  readonly height = SIZE;
  // The only game on the stick: steering suits it better than D-pad taps.
  readonly touch: TouchLayout = { pad: 'stick', directions: ['up', 'down', 'left', 'right'] };
  readonly mouseHint = 'Mouse: left click turns left, right click turns right';

  score = 0;
  level = 1;
  isOver = false;
  // body[0] is the head.
  body: Point[] = [];
  // Where the next move goes (changed by the arrows)…
  direction: Point = RIGHT;
  // …and where the last one went: the head is drawn facing it, so it only turns
  // when the snake actually does, not as soon as an arrow is pressed.
  heading: Point = RIGHT;
  food: Point | null = null;
  bonus: Bonus | null = null;
  // Only one turn per tick, so two quick keys can't reverse the snake onto itself.
  private _turned = false;

  private readonly random: Random;
  private readonly firstLevel: number;
  private readonly bonuses: boolean;

  constructor({ firstLevel = 1, bonuses = false, random = cryptoRandom }: SnakeOptions = {}) {
    this.random = random;
    this.firstLevel = firstLevel;
    this.bonuses = bonuses;
    this.reset();
  }

  reset(): void {
    const middle = Math.floor(SIZE / 2);
    this.score = 0;
    this.level = this.firstLevel;
    this.isOver = false;
    this.body = [{ x: middle, y: middle }];
    this.direction = RIGHT;
    this.heading = RIGHT;
    this._turned = false;
    this.bonus = null;
    this.spawnFood();
  }

  tick(): void {
    if (this.isOver) return;
    this._turned = false;

    const head = { x: this.head.x + this.direction.x, y: this.head.y + this.direction.y };
    const eatsFood = this.food !== null && samePoint(head, this.food);
    const bonus = this.bonus && samePoint(head, this.bonus) ? this.bonus : null;
    // The tail moves away this tick unless the snake grows.
    const grows = eatsFood || bonus?.kind === 'golden';
    const obstacles = grows ? this.body : this.body.slice(0, -1);

    if (!this.isInside(head) || obstacles.some(part => samePoint(part, head))) {
      this.isOver = true;
      return;
    }

    this.body = [head, ...obstacles];
    this.heading = this.direction;
    if (bonus) this.eatBonus(bonus);
    else this.ageBonus();
    if (eatsFood) this.eat();
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
    const next = ARROW_DIRECTIONS[code];
    if (next) this.turn(next);
  }

  // Turns from where the snake is going: left click counter-clockwise, right click clockwise.
  handleMouseDown(button: MouseButton): void {
    this.turn(quarterTurn(this.direction, button === 'right'));
  }

  cells(): Grid {
    const grid = emptyGrid(SIZE, SIZE);
    if (this.food) setCell(grid, this.food.x, this.food.y, 'food');
    if (this.bonus) {
      const ending = this.bonus.ticksLeft <= BONUS_ENDING_TICKS ? '-ending' : '';
      setCell(grid, this.bonus.x, this.bonus.y, `bonus-${this.bonus.kind}${ending}`);
    }
    this.body.forEach(({ x, y }, i) => {
      setCell(grid, x, y, i === 0 ? `snake-head-${directionName(this.heading)}` : 'snake');
    });
    return grid;
  }

  private turn(next: Point): void {
    if (this._turned || this.isOver) return;
    // Turning is only allowed onto the other axis.
    const sameAxis = (next.x !== 0) === (this.direction.x !== 0);
    if (sameAxis) return;
    this.direction = next;
    this._turned = true;
  }

  private eat(): void {
    this.addPoints(FOOD_POINTS * this.level);
    this.spawnFood();
    if (!this.isOver) this.maybeSpawnBonus();
  }

  // Golden: the snake has already grown. Shrink: cuts the tail, always keeping the head.
  private eatBonus(bonus: Bonus): void {
    this.bonus = null;
    if (bonus.kind === 'golden') {
      this.addPoints(GOLDEN_MULTIPLIER * FOOD_POINTS * this.level);
      return;
    }
    this.body = this.body.slice(0, Math.max(1, this.body.length - SHRINK_LENGTH));
    this.addPoints(FOOD_POINTS * this.level);
  }

  private ageBonus(): void {
    if (!this.bonus) return;
    this.bonus.ticksLeft -= 1;
    if (this.bonus.ticksLeft <= 0) this.bonus = null;
  }

  private addPoints(points: number): void {
    this.score += points;
    while (this.score >= levelThreshold(this.level)) this.level += 1;
  }

  private spawnFood(): void {
    this.food = this.freeCell();
    // No room left: the board is full.
    if (!this.food) this.isOver = true;
  }

  // One bonus at a time; none when there's no room for it.
  private maybeSpawnBonus(): void {
    if (!this.bonuses || this.bonus || this.random() >= BONUS_CHANCE) return;
    const shrinkBerry = this.random() < BONUS_CHANCE;
    const kind = shrinkBerry ? 'shrink' : 'golden';
    const cell = this.freeCell();
    if (cell) this.bonus = { ...cell, kind, ticksLeft: BONUS_TICKS };
  }

  // A cell with neither the snake, the apple nor the bonus on it.
  private freeCell(): Point | null {
    const grid = emptyGrid(SIZE, SIZE);
    this.body.forEach(({ x, y }) => setCell(grid, x, y, 'snake'));
    if (this.food) setCell(grid, this.food.x, this.food.y, 'food');
    if (this.bonus) setCell(grid, this.bonus.x, this.bonus.y, 'bonus');
    return randomFreeCell(grid, this.random);
  }

  get head(): Point {
    return this.body[0]!;
  }

  private isInside({ x, y }: Point): boolean {
    return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
  }
}

const BONUS_OPTION = onOff('bonuses', 'Bonus food', true);

export const snakeGame: GameDefinition = {
  id: 'snake',
  // Saves gained the bonus field.
  saveVersion: SAVE_VERSION + 1,
  options: [levelOption, BONUS_OPTION],
  create: (settings) => new Snake({ firstLevel: levelFrom(settings), bonuses: isOn(settings, BONUS_OPTION) }),
};
