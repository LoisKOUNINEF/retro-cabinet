import { drawSprite, type Sprite } from '../sprites.js';
import type { Frogger } from './frogger.js';
import {
  BAYS, DIVE_WARNING_MS, HEIGHT, HUD_Y, LANES, MEDIAN_ROW, START_ROW, TILE, TIME_LIMIT, WIDTH, isRiver, type LaneKind,
} from './field.js';

const WATER = '#000047';
const ROAD = '#000000';
const VERGE = '#5a288c';
const HEDGE = '#1e8c28';
const FROG = '#3cd23c';
const LADY = '#ff7ac8';
const LOG = '#8c5a28';
const LOG_BARK = '#5a3214';
const TURTLE = '#e03c3c';
const TURTLE_SINKING = '#7a2020';
const FLY = '#c8c8ff';
const PUPILS = '#000000';
const SPLAT = '#ffffff';
const VEHICLE_COLOURS: Partial<Record<LaneKind, string>> = {
  car: '#e0d020',
  bulldozer: '#3cd23c',
  racer: '#ffffff',
  truck: '#e6e6e6',
};
const WHEELS = '#c83cc8';
const CROCODILE = '#2e9a2e';
const CROCODILE_DARK = '#1a5a1a';
const CROCODILE_EYE = '#f0e040';
const SNAKE = '#c8a03c';
const SNAKE_STRIPES = '#6a4a14';
const SNAKE_HEAD = '#e8c860';
const OTTER = '#d08850';

// The river crocodile's head, swimming right: jaws shut, then open.
const CROCODILE_HEAD_SHUT: Sprite = [
  '##########......',
  '############....',
  '##############..',
  '###############.',
  '################',
  '###############.',
  '############....',
  '##########......',
];
const CROCODILE_HEAD_OPEN: Sprite = [
  '##########.#.#..',
  '############....',
  '#########.......',
  '########........',
  '########........',
  '#########.......',
  '############....',
  '##########.#.#..',
];

// The bay crocodile: its eyes while it peeks, then its whole head, teeth out.
const BAY_CROCODILE_EYES: Sprite = [
  '.###......###.',
  '#####....#####',
  '#####....#####',
];
// Its yellow eyes, over either sprite.
const BAY_CROCODILE_PUPILS: Sprite = [
  '..............',
  '.##........##.',
];
const BAY_CROCODILE_HEAD: Sprite = [
  '.##........##.',
  '####......####',
  '##############',
  '##############',
  '#.#.#.#.#.#.#.',
  '..............',
  '.#.#.#.#.#.#.#',
  '##############',
];

// Facing right; mirrored when it swims left.
const OTTER_SPRITE: Sprite = [
  '...........###.',
  '......#########',
  '..############.',
  '.###########...',
  '###.#.....#.#..',
];
const OTTER_LEFT = OTTER_SPRITE.map((row) => [...row].reverse().join(''));

// Facing up; the other facings are rotations of it. Seen from above: bulging eyes,
// a round body, front legs forward and the big back legs folded on each side.
export const FROG_SPRITE: Sprite = [
  '..##....##..',
  '.####..####.',
  '.##########.',
  '#.########.#',
  '##.######.##',
  '..########..',
  '.##########.',
  '.##########.',
  '###.####.###',
  '##..####..##',
  '#....##....#',
  '##........##',
];

// The pupils, drawn over the eyes.
const FROG_EYES: Sprite = [
  '............',
  '..#......#..',
];

const SPLAT_SPRITE: Sprite = [
  '#....##....#',
  '.#...##...#.',
  '..#.####.#..',
  '...######...',
  '..########..',
  '############',
  '############',
  '..########..',
  '...######...',
  '..#.####.#..',
  '.#...##...#.',
  '#....##....#',
];

const TURTLE_SPRITE: Sprite = [
  '....####....',
  '...######...',
  '.##########.',
  '############',
  '.##########.',
  '..########..',
  '.##......##.',
];

const FLY_SPRITE: Sprite = [
  '#......#',
  '##....##',
  '.######.',
  '..####..',
  '.######.',
  '..####..',
];

// Clockwise quarter turn.
const turn = (sprite: Sprite): Sprite =>
  [...(sprite[0] ?? '')].map((_, x) => sprite.map((row) => row[x]).reverse().join(''));

