import { defaultSettings, levelFrom, levelOption, onOff } from '#root/dist/src/app/games/game.js';

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
