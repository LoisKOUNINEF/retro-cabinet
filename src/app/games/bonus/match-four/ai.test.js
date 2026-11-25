import { COLOUR_OPTION, MATCH_FOUR_OPTIONS, chooseColumn, evaluate } from '#root/dist/src/app/games/bonus/match-four/ai.js';
import { MISTAKE_CHANCE } from '#root/dist/src/app/games/bonus/turns.js';
import { MatchFour, freeColumns } from '#root/dist/src/app/games/bonus/match-four/rules.js';
import { defaultSettings } from '#root/dist/src/app/games/game.js';

// Rows from the top, as strings: 'r' red, 'y' yellow, '.' empty.
const board = (rows) => [...rows.join('')].map((c) => (c === 'r' ? 'red' : c === 'y' ? 'yellow' : null));
// Never slips: above MISTAKE_CHANCE, and the first of any random choice.
const steady = () => 0.99;
const EMPTY_TOP = ['.......', '.......', '.......'];

describe('Match four AI', () => {
  it('defaults to Medium, playing red, the player first', () => {
    expect(defaultSettings(MATCH_FOUR_OPTIONS)).toEqual({ difficulty: 'medium', colour: 'red', first: 'you' });
    expect(COLOUR_OPTION.choices.map((choice) => choice.label)).toEqual(['Red', 'Yellow']);
  });

  it('Easy drops in any free column', () => {
    const full = board(['r......', 'y......', 'r......', 'y......', 'r......', 'y......']);
    const columns = new Set();
    for (let r = 0; r < 1; r += 0.05) columns.add(chooseColumn(full, 'yellow', 'easy', () => r));
    expect([...columns].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  ['medium', 'hard'].forEach((difficulty) => {
    it(`${difficulty} wins when it can, and blocks the player's four`, () => {
      const winning = board([...EMPTY_TOP, '.......', 'yy.....', 'yyrrr..']);
      // Red completes its bottom row in column 5.
      expect(chooseColumn(winning, 'red', difficulty, steady)).toBe(5);

      const blocking = board([...EMPTY_TOP, '.......', '.......', 'yrrr..y']);
      expect(chooseColumn(blocking, 'yellow', difficulty, steady)).toBe(4);
    });
  });

  it('Medium won\'t drop where the player could win right on top', () => {
    // Red's three on row 2 needs (2,3), still out of reach: a disc in column 3 would land under it.
    const trap = board([
      '.......',
      '.......',
      '....rrr',
      '....yyr',
      '...ryyy',
      '..yyrry',
    ]);
    expect(chooseColumn(trap, 'yellow', 'medium', steady)).not.toBe(3);
  });

  it('Medium and Hard open in the centre', () => {
    const empty = new MatchFour().board;
    expect(chooseColumn(empty, 'red', 'medium', steady)).toBe(3);
    expect(chooseColumn(empty, 'red', 'hard', steady)).toBe(3);
  });

  it('Hard sees a win two moves ahead: an open three on the bottom row', () => {
    const open = board([...EMPTY_TOP, '.......', '.......', '..rr...']);
    // Red playing column 1 or 4 makes an open three: yellow can only block one end.
    expect([1, 4]).toContain(chooseColumn(open, 'red', 'hard', steady));
    // As yellow, it stops that open three from forming.
    expect([1, 4]).toContain(chooseColumn(open, 'yellow', 'hard', steady));
  });

  it('Hard sometimes slips to Medium tactics', () => {
    // A slip still wins or blocks, but just stays central instead of setting up the open three.
    const open = board([...EMPTY_TOP, '.......', '.......', '..rr...']);
    expect(chooseColumn(open, 'red', 'hard', () => MISTAKE_CHANCE / 2)).toBe(3);
  });

  it('never picks a full column', () => {
    const rows = board(['rrr.yyy', 'yyy.rrr', 'rrr.yyy', 'yyy.rrr', 'rrr.yyy', 'yyy.rrr']);
    ['easy', 'medium', 'hard'].forEach((difficulty) => {
      for (let r = 0; r < 1; r += 0.1) expect(chooseColumn(rows, 'red', difficulty, () => r)).toBe(3);
    });
  });

  it('Hard thinks fast enough, even on an open board', () => {
    const game = new MatchFour();
    [3, 3, 2, 4].forEach((column) => game.drop(column));
    const start = Date.now();
    chooseColumn(game.board, game.turn, 'hard', steady);
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it('Hard never loses to Easy', () => {
    for (let seed = 1; seed <= 4; seed++) {
      let state = seed;
      const random = () => ((state = (state * 16807) % 2147483647) / 2147483647);
      const game = new MatchFour('red');
      while (!game.result) {
        const difficulty = game.turn === 'red' ? 'easy' : 'hard';
        game.drop(chooseColumn(game.board, game.turn, difficulty, difficulty === 'hard' ? steady : random));
      }
      expect(game.result).toBe('yellow');
    }
  });

  it('scores a position from the side asked', () => {
    const position = board([...EMPTY_TOP, '.......', '.......', '..rrr..']);
    expect(evaluate(position, 'red')).toBeGreaterThan(0);
    expect(evaluate(position, 'yellow')).toBeLessThan(0);
    expect(freeColumns(position).length).toBe(7);
  });
});
