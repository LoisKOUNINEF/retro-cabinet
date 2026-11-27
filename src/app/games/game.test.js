import { applyFields, approach, choiceOf, cryptoRandom, defaultSettings, isOn, levelFrom, levelOption, livesFrom, livesOption, onOff, pickFields, quarterTurn, shuffle } from '#root/dist/src/app/games/game.js';

describe('Game options', () => {
  it('offers starting levels 1 to 10, defaulting to 1', () => {
    expect(levelOption.choices.map((c) => c.value)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    expect(defaultSettings([levelOption])).toEqual({ level: '1' });
  });

  it('reads the starting level from settings, clamped to 1-10', () => {
    expect(levelFrom({ level: '4' })).toBe(4);
    expect(levelFrom({ level: '0' })).toBe(1);
    expect(levelFrom({ level: '42' })).toBe(10);
    expect(levelFrom({ level: 'abc' })).toBe(1);
    expect(levelFrom({})).toBe(1);
  });

  it('offers the original lives (shown) or 3, 6, 9, 99, defaulting to the original', () => {
    const option = livesOption(5);
    expect(option.choices.map((c) => c.value)).toEqual(['original', '3', '6', '9', '99']);
    expect(option.choices[0].label).toBe('Original (5)');
    expect(defaultSettings([option])).toEqual({ lives: 'original' });
  });

  it('leaves out the fixed choice equal to the original count', () => {
    expect(livesOption(3).choices.map((c) => c.value)).toEqual(['original', '6', '9', '99']);
  });

  it('reads the lives from settings, falling back to the original count', () => {
    expect(livesFrom({ lives: '9' }, 5)).toBe(9);
    expect(livesFrom({ lives: 'original' }, 5)).toBe(5);
    expect(livesFrom({ lives: '42' }, 5)).toBe(5);
    expect(livesFrom({}, 5)).toBe(5);
  });

  it('builds on/off toggles that default to off', () => {
    const option = onOff('time', 'Time limit');
    expect(option.label).toBe('Time limit');
    expect(defaultSettings([option])).toEqual({ time: 'off' });
    expect(option.choices.map((c) => c.value)).toEqual(['off', 'on']);
  });

  it('builds toggles that default to on when asked', () => {
    expect(defaultSettings([onOff('shields', 'Shields', true)])).toEqual({ shields: 'on' });
  });

  it('reads a toggle, falling back to its default when missing or invalid', () => {
    const shields = onOff('shields', 'Shields', true);
    expect(isOn({ shields: 'off' }, shields)).toBe(false);
    expect(isOn({}, shields)).toBe(true);
    expect(isOn({ shields: 'maybe' }, shields)).toBe(true);
    expect(isOn({}, onOff('time', 'Time limit'))).toBe(false);
  });

  it('reads a choice, falling back to the declared default, else the first choice', () => {
    const choices = [{ value: 'easy', label: 'Easy' }, { value: 'hard', label: 'Hard' }];
    expect(choiceOf({ difficulty: 'hard' }, { key: 'difficulty', label: '', choices })).toBe('hard');
    expect(choiceOf({ difficulty: 'nope' }, { key: 'difficulty', label: '', choices })).toBe('easy');
    expect(choiceOf({}, { key: 'difficulty', label: '', choices, defaultValue: 'hard' })).toBe('hard');
  });
});

describe('Randomness', () => {
  it('draws crypto random numbers in [0, 1)', () => {
    const draws = Array.from({ length: 1000 }, () => cryptoRandom());
    expect(draws.every((n) => n >= 0 && n < 1)).toBe(true);
    expect(new Set(draws).size).toBeGreaterThan(1);
  });

  it('shuffles a copy, keeping every item', () => {
    const items = [1, 2, 3, 4, 5];
    const shuffled = shuffle(items);
    expect(items).toEqual([1, 2, 3, 4, 5]);
    expect(shuffled).not.toBe(items);
    expect([...shuffled].sort()).toEqual(items);
  });

  it('shuffles with the given random source', () => {
    // random() = 0 swaps each item with the first: [1, 2, 3, 4] → [2, 3, 4, 1].
    expect(shuffle([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1]);
    expect(shuffle([], () => 0)).toEqual([]);
    expect(shuffle([7], () => 0)).toEqual([7]);
  });
});

describe('Saving fields', () => {
  it('deep-copies the listed fields and puts them back', () => {
    const game = { score: 10, board: [[1]] };
    const snapshot = pickFields(game, ['score', 'board']);
    game.board[0][0] = 2;
    expect(snapshot).toEqual({ score: 10, board: [[1]] });

    applyFields(game, snapshot, ['score', 'board']);
    expect(game.board).toEqual([[1]]);
  });

  it('throws on a field the game does not have, or a save that lacks one', () => {
    expect(() => pickFields({ score: 10 }, ['scroe'])).toThrow();
    expect(() => applyFields({ score: 10 }, {}, ['score'])).toThrow();
  });
});

describe('Movement helpers', () => {
  it('approaches a target by at most the given step, without overshooting', () => {
    expect(approach(10, 50, 15)).toBe(25);
    expect(approach(10, -50, 15)).toBe(-5);
    expect(approach(10, 12, 15)).toBe(12);
    expect(approach(10, 10, 15)).toBe(10);
  });

  it('turns a direction a quarter, clockwise or not, as seen on screen', () => {
    const right = { x: 1, y: 0 };
    const down = { x: 0, y: 1 };
    const left = { x: -1, y: 0 };
    const up = { x: 0, y: -1 };

    expect([right, down, left, up].map((d) => quarterTurn(d, true))).toEqual([down, left, up, right]);
    expect([right, down, left, up].map((d) => quarterTurn(d, false))).toEqual([up, right, down, left]);
    // No -0, which would tell apart in Object.is and toEqual.
    expect(Object.is(quarterTurn(right, true).x, 0)).toBeTruthy();
    expect(Object.is(quarterTurn(left, false).x, 0)).toBeTruthy();
  });
});
