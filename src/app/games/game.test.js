import { cryptoRandom, defaultSettings, levelFrom, levelOption, onOff, shuffle } from '#root/dist/src/app/games/game.js';

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

  it('builds on/off toggles that default to off', () => {
    const option = onOff('time', 'Time limit');
    expect(option.label).toBe('Time limit');
    expect(defaultSettings([option])).toEqual({ time: 'off' });
    expect(option.choices.map((c) => c.value)).toEqual(['off', 'on']);
  });

  it('builds toggles that default to on when asked', () => {
    expect(defaultSettings([onOff('shields', 'Shields', true)])).toEqual({ shields: 'on' });
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