// The sprite turned to each facing, eyes included.
const facings = (sprite: Sprite): Record<string, Sprite> => ({
  up: sprite,
  right: turn(sprite),
  down: turn(turn(sprite)),
  left: turn(turn(turn(sprite))),
});
const FROG_FACINGS = facings(FROG_SPRITE);
// Eyes padded to the frog's size, so they turn around the same centre.
const EYES_FACINGS = facings([...FROG_EYES, ...Array(FROG_SPRITE.length - FROG_EYES.length).fill('.'.repeat(12))]);

// A 12px sprite centred in its 16px tile.
const PAD = (TILE - 12) / 2;

// Pure rendering of the game state: no rules in here.
export function drawFrogger(ctx: CanvasRenderingContext2D, game: Frogger): void {
  drawScenery(ctx, game);
  LANES.forEach((lane, i) => game.laneRects(i).forEach(({ rect, object }) => {
    if (game.isCrocodile(object)) return drawCrocodile(ctx, rect.x, rect.y, rect.width, game.jawsOpen);
    if (lane.kind === 'log') return drawLog(ctx, rect.x, rect.y, rect.width);
    if (lane.kind === 'turtle') {
      if (game.isUnderWater(object)) return;
      const sinking = game.isDiving(object) && game.divePhase >= DIVE_WARNING_MS;
      for (let x = rect.x; x < rect.x + rect.width; x += TILE) {
        drawSprite(ctx, TURTLE_SPRITE, x + PAD, rect.y + 4, sinking ? TURTLE_SINKING : TURTLE);
      }
      return;
    }
    drawVehicle(ctx, lane.kind, rect.x, rect.y, rect.width, lane.direction);
  }));

  drawHazards(ctx, game);
  const lady = game.ladyRect;
  if (lady) drawFrog(ctx, 'up', lady.x, lady.y, LADY);

  const { x, y } = game.frogPosition;
  if (game.dyingMs > 0) drawSprite(ctx, SPLAT_SPRITE, x + PAD, y + PAD, SPLAT);
  else if (!game.isOver) drawFrog(ctx, game.frog.facing, x, y, game.ladyOnBack ? LADY : FROG);

  drawHud(ctx, game);
}

// A green back with ridges, and the head at the front (row 1 swims right).
function drawCrocodile(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, jawsOpen: boolean): void {
  const head = x + width - TILE;
  ctx.fillStyle = CROCODILE;
  ctx.fillRect(x + 1, y + 4, width - TILE - 1, TILE - 8);
  ctx.fillStyle = CROCODILE_DARK;
  for (let ridge = x + 4; ridge < head - 2; ridge += 6) ctx.fillRect(ridge, y + 3, 3, 2);
  drawSprite(ctx, jawsOpen ? CROCODILE_HEAD_OPEN : CROCODILE_HEAD_SHUT, head, y + 4, CROCODILE);
  ctx.fillStyle = CROCODILE_EYE;
  ctx.fillRect(head + 4, y + 5, 2, 2);
}

// The bay crocodile, the snakes and the otter.
function drawHazards(ctx: CanvasRenderingContext2D, game: Frogger): void {
  const crocodile = game.bayCrocodile;
  const bay = crocodile && BAYS[crocodile.bay];
  if (bay) {
    const sprite = game.bayCrocodileOut ? BAY_CROCODILE_HEAD : BAY_CROCODILE_EYES;
    const x = bay.x + (bay.width - 14) / 2;
    drawSprite(ctx, sprite, x, bay.y + 5, CROCODILE);
    drawSprite(ctx, BAY_CROCODILE_PUPILS, x, bay.y + 5, CROCODILE_EYE);
  }

  game.snakeRects.forEach(({ head, tail }) => {
    ctx.fillStyle = SNAKE;
    ctx.fillRect(tail.x, tail.y + 6, TILE, 4);
    ctx.fillStyle = SNAKE_STRIPES;
    for (let stripe = tail.x + 2; stripe < tail.x + TILE; stripe += 5) ctx.fillRect(stripe, tail.y + 6, 2, 4);
    ctx.fillStyle = SNAKE_HEAD;
    ctx.fillRect(head.x + 2, head.y + 5, TILE - 4, 6);
    ctx.fillStyle = PUPILS;
    ctx.fillRect(head.x < tail.x ? head.x + 4 : head.x + TILE - 6, head.y + 6, 2, 2);
  });

  const otter = game.otterRect;
  if (otter) drawSprite(ctx, game.otter?.direction === -1 ? OTTER_LEFT : OTTER_SPRITE, otter.x + 1, otter.y + 6, OTTER);
}

