import { BRICK_KINDS, COLUMNS, LAYOUTS } from '#root/dist/src/app/games/arkanoid/layouts.js';

describe('Arkanoid layouts', () => {
  it('has 5 layouts of 13-brick rows', () => {
    expect(LAYOUTS.length).toBe(5);
    LAYOUTS.forEach((layout) => layout.forEach((row) => expect(row.length).toBe(COLUMNS)));
  });

  it('only uses the legend characters', () => {
    const allowed = ['.', ...BRICK_KINDS];
    LAYOUTS.forEach((layout) => layout.forEach((row) =>
      [...row].forEach((char) => expect(allowed).toContain(char))));
  });

  it('gives every layout something to break', () => {
    LAYOUTS.forEach((layout) => {
      const breakable = layout.join('').replace(/[.G]/g, '');
      expect(breakable.length).toBeGreaterThan(0);
    });
  });
});
