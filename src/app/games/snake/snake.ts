import {
  applyFields, ARROW_DIRECTIONS, directionName, emptyGrid, levelFrom, levelOption, levelSpeed, pickFields,
  randomFreeCell, RIGHT, samePoint, setCell,
  type Game, type GameDefinition, type Grid, type Point, type Random, type Snapshot,
} from '../game.js';

const SIZE = 21;
const BASE_SPEED = 250;
const FOOD_POINTS = 10;

// Score needed to leave a level: 100, then +200, +300… (100, 300, 600, 1000…).
const levelThreshold = (level: number) => 100 * level * (level + 1) / 2;

// What a save keeps (held keys and the random source never are).
const SAVED_FIELDS = ['body', 'direction', 'food', 'score', 'level', 'isOver', '_turned'];

export class Snake implements Game {
  readonly id = 'snake';
  readonly title = 'Snake';
  readonly width = SIZE;
  readonly height = SIZE;

  score = 0;
  level = 1;
  isOver = false;
  // body[0] is the head.
  body: Point[] = [];
  direction: Point = RIGHT;
  food: Point | null = null;
  // Only one turn per tick, so two quick keys can't reverse the snake onto itself.
  private _turned = false;

  constructor(private readonly random: Random = Math.random, private readonly firstLevel = 1) {
    this.reset();
  }

  reset(): void {
    const middle = Math.floor(SIZE / 2);
    this.score = 0;
    this.level = this.firstLevel;
    this.isOver = false;
    this.body = [{ x: middle, y: middle }];
    this.direction = RIGHT;
    this._turned = false;
    this.spawnFood();
  }

  tick(): void {
    if (this.isOver) return;
    this._turned = false;

    const head = { x: this.head.x + this.direction.x, y: this.head.y + this.direction.y };
    const eats = this.food !== null && samePoint(head, this.food);
    // The tail moves away this tick unless the snake grows.
    const obstacles = eats ? this.body : this.body.slice(0, -1);

    if (!this.isInside(head) || obstacles.some(part => samePoint(part, head))) {
      this.isOver = true;
      return;
    }

    this.body = [head, ...obstacles];
    if (eats) this.eat();
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
    if (!next || this._turned || this.isOver) return;
    // Turning is only allowed onto the other axis.
    const sameAxis = (next.x !== 0) === (this.direction.x !== 0);
    if (sameAxis) return;
    this.direction = next;
    this._turned = true;
  }

  cells(): Grid {
    const grid = emptyGrid(SIZE, SIZE);
    if (this.food) setCell(grid, this.food.x, this.food.y, 'food');
    this.body.forEach(({ x, y }, i) => {
      setCell(grid, x, y, i === 0 ? `snake-head-${directionName(this.direction)}` : 'snake');
    });
    return grid;
  }

  private eat(): void {
    this.score += FOOD_POINTS * this.level;
    while (this.score >= levelThreshold(this.level)) this.level += 1;
    this.spawnFood();
  }

  private spawnFood(): void {
    const grid = emptyGrid(SIZE, SIZE);
    this.body.forEach(({ x, y }) => setCell(grid, x, y, 'snake'));
    this.food = randomFreeCell(grid, this.random);
    // No room left: the board is full.
    if (!this.food) this.isOver = true;
  }

  get head(): Point {
    return this.body[0]!;
  }

  private isInside({ x, y }: Point): boolean {
    return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
  }
}

export const snakeGame: GameDefinition = {
  id: 'snake',
  options: [levelOption],
  create: (settings) => new Snake(Math.random, levelFrom(settings)),
};
