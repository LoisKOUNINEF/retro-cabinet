import { candidates, chooseShot } from '#root/dist/src/app/games/bonus/naval-battle/ai.js';
import { FLEET, Waters, randomFleet, shipType } from '#root/dist/src/app/games/bonus/naval-battle/fleet.js';

const SIZES = FLEET.map(({ size }) => size);
const sight = (marks = {}, overrides = {}) => {
  const shots = Array(100).fill(null);
  Object.entries(marks).forEach(([cell, shot]) => (shots[cell] = shot));
  return { shots, sunk: [], afloat: SIZES, touching: true, ...overrides };
};

describe('Naval Battle AI', () => {
  it('fires around a lone hit, then along the line of two', () => {
    for (let i = 0; i < 20; i++) {
      expect([34, 54, 43, 45]).toContain(chooseShot(sight({ 44: 'hit' }), 'medium', Math.random));
      expect([43, 46]).toContain(chooseShot(sight({ 44: 'hit', 45: 'hit' }), 'medium', Math.random));
    }
  });

  it('knows nothing lies next to a sunk ship when ships may not touch', () => {
    const sunk = [{ id: 'destroyer', cells: [0, 1] }];
    const open = candidates(sight({ 0: 'hit', 1: 'hit' }, { sunk, touching: false }));
    [0, 1, 2, 10, 11, 12].forEach((cell) => expect(open).not.toContain(cell));
    expect(open).toContain(3);
    expect(candidates(sight({ 0: 'hit', 1: 'hit' }, { sunk }))).toContain(2);
  });

  it('aims where the ships left can still be, on Hard', () => {
    const marks = Object.fromEntries(Array.from({ length: 100 }, (_, cell) => [cell, 'miss']));
    marks[0] = null;
    marks[99] = null;
    marks[98] = 'hit';
    expect(chooseShot(sight(marks, { afloat: [2] }), 'hard', () => 0)).toBe(99);
  });

  it('sinks a whole fleet without firing twice at a cell, at every level', () => {
    ['easy', 'medium', 'hard'].forEach((level) => [true, false].forEach((touching) => {
      const waters = new Waters(randomFleet(Math.random, touching));
      let shots = 0;
      while (!waters.allSunk) {
        const view = { shots: waters.shots, sunk: waters.sunk, afloat: waters.ships.filter((ship) => !waters.isSunk(ship)).map(({ id }) => shipType(id).size), touching };
        const cell = chooseShot(view, level, Math.random);
        expect(waters.fire(cell)).toBeTruthy();
        shots++;
      }
      expect(shots).toBeLessThan(101);
    }));
  });
});
