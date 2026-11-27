import { describeKeys, keyLabel, resetKeyLabels } from '#root/dist/src/app/components/key-labels.js';
import { GAMES } from '#root/dist/src/app/games/registry.js';
import { BONUS_GAMES } from '#root/dist/src/app/games/bonus/registry.js';

// What Manaspace draws (printable ASCII), and the arrows, which it lacks, so the browser takes them
// from the next font. It has blank glyphs for others (– — · • × é…): those would show as gaps.
const DRAWN = /^[ -~←→↑↓]*$/;

// Each game with its default options, then with each choice of each option in turn.
const everySettings = (options = []) => [{}, ...options.flatMap(({ key, choices }) => choices.map(({ value }) => ({ [key]: value })))];

// The Keyboard Map API, as Chromium would report it for a layout.
const useLayout = (keys) => Object.defineProperty(navigator, 'keyboard', {
  configurable: true,
  value: { getLayoutMap: async () => new Map(Object.entries(keys)) },
});

describe('Key labels', () => {
  beforeEach(() => resetKeyLabels());

  afterEach(() => {
    delete navigator.keyboard;
    resetKeyLabels();
  });

  it('shows arrows as symbols', async () => {
    expect(await keyLabel('ArrowUp')).toBe('↑');
    expect(await keyLabel('ArrowLeft')).toBe('←');
  });

  it('names physical keys by the player\'s layout', async () => {
    useLayout({ KeyZ: 'w', KeyW: 'z' });
    expect(await keyLabel('KeyZ')).toBe('W');
    expect(await keyLabel('KeyW')).toBe('Z');

    resetKeyLabels();
    useLayout({ KeyZ: 'z', KeyW: 'w' });
    expect(await keyLabel('KeyZ')).toBe('Z');
  });

  it('shows the code\'s own letter when the browser can\'t tell the layout', async () => {
    expect(await keyLabel('KeyZ')).toBe('Z');
    expect(await keyLabel('KeyQ')).toBe('Q');
  });

  it('falls back when the layout API fails', async () => {
    Object.defineProperty(navigator, 'keyboard', {
      configurable: true,
      value: { getLayoutMap: async () => { throw new Error('SecurityError'); } },
    });
    expect(await keyLabel('KeyZ')).toBe('Z');
  });

  it('describes a game\'s hints, one line each', async () => {
    useLayout({ KeyZ: 'w', KeyW: 'z' });
    const text = await describeKeys([
      { action: 'Move', codes: ['ArrowLeft', 'ArrowRight'] },
      { action: 'Fire', codes: ['ArrowUp', 'KeyZ', 'KeyW'] },
      { action: 'Thrust', codes: ['ArrowUp'] },
    ]);
    expect(text).toEqual(['Move: ← →', 'Fire: ↑, W or Z', 'Thrust: ↑']);
  });

  it('keeps a hint\'s fixed text, e.g. a range of digits', async () => {
    expect(await describeKeys([{ action: 'Drop in a column', keys: '1 to 7' }])).toEqual(['Drop in a column: 1 to 7']);
  });

  it('gives every game rules, and lists its rules and controls in characters the font draws', async () => {
    const lines = [];
    for (const { load } of [...GAMES, ...BONUS_GAMES]) {
      const definition = await load();
      for (const settings of everySettings(definition.options)) {
        const game = definition.create(settings, () => 0);
        expect(game.rules.length).toBeGreaterThan(0);
        const clicks = game.clickHints ? [...game.clickHints.mouse, ...game.clickHints.touch] : [];
        lines.push(...game.rules, ...await describeKeys(game.keyHints ?? []), ...(game.mouseHint ? [game.mouseHint] : []), ...clicks);
      }
    }
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.filter((line) => !DRAWN.test(line))).toEqual([]);
  });
});
