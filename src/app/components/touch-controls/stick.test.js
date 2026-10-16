import { isTouchDevice, stickDirection, watchForTouch } from '#root/dist/src/app/components/touch-controls/stick.js';

const ALL = ['up', 'down', 'left', 'right'];

describe('stickDirection', () => {
  it('reads a centred stick, within the dead zone, as no direction', () => {
    expect(stickDirection(0, 0, ALL)).toBe(null);
    expect(stickDirection(10, 5, ALL)).toBe(null);
  });

  it('points along the dominant axis', () => {
    expect(stickDirection(40, 10, ALL)).toBe('right');
    expect(stickDirection(-40, 10, ALL)).toBe('left');
    expect(stickDirection(5, -40, ALL)).toBe('up');
    expect(stickDirection(5, 40, ALL)).toBe('down');
    expect(stickDirection(30, -25, ALL)).toBe('right');
  });

  it('only uses the directions the game allows', () => {
    // Paddle and cannon games: left/right only.
    expect(stickDirection(5, -40, ['left', 'right'])).toBe(null);
    expect(stickDirection(25, -40, ['left', 'right'])).toBe('right');
    // Tetris: no up.
    expect(stickDirection(0, -40, ['left', 'right', 'down'])).toBe(null);
    expect(stickDirection(-30, -40, ['left', 'right', 'down'])).toBe('left');
  });
});

describe('Touch detection', () => {
  afterEach(() => {
    document.documentElement.classList.remove('touch');
    delete window.matchMedia;
  });

  it('detects a finger as the main pointer', () => {
    expect(isTouchDevice()).toBeFalsy();
    window.matchMedia = (query) => ({ matches: query === '(pointer: coarse)' });
    expect(isTouchDevice()).toBeTruthy();
  });

  it('switches to touch on the first touch only', () => {
    watchForTouch();

    window.dispatchEvent(new window.PointerEvent('pointerdown', { pointerType: 'mouse' }));
    expect(isTouchDevice()).toBeFalsy();

    window.dispatchEvent(new window.PointerEvent('pointerdown', { pointerType: 'touch' }));
    expect(isTouchDevice()).toBeTruthy();
  });
});
