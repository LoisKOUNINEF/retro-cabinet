import { ARCADE, COMPACT, GHOST_NAMES, isTunnel, isWalkable, parseMaze, stepFrom } from '#root/dist/src/app/games/pacman/mazes.js';

const DIRECTIONS = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
const key = ({ x, y }) => `${x},${y}`;

// Every floor tile Pacman can reach from his start.
const reachable = (maze) => {
  const seen = new Set([key(maze.pacmanStart)]);
  const queue = [maze.pacmanStart];
  while (queue.length) {
    const tile = queue.shift();
    DIRECTIONS.forEach((direction) => {
      const next = stepFrom(maze, tile, direction);
      if (isWalkable(maze, next) && !seen.has(key(next))) {
        seen.add(key(next));
        queue.push(next);
      }
    });
  }
  return seen;
};

const count = (layout, char) => layout.join('').split(char).length - 1;

describe('Pacman mazes', () => {
  [['compact', COMPACT, 19, 21], ['arcade', ARCADE, 28, 31]].forEach(([name, layout, width, height]) => {
    it(`${name}: is ${width}×${height} with every row the same width`, () => {
      const maze = parseMaze(layout);
      expect(maze.width).toBe(width);
      expect(maze.height).toBe(height);
      layout.forEach((row) => expect(row.length).toBe(width));
    });

    it(`${name}: has one Pacman and one start per ghost`, () => {
      expect(count(layout, 'P')).toBe(1);
      ['1', '2', '3', '4'].forEach((char) => expect(count(layout, char)).toBe(1));
      const maze = parseMaze(layout);
      GHOST_NAMES.forEach((ghost) => expect(maze.ghostStarts[ghost]).toBeDefined());
    });

    it(`${name}: every pellet and the ghost exit are reachable`, () => {
      const maze = parseMaze(layout);
      const seen = reachable(maze);

      maze.pellets.forEach((row, y) => row.forEach((pellet, x) => {
        if (pellet) expect(seen.has(key({ x, y }))).toBeTruthy();
      }));
      expect(seen.has(key(maze.ghostStarts.blinky))).toBeTruthy();
    });
  });

  it('wraps through tunnels and keeps door and outside cells unwalkable', () => {
    const maze = parseMaze(COMPACT);
    expect(stepFrom(maze, { x: 0, y: 9 }, { x: -1, y: 0 })).toEqual({ x: 18, y: 9 });
    expect(isWalkable(maze, { x: 9, y: 8 })).toBeFalsy();

    const arcade = parseMaze(ARCADE);
    expect(isWalkable(arcade, { x: 0, y: 10 })).toBeFalsy();
  });

  it('marks the tunnels: wraparound floor from each edge to the first pellet', () => {
    const maze = parseMaze(COMPACT);
    expect([0, 3, 15, 18].every((x) => isTunnel(maze, { x, y: 9 }))).toBeTruthy();
    expect(isTunnel(maze, { x: 4, y: 9 })).toBeFalsy();
    expect(isTunnel(maze, { x: 6, y: 9 })).toBeFalsy();
    expect(isTunnel(maze, { x: 0, y: 1 })).toBeFalsy();

    const arcade = parseMaze(ARCADE);
    expect(isTunnel(arcade, { x: 5, y: 14 })).toBeTruthy();
    expect(isTunnel(arcade, { x: 22, y: 14 })).toBeTruthy();
    expect(isTunnel(arcade, { x: 6, y: 14 })).toBeFalsy();
  });
});
