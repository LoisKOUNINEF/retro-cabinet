import { CANNON, INVADER_SPRITES, SHIELD, UFO } from '#root/dist/src/app/games/invaders/sprites.js';

const dimensions = (sprite) => ({ width: sprite[0].length, height: sprite.length });
const isRectangular = (sprite) => sprite.every((row) => row.length === sprite[0].length);

describe('Space Invaders sprites', () => {
  it('draws every sprite as a rectangle of pixels', () => {
    const all = [...Object.values(INVADER_SPRITES).flat(), CANNON, UFO, SHIELD];
    all.forEach((sprite) => expect(isRectangular(sprite)).toBeTruthy());
  });

  it('keeps both animation frames of an invader the same size', () => {
    Object.values(INVADER_SPRITES).forEach(([a, b]) => expect(dimensions(a)).toEqual(dimensions(b)));
    expect(dimensions(INVADER_SPRITES.squid[0])).toEqual({ width: 8, height: 8 });
    expect(dimensions(INVADER_SPRITES.crab[0])).toEqual({ width: 11, height: 8 });
    expect(dimensions(INVADER_SPRITES.octopus[0])).toEqual({ width: 12, height: 8 });
  });

  it('has arcade-sized cannon, UFO and bunker', () => {
    expect(dimensions(CANNON)).toEqual({ width: 13, height: 8 });
    expect(dimensions(UFO)).toEqual({ width: 16, height: 7 });
    expect(dimensions(SHIELD)).toEqual({ width: 22, height: 16 });
  });
});
