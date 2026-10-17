import { chaseTarget, chooseDirection, scatterTarget } from '#root/dist/src/app/games/pacman/ghosts.js';
import { COMPACT, parseMaze } from '#root/dist/src/app/games/pacman/mazes.js';

const UP = { x: 0, y: -1 };
const DOWN = { x: 0, y: 1 };
const LEFT = { x: -1, y: 0 };
const RIGHT = { x: 1, y: 0 };

const maze = parseMaze(COMPACT);
const blinky = { x: 9, y: 7 };

describe('Pacman ghosts', () => {
  it('Blinky targets Pacman', () => {
    const pacman = { position: { x: 9, y: 15 }, direction: LEFT };
    expect(chaseTarget('blinky', blinky, pacman, blinky, maze)).toEqual({ x: 9, y: 15 });
  });

  it('Pinky targets 4 tiles ahead of Pacman', () => {
    const pacman = { position: { x: 9, y: 15 }, direction: LEFT };
    expect(chaseTarget('pinky', { x: 9, y: 9 }, pacman, blinky, maze)).toEqual({ x: 5, y: 15 });
  });

  it('Inky doubles the vector from Blinky to 2 tiles ahead of Pacman', () => {
    const pacman = { position: { x: 9, y: 15 }, direction: UP };
    // 2 ahead is (9, 13); Blinky at (9, 7) → (9, 13) + (0, 6).
    expect(chaseTarget('inky', { x: 8, y: 9 }, pacman, blinky, maze)).toEqual({ x: 9, y: 19 });
  });

  it('Clyde chases from afar and retreats to his corner when close', () => {
    const pacman = { position: { x: 9, y: 15 }, direction: LEFT };
    expect(chaseTarget('clyde', { x: 9, y: 1 }, pacman, blinky, maze)).toEqual({ x: 9, y: 15 });
    expect(chaseTarget('clyde', { x: 9, y: 13 }, pacman, blinky, maze)).toEqual(scatterTarget('clyde', maze));
  });

  it('scatters each ghost to its own corner, outside the maze', () => {
    expect(scatterTarget('blinky', maze)).toEqual({ x: 16, y: -3 });
    expect(scatterTarget('pinky', maze)).toEqual({ x: 2, y: -3 });
    expect(scatterTarget('inky', maze)).toEqual({ x: 18, y: 21 });
    expect(scatterTarget('clyde', maze)).toEqual({ x: 0, y: 21 });
  });

  it('never reverses, even towards a target behind', () => {
    const ghost = { position: { x: 2, y: 1 }, direction: RIGHT };
    expect(chooseDirection(maze, ghost, { x: 0, y: 1 }, () => 0)).toEqual(RIGHT);
  });

  it('takes the open direction closest to the target', () => {
    // (4, 3) is a junction: up, down and right are open.
    const ghost = { position: { x: 4, y: 3 }, direction: RIGHT };
    expect(chooseDirection(maze, ghost, { x: 4, y: 0 }, () => 0)).toEqual(UP);
    expect(chooseDirection(maze, ghost, { x: 4, y: 20 }, () => 0)).toEqual(DOWN);
    expect(chooseDirection(maze, ghost, { x: 15, y: 3 }, () => 0)).toEqual(RIGHT);
  });

  it('breaks ties in the order up, left, down, right', () => {
    const ghost = { position: { x: 4, y: 3 }, direction: RIGHT };
    // Up (4, 2) and down (4, 4) are equally far from (0, 3).
    expect(chooseDirection(maze, ghost, { x: 0, y: 3 }, () => 0)).toEqual(UP);
  });

  it('picks a random open direction when frightened', () => {
    const ghost = { position: { x: 4, y: 3 }, direction: RIGHT };
    // Choices, in priority order: up, down, right.
    expect(chooseDirection(maze, ghost, null, () => 0)).toEqual(UP);
    expect(chooseDirection(maze, ghost, null, () => 0.99)).toEqual(RIGHT);
  });
});
