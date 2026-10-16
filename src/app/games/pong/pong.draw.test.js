import { Pong } from '#root/dist/src/app/games/pong/pong.js';
import { drawPong } from '#root/dist/src/app/games/pong/pong.draw.js';

const fakeContext = () => {
  const ctx = { rects: 0, texts: [] };
  ctx.fillRect = () => { ctx.rects += 1; };
  ctx.fillText = (text) => ctx.texts.push(text);
  return ctx;
};

describe('drawPong', () => {
  it('draws the court, the dashed net, both paddles, the ball and the match points', () => {
    const game = new Pong({ random: () => 0.5 });
    game.playerPoints = 4;
    game.aiPoints = 7;
    const ctx = fakeContext();

    drawPong(ctx, game);

    // Background, 20 net dashes, 2 paddles, the ball.
    expect(ctx.rects).toBe(1 + 20 + 2 + 1);
    expect(ctx.texts).toEqual(['4', '7']);
  });

  it('is what the game draws itself with', () => {
    const ctx = fakeContext();
    new Pong().draw(ctx);
    expect(ctx.rects).toBeGreaterThan(0);
  });
});
