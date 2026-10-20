import { GAMES, gamePath } from '#root/dist/src/app/games/registry.js';
import { defaultSettings } from '#root/dist/src/app/games/game.js';
import { appRoutes } from '#root/dist/src/app/routes.js';

describe('Game registry', () => {
  it('loads, for each entry, the game with the same id and title', async () => {
    for (const { id, title, load } of GAMES) {
      const definition = await load();
      const game = definition.create(defaultSettings(definition.options));
      expect(definition.id).toBe(id);
      expect(game.id).toBe(id);
      expect(game.title).toBe(title);
    }
  });

  it('lists each game once, each with its own route', () => {
    const ids = GAMES.map((game) => game.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(Object.keys(appRoutes)).toContain(gamePath(id)));
  });
});
