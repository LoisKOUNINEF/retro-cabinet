import type { Point } from '../game.js';

// Legend:
//   #  wall          .  pellet        o  power pellet      (space) empty floor
//   -  ghost door    _  outside the maze (drawn empty, never walkable)
//   P  runner start  1-4  chaser, ambusher, flanker, wanderer starts (1 sits just above the door)
//   F  where the bonus prize appears (floor, below the ghost house)
// A row whose two edge cells are floor is a wraparound tunnel.

export const COMPACT = [
  '###################',
  '#........#........#',
  '#o##.###.#.###.##o#',
  '#.................#',
  '#.##.#.#####.#.##.#',
  '#....#...#...#....#',
  '####.### # ###.####',
  '####.#   1   #.####',
  '####.# ##-## #.####',
  '    .  #234#  .    ',
  '####.# ##### #.####',
  '####.#   F   #.####',
  '####.# ##### #.####',
  '#........#........#',
  '#.##.###.#.###.##.#',
  '#o.#.....P.....#.o#',
  '##.#.#.#####.#.#.##',
  '#....#...#...#....#',
  '#.######.#.######.#',
  '#.................#',
  '###################',
];

export const ARCADE = [
  '############################',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#o####.#####.##.#####.####o#',
  '#.####.#####.##.#####.####.#',
  '#..........................#',
  '#.####.##.########.##.####.#',
  '#.####.##.########.##.####.#',
  '#......##....##....##......#',
  '######.##### ## #####.######',
  '_____#.##### ## #####.#_____',
  '_____#.##    1     ##.#_____',
  '_____#.## ###--### ##.#_____',
  '######.## #      # ##.######',
  '      .   # 32 4 #   .      ',
  '######.## #      # ##.######',
  '_____#.## ######## ##.#_____',
  '_____#.##    F     ##.#_____',
  '_____#.## ######## ##.#_____',
  '######.## ######## ##.######',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#.####.#####.##.#####.####.#',
  '#o..##.......P .......##..o#',
  '###.##.##.########.##.##.###',
  '###.##.##.########.##.##.###',
  '#......##....##....##......#',
  '#.##########.##.##########.#',
  '#.##########.##.##########.#',
  '#..........................#',
  '############################',
];

export type GhostName = 'chaser' | 'ambusher' | 'flanker' | 'wanderer';
export const GHOST_NAMES: GhostName[] = ['chaser', 'ambusher', 'flanker', 'wanderer'];

export type Tile = 'wall' | 'door' | 'void' | 'floor';

export interface Maze {
  width: number;
  height: number;
  tiles: Tile[][];
  // 'pellet' | 'power' | null, per cell, as laid out.
  pellets: (string | null)[][];
  runnerStart: Point;
  prizeSpot: Point;
  ghostStarts: Record<GhostName, Point>;
  // Tunnel cells: a wraparound row's floor from each edge to its first pellet (ghosts slow down there).
  tunnels: boolean[][];
}

const TILES: Record<string, Tile> = { '#': 'wall', '-': 'door', '_': 'void' };
const PELLETS: Record<string, string> = { '.': 'pellet', 'o': 'power' };

export function parseMaze(layout: string[]): Maze {
  const ghostStarts: Partial<Record<GhostName, Point>> = {};
  let runnerStart: Point = { x: 0, y: 0 };
  let prizeSpot: Point = { x: 0, y: 0 };

  layout.forEach((row, y) => [...row].forEach((char, x) => {
    if (char === 'P') runnerStart = { x, y };
    if (char === 'F') prizeSpot = { x, y };
    const ghost = GHOST_NAMES[Number(char) - 1];
    if (ghost) ghostStarts[ghost] = { x, y };
  }));

  return {
    width: layout[0]?.length ?? 0,
    height: layout.length,
    tiles: layout.map((row) => [...row].map((char) => TILES[char] ?? 'floor')),
    pellets: layout.map((row) => [...row].map((char) => PELLETS[char] ?? null)),
    runnerStart,
    prizeSpot,
    ghostStarts: ghostStarts as Record<GhostName, Point>,
    tunnels: layout.map(tunnelCells),
  };
}

// A row whose two edge cells are floor wraps around: its tunnel runs in from each
// edge over plain floor (no wall, no pellet).
function tunnelCells(row: string): boolean[] {
  const cells = [...row].map(() => false);
  const isOpen = (char: string | undefined) => char === ' ';
  if (!isOpen(row[0]) || !isOpen(row[row.length - 1])) return cells;
  for (let x = 0; isOpen(row[x]); x++) cells[x] = true;
  for (let x = row.length - 1; isOpen(row[x]); x--) cells[x] = true;
  return cells;
}

export function isTunnel(maze: Maze, { x, y }: Point): boolean {
  return maze.tunnels[y]?.[x] ?? false;
}

// Ghosts and the runner both walk on floor only: the door is never crossed
// (ghosts leave the house by being placed on the chaser's start tile).
export function isWalkable(maze: Maze, { x, y }: Point): boolean {
  return maze.tiles[y]?.[x] === 'floor';
}

// One step in a direction, wrapping around through tunnels.
export function stepFrom(maze: Maze, { x, y }: Point, direction: Point): Point {
  return { x: (x + direction.x + maze.width) % maze.width, y: y + direction.y };
}
