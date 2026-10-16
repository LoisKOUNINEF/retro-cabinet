import { describeKeys, keyLabel, resetKeyLabels } from '#root/dist/src/app/components/key-labels.js';

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

  it('describes a game\'s hints in one line', async () => {
    useLayout({ KeyZ: 'w', KeyW: 'z' });
    const text = await describeKeys([
      { action: 'Move', codes: ['ArrowLeft', 'ArrowRight'] },
      { action: 'Fire', codes: ['ArrowUp', 'KeyZ', 'KeyW'] },
      { action: 'Thrust', codes: ['ArrowUp'] },
    ]);
    expect(text).toBe('Move: ← → · Fire: ↑, W or Z · Thrust: ↑');
  });
});
