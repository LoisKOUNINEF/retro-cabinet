import { FLEET, Waters, around, fit, randomFleet, shipCells } from '#root/dist/src/app/games/bonus/naval-battle/fleet.js';

const valid = (ships, touching) => {
  const taken = new Map();
  ships.forEach(({ id, cells }) => cells.forEach((cell) => taken.set(cell, id)));
  expect(taken.size).toBe(17);
  if (!touching) ships.forEach(({ id, cells }) => cells.forEach((cell) => around(cell).forEach((next) => {
    if (taken.has(next)) expect(taken.get(next)).toBe(id);
  })));
};

describe('Naval Battle fleet', () => {
  it('lays a ship along or across the grid, never off it', () => {
    expect(shipCells(3, { start: 0, horizontal: true })).toEqual([0, 1, 2]);
    expect(shipCells(3, { start: 0, horizontal: false })).toEqual([0, 10, 20]);
    expect(shipCells(3, { start: 8, horizontal: true })).toBe(null);
    expect(shipCells(3, { start: 80, horizontal: false })).toBe(null);
  });

  it('keeps ships apart, and with touching off, a cell apart, corners included', () => {
    const ships = [{ id: 'cruiser', cells: [0, 1, 2] }];
    expect(fit(ships, 2, { start: 2, horizontal: true }, true)).toBe(null);
    expect(fit(ships, 2, { start: 3, horizontal: true }, true)).toEqual([3, 4]);
    expect(fit(ships, 2, { start: 3, horizontal: true }, false)).toBe(null);
    expect(fit(ships, 2, { start: 13, horizontal: true }, false)).toBe(null);
    expect(fit(ships, 2, { start: 14, horizontal: true }, false)).toEqual([14, 15]);
  });

  it('lays a whole fleet at random, under either rule', () => {
    [true, false].forEach((touching) => {
      for (let i = 0; i < 15; i++) {
        const ships = randomFleet(Math.random, touching);
        expect(ships.map(({ id }) => id)).toEqual(FLEET.map(({ id }) => id));
        ships.forEach(({ id, cells }) => expect(cells.length).toBe(FLEET.find((type) => type.id === id).size));
        valid(ships, touching);
      }
    });
  });

  it('lays the ships left around those placed by hand', () => {
    const placed = [{ id: 'carrier', cells: [0, 1, 2, 3, 4] }];
    const ships = randomFleet(Math.random, true, placed);
    expect(ships[0]).toBe(placed[0]);
    expect(ships.length).toBe(5);
    valid(ships, true);
  });

  it('tells a miss, a hit and a sunk ship, and when the fleet is gone', () => {
    const destroyer = { id: 'destroyer', cells: [10, 11] };
    const waters = new Waters([destroyer]);
    expect(waters.fire(0)).toEqual({ result: 'miss' });
    expect(waters.fire(0)).toBe(null);
    expect(waters.fire(10)).toEqual({ result: 'hit', ship: destroyer });
    expect(waters.allSunk).toBe(false);
    expect(waters.fire(11)).toEqual({ result: 'sunk', ship: destroyer });
    expect(waters.allSunk).toBe(true);
    expect(waters.shotCount).toBe(3);
    expect(waters.shipsLeft).toBe(0);
  });
});
