// Legend: '.' empty; w o c g r b p y = white, orange, cyan, green, red, blue, pink, yellow;
// 's' silver (several hits), 'G' gold (indestructible). 13 bricks per row.
export const COLUMNS = 13;
// Empty rows above each layout, so the ball has room to bounce back.
export const TOP_ROWS = 3;

// Field geometry, in logical units (the canvas scales them).
export const BRICK_WIDTH = 16;
export const BRICK_HEIGHT = 8;
export const WIDTH = COLUMNS * BRICK_WIDTH;
export const HEIGHT = 240;
export const PADDLE_Y = 224;
export const PADDLE_HEIGHT = 6;
export const CAPSULE_HEIGHT = 7;

export type BrickKind = 'w' | 'o' | 'c' | 'g' | 'r' | 'b' | 'p' | 'y' | 's' | 'G';

export const BRICK_KINDS: BrickKind[] = ['w', 'o', 'c', 'g', 'r', 'b', 'p', 'y', 's', 'G'];

// Arcade values. Silver is worth 50 × round, gold nothing.
export const BRICK_POINTS: Record<BrickKind, number> = {
  w: 50, o: 60, c: 70, g: 80, r: 90, b: 100, p: 110, y: 120, s: 50, G: 0,
};

export const LAYOUTS: string[][] = [
  // 1. The classic wall.
  [
    'sssssssssssss',
    'rrrrrrrrrrrrr',
    'yyyyyyyyyyyyy',
    'bbbbbbbbbbbbb',
    'ppppppppppppp',
    'ggggggggggggg',
  ],
  // 2. Staircase.
  [
    'w............',
    'wo...........',
    'woc..........',
    'wocg.........',
    'wocgr........',
    'wocgrb.......',
    'wocgrbp......',
    'wocgrbpy.....',
    'wocgrbpyw....',
    'wocgrbpywo...',
    'wocgrbpywoc..',
    'wocgrbpywocg.',
    'ssssssssssssr',
  ],
  // 3. Gold barriers.
  [
    'ggggggggggggg',
    '.............',
    'wwwGGGGGGGGGG',
    '.............',
    'rrrrrrrrrrrrr',
    '.............',
    'GGGGGGGGGGwww',
    '.............',
    'bbbbbbbbbbbbb',
  ],
  // 4. Columns.
  [
    '.o.c.g.r.b.p.',
    '.o.c.g.r.b.p.',
    '.s.s.s.s.s.s.',
    '.o.c.g.r.b.p.',
    '.o.c.g.r.b.p.',
    '.y.w.y.w.y.w.',
    '.y.w.y.w.y.w.',
  ],
  // 5. Invader.
  [
    '...s.....s...',
    '....s...s....',
    '...wwwwwww...',
    '..wwrwwwrww..',
    '.wwwwwwwwwww.',
    '.w.wwwwwww.w.',
    '.w.w.....w.w.',
    '....ww.ww....',
    'GGG.......GGG',
  ],
];