function drawFrog(ctx: CanvasRenderingContext2D, facing: string, x: number, y: number, colour: string): void {
  drawSprite(ctx, FROG_FACINGS[facing] ?? FROG_SPRITE, x + PAD, y + PAD, colour);
  drawSprite(ctx, EYES_FACINGS[facing] ?? FROG_EYES, x + PAD, y + PAD, PUPILS);
}

function drawScenery(ctx: CanvasRenderingContext2D, game: Frogger): void {
  ctx.fillStyle = WATER;
  ctx.fillRect(0, 0, WIDTH, MEDIAN_ROW * TILE);
  ctx.fillStyle = ROAD;
  ctx.fillRect(0, MEDIAN_ROW * TILE, WIDTH, HEIGHT - MEDIAN_ROW * TILE);
  ctx.fillStyle = VERGE;
  [MEDIAN_ROW, START_ROW].forEach((row) => ctx.fillRect(0, row * TILE, WIDTH, TILE));

  // The hedge, with its five bays (a frog in each filled one, the fly in its own).
  ctx.fillStyle = HEDGE;
  ctx.fillRect(0, 0, WIDTH, TILE);
  BAYS.forEach((bay, i) => {
    ctx.fillStyle = WATER;
    ctx.fillRect(bay.x, bay.y + 4, bay.width, bay.height - 4);
    const x = bay.x + (bay.width - 12) / 2;
    if (game.homes[i]) drawFrog(ctx, 'up', x - PAD, bay.y, FROG);
    else if (game.fly?.bay === i) drawSprite(ctx, FLY_SPRITE, bay.x + (bay.width - 8) / 2, bay.y + 6, FLY);
  });
}

function drawLog(ctx: CanvasRenderingContext2D, x: number, y: number, width: number): void {
  ctx.fillStyle = LOG;
  ctx.fillRect(x + 1, y + 3, width - 2, TILE - 6);
  ctx.fillStyle = LOG_BARK;
  for (let bark = x + 6; bark < x + width - 4; bark += 8) ctx.fillRect(bark, y + 6, 3, 1);
  ctx.fillRect(x + width - 3, y + 4, 2, TILE - 8);
}

// A body with four wheels; trucks get a cab at the front.
function drawVehicle(ctx: CanvasRenderingContext2D, kind: LaneKind, x: number, y: number, width: number, direction: 1 | -1): void {
  if (isRiver(kind)) return;
  ctx.fillStyle = WHEELS;
  [x + 2, x + width - 5].forEach((wheel) => {
    ctx.fillRect(wheel, y + 2, 3, 2);
    ctx.fillRect(wheel, y + TILE - 4, 3, 2);
  });
  ctx.fillStyle = VEHICLE_COLOURS[kind] ?? '#ffffff';
  ctx.fillRect(x + 1, y + 4, width - 2, TILE - 8);
  if (kind === 'truck') {
    const cab = direction === 1 ? x + width - 6 : x + 1;
    ctx.fillStyle = '#e03c3c';
    ctx.fillRect(cab, y + 4, 5, TILE - 8);
  }
  if (kind === 'racer') {
    ctx.fillStyle = '#e03c3c';
    ctx.fillRect(x + 3, y + 7, width - 6, 2);
  }
}

// Lives as small frogs on the left; with the time limit, the time bar on the right.
function drawHud(ctx: CanvasRenderingContext2D, game: Frogger): void {
  ctx.fillStyle = FROG;
  for (let i = 0; i < Math.min(game.lives - 1, 6); i++) ctx.fillRect(4 + i * 8, HUD_Y + 5, 6, 6);
  if (!game.hasTimeLimit) return;

  const full = WIDTH / 2;
  const left = Math.max(0, game.timeLeft / TIME_LIMIT);
  ctx.fillStyle = game.timeLeft <= 10_000 ? '#e03c3c' : FROG;
  ctx.fillRect(WIDTH - 4 - full * left, HUD_Y + 5, full * left, 6);
}
