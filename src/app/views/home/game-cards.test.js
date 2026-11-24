import { GAME_CARDS, RANDOM_CARD, randomGamePath } from '#root/dist/src/app/views/home/game-cards.js';

describe('Home game cards', () => {
  it('picks a random game among the nine', () => {
    expect(randomGamePath(() => 0)).toBe('/games/falling-blocks');
    expect(randomGamePath(() => 0.999)).toBe('/games/table-tennis');

    const paths = GAME_CARDS.map((card) => card.path);
    for (let r = 0; r < 1; r += 0.05) expect(paths).toContain(randomGamePath(() => r));
  });

  it('never picks the bonus game', () => {
    for (let r = 0; r < 1; r += 0.01) expect(randomGamePath(() => r)).not.toContain('bonus');
  });

  it('makes Random an action card, not a link', () => {
    expect(RANDOM_CARD.title).toBe('Random');
    expect(RANDOM_CARD.path).toBeUndefined();
    expect(RANDOM_CARD.icon.length).toBe(9);
  });
});
