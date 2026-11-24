import { DOWN, LEFT, RIGHT, UP, pick, samePoint, type Point, type Random } from '../game.js';
import { isWalkable, stepFrom, type GhostName, type Maze } from './mazes.js';

// Arcade tie-break order when two directions are equally close to the target.
const PRIORITY = [UP, LEFT, DOWN, RIGHT];
const WANDERER_SHY_DISTANCE = 8;

export interface Mover {
  position: Point;
  direction: Point;
}

const ahead = ({ position, direction }: Mover, tiles: number): Point => ({
  x: position.x + direction.x * tiles,
  y: position.y + direction.y * tiles,
});

const distanceSquared = (a: Point, b: Point) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export const reverse = ({ x, y }: Point): Point => ({ x: -x, y: -y });

// Each ghost's home corner, just outside the maze, used in scatter mode.
export function scatterTarget(name: GhostName, maze: Maze): Point {
  const corners: Record<GhostName, Point> = {
    chaser: { x: maze.width - 3, y: -3 },
    ambusher: { x: 2, y: -3 },
    flanker: { x: maze.width - 1, y: maze.height },
    wanderer: { x: 0, y: maze.height },
  };
  return corners[name];
}

// The arcade chase rules: each ghost reads the runner differently.
export function chaseTarget(name: GhostName, ghost: Point, runner: Mover, chaser: Point, maze: Maze): Point {
  switch (name) {
    // The chaser goes straight for the runner.
    case 'chaser':
      return runner.position;
    // The ambusher ambushes 4 tiles ahead of the runner.
    case 'ambusher':
      return ahead(runner, 4);
    // The flanker doubles the vector from the chaser to 2 tiles ahead of the runner.
    case 'flanker': {
      const pivot = ahead(runner, 2);
      return { x: 2 * pivot.x - chaser.x, y: 2 * pivot.y - chaser.y };
    }
    // The wanderer chases from afar but retreats to its corner when close.
    case 'wanderer':
      return distanceSquared(ghost, runner.position) > WANDERER_SHY_DISTANCE ** 2
        ? runner.position
        : scatterTarget('wanderer', maze);
  }
}

// At each step a ghost never reverses: it takes the open direction closest to its
// target (ties go to up, left, down, right), or a random one when target is null
// (frightened). Reversing is only a fallback for a dead end.
export function chooseDirection(maze: Maze, ghost: Mover, target: Point | null, random: Random): Point {
  const open = PRIORITY.filter((direction) => isWalkable(maze, stepFrom(maze, ghost.position, direction)));
  const forward = open.filter((direction) => !samePoint(direction, reverse(ghost.direction)));
  const choices = forward.length ? forward : open;
  if (!choices.length) return ghost.direction;
  if (!target) return pick(choices, random);

  return choices.reduce((best, direction) =>
    distanceSquared(stepFrom(maze, ghost.position, direction), target)
      < distanceSquared(stepFrom(maze, ghost.position, best), target) ? direction : best);
}
