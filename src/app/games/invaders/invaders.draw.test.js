import { Invaders } from '#root/dist/src/app/games/invaders/invaders.js';
import { drawInvaders } from '#root/dist/src/app/games/invaders/invaders.draw.js';
import { CANNON, INVADER_SPRITES, UFO } from '#root/dist/src/app/games/invaders/sprites.js';

const pixels = (sprite) => sprite.join('').split('#').length - 1;

const fakeContext = () => {
  const ctx = { rects: 0 };
  ctx.fillRect = () => { ctx.rects += 1; };
  return ctx;
};

describe('drawInvaders', () => {
  it('draws the background, every invader pixel, the shields, the cannon and the ground', () => {
    const game = new Invaders();
    const ctx = fakeContext();

    drawInvaders(ctx, game);

    const fleet = 11 * pixels(INVADER_SPRITES.squid[0])
      + 22 * pixels(INVADER_SPRITES.crab[0])
      + 22 * pixels(INVADER_SPRITES.octopus[0]);
    expect(ctx.rects).toBe(1 + fleet + game.shieldChunks.length + pixels(CANNON) + 1);
  });

  it('adds the UFO, the shot and each bomb', () => {
    const game = new Invaders({ shields: false });
    game.invaders = [];
    game.ufo = { x: 50, direction: 1 };
    game.shot = { x: 100, y: 100, width: 1, height: 4 };
    game.bombs = [{ x: 10, y: 100, width: 3, height: 7 }];
    const ctx = fakeContext();

    drawInvaders(ctx, game);

    expect(ctx.rects).toBe(1 + pixels(UFO) + pixels(CANNON) + 1 + 7 + 1);
  });

  it('is what the game draws itself with', () => {
    const game = new Invaders();
    const ctx = fakeContext();
    game.draw(ctx);
    expect(ctx.rects).toBeGreaterThan(0);
  });
});
