import { AlienAttack } from '#root/dist/src/app/games/alien-attack/alien-attack.js';
import { drawAlienAttack } from '#root/dist/src/app/games/alien-attack/alien-attack.draw.js';
import { CANNON, ALIEN_SPRITES, UFO } from '#root/dist/src/app/games/alien-attack/sprites.js';

const pixels = (sprite) => sprite.join('').split('#').length - 1;

const fakeContext = () => {
  const ctx = { rects: 0 };
  ctx.fillRect = () => { ctx.rects += 1; };
  return ctx;
};

describe('drawAlienAttack', () => {
  it('draws the background, every alien pixel, the shields, the cannon and the ground', () => {
    const game = new AlienAttack();
    const ctx = fakeContext();

    drawAlienAttack(ctx, game);

    const fleet = 11 * pixels(ALIEN_SPRITES.squid[0])
      + 22 * pixels(ALIEN_SPRITES.crab[0])
      + 22 * pixels(ALIEN_SPRITES.octopus[0]);
    expect(ctx.rects).toBe(1 + fleet + game.shieldChunks.length + pixels(CANNON) + 1);
  });

  it('adds the UFO, the shot and each bomb', () => {
    const game = new AlienAttack({ shields: false });
    game.aliens = [];
    game.ufo = { x: 50, direction: 1 };
    game.shot = { x: 100, y: 100, width: 1, height: 4 };
    game.bombs = [{ x: 10, y: 100, width: 3, height: 7 }];
    const ctx = fakeContext();

    drawAlienAttack(ctx, game);

    expect(ctx.rects).toBe(1 + pixels(UFO) + pixels(CANNON) + 1 + 7 + 1);
  });

  it('is what the game draws itself with', () => {
    const game = new AlienAttack();
    const ctx = fakeContext();
    game.draw(ctx);
    expect(ctx.rects).toBeGreaterThan(0);
  });
});
