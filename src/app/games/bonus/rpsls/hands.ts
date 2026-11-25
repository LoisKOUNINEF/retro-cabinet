import type { Sprite } from '../../sprites.js';

export const HANDS = ['rock', 'paper', 'scissors', 'lizard', 'spock'] as const;
export type Hand = typeof HANDS[number];

export const HAND_NAMES: Record<Hand, string> = { rock: 'Rock', paper: 'Paper', scissors: 'Scissors', lizard: 'Lizard', spock: 'Spock' };

// Each hand beats two others, with its verb: "Scissors cuts Paper".
export const BEATS: Record<Hand, Partial<Record<Hand, string>>> = {
  scissors: { paper: 'cuts', lizard: 'decapitates' },
  paper: { rock: 'covers', spock: 'disproves' },
  rock: { lizard: 'crushes', scissors: 'crushes' },
  lizard: { spock: 'poisons', paper: 'eats' },
  spock: { scissors: 'smashes', rock: 'vaporizes' },
};

// The winning hand of `a` against `b` and how, or null on a draw.
export function duel(a: Hand, b: Hand): { winner: Hand; line: string } | null {
  if (a === b) return null;
  const [winner, loser] = BEATS[a][b] ? [a, b] : [b, a];
  return { winner, line: `${HAND_NAMES[winner]} ${BEATS[winner][loser]} ${HAND_NAMES[loser]}` };
}

// Pixel art: one string per row, '#' is a lit pixel.
export const HAND_SPRITES: Record<Hand, Sprite> = {
  // A boulder, cracked.
  rock: [
    '....#####...',
    '..#########.',
    '.###########',
    '.#####.#####',
    '#####.######',
    '####.#######',
    '############',
    '.##########.',
    '...######...',
  ],
  // A sheet with a folded corner, written on.
  paper: [
    '######...',
    '#....##..',
    '#....#.#.',
    '#....####',
    '#.......#',
    '#.#####.#',
    '#.......#',
    '#.#####.#',
    '#.......#',
    '#.####..#',
    '#.......#',
    '#########',
  ],
  scissors: [
    '#.........#',
    '##.......##',
    '.##.....##.',
    '..##...##..',
    '...##.##...',
    '....###....',
    '.....#.....',
    '....#.#....',
    '.###...###.',
    '#..#...#..#',
    '#..#...#..#',
    '.##.....##.',
  ],
  // Seen from above, running right.
  lizard: [
    '....#.......#....',
    '.....#.....#.....',
    '.....#########.#.',
    '#################',
    '#....###########.',
    '.....#.....#.....',
    '....#.......#....',
  ],
  // The Vulcan salute.
  spock: [
    '.##.##..##.##',
    '.##.##..##.##',
    '.#####..#####',
    '.#####..#####',
    '.############',
    '.############',
    '#############',
    '##.##########',
    '#..##########',
    '...#########.',
    '....#######..',
    '....#######..',
  ],
};
