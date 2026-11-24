import { pick, type Random } from '../../game.js';
import { MISTAKE_CHANCE, type Difficulty } from '../turns.js';
import { Board, other, type Player } from './board.js';

// Easy plays a line that gives nothing away this share of the time; otherwise any line.
export const EASY_CARE = 0.3;

// The free lines that close a box (one with three sides drawn).
export function closingLines(board: Board): number[] {
  return board.freeLines().filter((line) => board.boxesOf(line).some((box) => board.sidesDrawn(box) === 3));
}

// A line that leaves no box with three sides: nothing to take for the other player.
export function isSafe(board: Board, line: number): boolean {
  return board.lines[line] === null && board.boxesOf(line).every((box) => board.sidesDrawn(box) <= 1);
}

// Takes every box there is to take, one line after the other; returns how many.
export function takeAll(board: Board, who: Player): number {
  let taken = 0;
  for (let line = closingLines(board)[0]; line !== undefined; line = closingLines(board)[0]) taken += board.draw(line, who).length;
  return taken;
}

// How many boxes the other player takes after `who` draws the line.
function giveaway(board: Board, line: number, who: Player): number {
  const next = board.clone();
  next.draw(line, who);
  return takeAll(next, other(who));
}

// A chain (boxes in a row, open at both ends) or a loop, once every line left gives boxes away.
export interface Component {
  boxes: number[];
  loop: boolean;
}

// The position's chains and loops, or null when it isn't made of them only
// (a box with three or four free sides joins several: then there's no simple count).
export function components(board: Board): Component[] | null {
  const open = board.boxes.flatMap((owner, box) => (owner === null ? [box] : []));
  if (open.some((box) => board.sidesDrawn(box) !== 2)) return null;
  const seen = new Set<number>();
  return open.flatMap((start) => {
    if (seen.has(start)) return [];
    const boxes: number[] = [];
    let loop = true;
    const queue = [start];
    seen.add(start);
    while (queue.length) {
      const box = queue.pop()!;
      boxes.push(box);
      board.sides(box).filter((line) => board.lines[line] === null).forEach((line) => {
        const across = board.boxesOf(line).find((other) => other !== box);
        // A free side on the edge of the board, or towards a taken box, can't be part of a loop.
        if (across === undefined) return void (loop = false);
        if (!seen.has(across)) {
          seen.add(across);
          queue.push(across);
        }
      });
    }
    return [{ boxes, loop }];
  });
}

// The best the player who has to open a component can do (their boxes minus the other's), when
// both play well. The other player takes the opened component whole and moves next, or takes all
// but its last 2 boxes (4 of a loop), handing those back to keep the control.
export function endgameValue(parts: readonly { size: number; loop: boolean }[], memo = new Map<string, number>()): number {
  if (!parts.length) return 0;
  const key = parts.map(({ size, loop }) => `${loop ? 'L' : 'C'}${size}`).sort().join(',');
  const known = memo.get(key);
  if (known !== undefined) return known;
  let best = -Infinity;
  parts.forEach(({ size, loop }, i) => {
    const rest = endgameValue(parts.filter((_, j) => j !== i), memo);
    const kept = loop ? 4 : 2;
    const canDecline = loop || size >= 3;
    const theirs = Math.max(size + rest, canDecline ? size - 2 * kept - rest : -Infinity);
    best = Math.max(best, -theirs);
  });
  memo.set(key, best);
  return best;
}

const sizes = (parts: Component[]) => parts.map(({ boxes, loop }) => ({ size: boxes.length, loop }));

// Hard, with boxes to take: all of them, unless handing the last 2 of a chain (4 of a loop) back
// keeps the control and pays more. Returns the line to draw.
function takeOrHandOut(board: Board, ai: Player): number {
  const closing = closingLines(board);
  const after = board.clone();
  const taken = takeAll(after, ai);
  const rest = after.freeLines().some((line) => isSafe(after, line)) ? null : components(after);
  if (rest === null) return closing[0]!;
  const handout = handoutLine(board, taken);
  // Taking the k boxes then opening something: k + V(rest). Handing them out: −k − V(rest).
  if (handout !== null && endgameValue(sizes(rest)) < -taken) return handout;
  return closing[0]!;
}

