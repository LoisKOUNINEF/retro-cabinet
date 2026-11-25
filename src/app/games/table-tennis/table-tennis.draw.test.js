import { TableTennis } from '#root/dist/src/app/games/table-tennis/table-tennis.js';
import { drawTableTennis } from '#root/dist/src/app/games/table-tennis/table-tennis.draw.js';

const fakeContext = () => {
  const ctx = { rects: 0, texts: [] };
  ctx.fillRect = () => { ctx.rects += 1; };
  ctx.fillText = (text) => ctx.texts.push(text);
  return ctx;
};

describe('drawTableTennis', () => {
  it('draws the court, the dashed net, both paddles, the ball and the match points', () => {
    const game = new TableTennis({ random: () => 0.5 });
    game.playerPoints = 4;
    game.aiPoints = 7;
    const ctx = fakeContext();

    drawTableTennis(ctx, game);

    // Background, 20 net dashes, 2 paddles, the ball.
    expect(ctx.rects).toBe(1 + 20 + 2 + 1);
    expect(ctx.texts).toEqual(['4', '7']);
  });

  it('is what the game draws itself with', () => {
    const ctx = fakeContext();
    new TableTennis().draw(ctx);
    expect(ctx.rects).toBeGreaterThan(0);
  });
});
