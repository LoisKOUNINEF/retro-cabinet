import { CodeBreaker, RULES, codeBreakerGame, palette, score } from '#root/dist/src/app/games/bonus/code-breaker/code-breaker.js';
import { EMPTY } from '#root/dist/src/app/games/bonus/code-breaker/pegs.js';

// Rolls in turn, then 0: picks (or Fisher–Yates swaps) driven from the list.
const rolls = (...values) => () => values.length ? values.shift() : 0;
const game = (difficulty = 'normal', tries = 10, random = () => 0) => new CodeBreaker({ rules: RULES[difficulty], tries, random });
const play = (breaker, pegs) => {
  pegs.forEach((peg) => breaker.select(peg, 'colour'));
  breaker.select(0, 'check');
};

describe('Code Breaker scoring', () => {
  it('counts the pegs in place, then the right colours elsewhere', () => {
    expect(score([0, 1, 2, 3], [0, 1, 2, 3])).toEqual({ exact: 4, misplaced: 0 });
    expect(score([0, 1, 2, 3], [4, 5, 4, 5])).toEqual({ exact: 0, misplaced: 0 });
    expect(score([0, 1, 2, 3], [3, 2, 1, 0])).toEqual({ exact: 0, misplaced: 4 });
    expect(score([0, 1, 2, 3], [0, 2, 5, 5])).toEqual({ exact: 1, misplaced: 1 });
  });

  it('counts a repeated colour no more often than the code has it', () => {
    expect(score([0, 0, 1, 1], [0, 1, 0, 0])).toEqual({ exact: 1, misplaced: 2 });
    expect(score([0, 1, 2, 3], [0, 0, 0, 0])).toEqual({ exact: 1, misplaced: 0 });
    expect(score([2, 2, 2, 5], [5, 2, 1, 1])).toEqual({ exact: 1, misplaced: 1 });
  });

  it('scores empty holes like a colour', () => {
    expect(score([EMPTY, 0, EMPTY, 1, 2], [EMPTY, EMPTY, 0, 1, 3])).toEqual({ exact: 2, misplaced: 2 });
  });
});

describe('Code Breaker', () => {
  it('plays 6 colours on Easy and Normal, 8 and Empty on Hard', () => {
    expect(palette(RULES.easy)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(palette(RULES.normal)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(palette(RULES.hard)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, EMPTY]);
  });

  it('draws a code without repeats on Easy', () => {
    for (let i = 0; i < 20; i++) {
      const { code } = game('easy', 10, Math.random);
      expect(code.length).toBe(4);
      expect(new Set(code).size).toBe(4);
      code.forEach((peg) => expect(peg).toBeLessThan(6));
    }
  });

  it('may repeat colours on Normal, and draw empty holes on Hard only', () => {
    expect(game('normal', 10, () => 0).code).toEqual([0, 0, 0, 0]);
    expect(game('hard', 10, () => 0.99).code).toEqual([EMPTY, EMPTY, EMPTY, EMPTY, EMPTY]);
    expect(game('normal', 10, () => 0.99).code).toEqual([5, 5, 5, 5]);
  });

  it('fills the holes in turn, and aims or empties a hole when it is picked', () => {
    const breaker = game();
    breaker.select(2, 'colour');
    breaker.select(3, 'colour');
    expect(breaker.current).toEqual([2, 3, null, null]);
    expect(breaker.cursor).toBe(2);

    breaker.select(0, 'slot');
    expect(breaker.cursor).toBe(0);
    breaker.select(5, 'colour');
    expect(breaker.current).toEqual([5, 3, null, null]);
    expect(breaker.cursor).toBe(2);

    breaker.select(1, 'slot');
    breaker.select(1, 'slot');
    expect(breaker.current).toEqual([5, null, null, null]);
    expect(breaker.cursor).toBe(1);
  });

  it('only checks a full row', () => {
    const breaker = game();
    breaker.select(1, 'colour');
    breaker.select(0, 'check');
    expect(breaker.guesses.length).toBe(0);
    expect(breaker.status).toBe('Fill every hole, then Check.');

    play(breaker, [1, 1, 1]);
    expect(breaker.guesses).toEqual([{ pegs: [1, 1, 1, 1], exact: 0, misplaced: 0 }]);
    expect(breaker.current).toEqual([null, null, null, null]);
    expect(breaker.cursor).toBe(0);
    expect(breaker.status).toBe('0 in place, 0 misplaced. Guess 2 of 10: colours may repeat.');
  });

  it('refuses a colour already in the row on Easy', () => {
    // Code: the swaps of 0-rolls, whatever it is.
    const breaker = game('easy');
    breaker.select(3, 'colour');
    expect(breaker.canPlace(3)).toBe(false);
    breaker.select(3, 'colour');
    expect(breaker.current).toEqual([3, null, null, null]);
    // Back on its own hole, the colour can go there again.
    breaker.select(0, 'slot');
    expect(breaker.canPlace(3)).toBe(true);
  });

  it('is won when every peg is in place, keeping the guesses for the best', () => {
    const breaker = game('normal', 10, rolls(0.2, 0.4, 0.6, 0.8));
    expect(breaker.code).toEqual([1, 2, 3, 4]);
    play(breaker, [1, 2, 4, 3]);
    expect(breaker.isOver).toBe(false);
    play(breaker, [1, 2, 3, 4]);
    expect(breaker.outcome).toBe('wins');
    expect(breaker.status).toContain('Cracked in 2 guesses!');
    expect(codeBreakerGame.results.best.score(breaker)).toBe(2);
    breaker.select(0, 'colour');
    expect(breaker.current).toEqual([null, null, null, null]);
  });

  it('is lost once the tries run out, telling the code', () => {
    const breaker = game('normal', 8);
    for (let i = 0; i < 8; i++) play(breaker, [1, 1, 1, 1]);
    expect(breaker.outcome).toBe('losses');
    expect(breaker.status).toContain('Out of tries: the code was Red, Red, Red, Red.');
    expect(breaker.stats()).toEqual([{ key: 'guesses', label: 'Guesses', value: '8/8' }]);
  });

  it('plays from the keyboard: number keys, arrows, Backspace and Enter', () => {
    const breaker = game('hard');
    expect(breaker.handleKey('Digit9')).toBe(true);
    expect(breaker.current[0]).toBe(EMPTY);
    breaker.handleKey('Numpad2');
    expect(breaker.current).toEqual([EMPTY, 1, null, null, null]);
    breaker.handleKey('Backspace');
    expect(breaker.current).toEqual([EMPTY, null, null, null, null]);
    expect(breaker.cursor).toBe(1);
    breaker.handleKey('ArrowLeft');
    breaker.handleKey('Delete');
    expect(breaker.current).toEqual([null, null, null, null, null]);
    ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].forEach((code) => breaker.handleKey(code));
    breaker.handleKey('Enter');
    expect(breaker.guesses.length).toBe(1);
    expect(breaker.handleKey('KeyQ')).toBe(false);
  });

  it('tallies per difficulty and tries, with the fewest guesses', () => {
    const { results } = codeBreakerGame;
    expect(results.key({ difficulty: 'hard', tries: '12' })).toBe('hard-12');
    expect(results.key({})).toBe('normal-10');
    expect(results.draws).toBe(false);
  });
});