// When the boxes left to take are the last 2 of a chain, or the last 4 of a loop: the line that
// hands them over in pairs, closable by one line each.
function handoutLine(board: Board, taken: number): number | null {
  const threeSided = board.boxes.flatMap((owner, box) => (owner === null && board.sidesDrawn(box) === 3 ? [box] : []));
  const freeSide = (box: number, not?: number) => board.sides(box).find((line) => board.lines[line] === null && line !== not);
  const across = (box: number, line: number) => board.boxesOf(line).find((other) => other !== box);
  const [first] = threeSided;
  if (first === undefined) return null;
  const toSecond = freeSide(first)!;
  const second = across(first, toSecond);
  if (second === undefined || board.sidesDrawn(second) !== 2) return null;
  // A chain's last 2: the far side of the second box.
  if (taken === 2 && threeSided.length === 1) return freeSide(second, toSecond) ?? null;
  // A loop's last 4 (both ends open): the line between the middle two.
  if (taken === 4 && threeSided.length === 2) {
    const middle = freeSide(second, toSecond)!;
    const third = across(second, middle);
    return third !== undefined && board.sidesDrawn(third) === 2 ? middle : null;
  }
  return null;
}

// Nothing safe left: open the component that costs least, playing on (with Hard) how the others go.
function openComponent(board: Board, ai: Player, careful: boolean): number {
  const free = board.freeLines();
  const parts = careful ? components(board) : null;
  if (parts?.length) {
    const memo = new Map<string, number>();
    let best: { part: Component; value: number } | null = null;
    parts.forEach((part, i) => {
      const rest = endgameValue(sizes(parts.filter((_, j) => j !== i)), memo);
      const size = part.boxes.length;
      const kept = part.loop ? 4 : 2;
      const canDecline = part.loop || size >= 3;
      const value = -Math.max(size + rest, canDecline ? size - 2 * kept - rest : -Infinity);
      if (!best || value > best.value) best = { part, value };
    });
    const { part } = best!;
    const lines = free.filter((line) => board.boxesOf(line).some((box) => part.boxes.includes(box)));
    // A chain of 2 is opened in its middle: it can't be handed back.
    const middle = part.boxes.length === 2 && !part.loop ? lines.find((line) => board.boxesOf(line).length === 2 && board.boxesOf(line).every((box) => part.boxes.includes(box))) : undefined;
    return middle ?? lines[0]!;
  }
  // The fewest boxes handed over.
  const costs = free.map((line) => giveaway(board, line, ai));
  return free[costs.indexOf(Math.min(...costs))]!;
}

// The AI's next line:
// - Easy takes any box offered; otherwise a line giving nothing away now and then, any line else.
// - Medium takes every box offered, plays safe lines while there are some, then opens the
//   component handing over the fewest boxes.
// - Hard also plays the endgame for control: it hands back the last 2 boxes of a chain (4 of a
//   loop) when that pays, opens the components in the best order, and slips now and then.
export function chooseLine(board: Board, ai: Player, difficulty: Difficulty, random: Random): number {
  const free = board.freeLines();
  const closing = closingLines(board);
  const safe = free.filter((line) => isSafe(board, line));
  if (difficulty === 'easy') {
    if (closing.length) return pick(closing, random);
    return safe.length && random() < EASY_CARE ? pick(safe, random) : pick(free, random);
  }
  if (difficulty === 'hard' && closing.length) return takeOrHandOut(board, ai);
  if (closing.length) return closing[0]!;
  if (difficulty === 'hard' && random() < MISTAKE_CHANCE) return pick(free, random);
  if (safe.length) return pick(safe, random);
  return openComponent(board, ai, difficulty === 'hard');
}
