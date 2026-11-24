import { defaultSettings } from '#root/dist/src/app/games/game.js';
import { brickBreakerGame } from '#root/dist/src/app/games/brick-breaker/brick-breaker.js';
import { spaceRocksGame } from '#root/dist/src/app/games/space-rocks/space-rocks.js';
import { jewelDropGame } from '#root/dist/src/app/games/jewel-drop/jewel-drop.js';
import { frogCrossingGame } from '#root/dist/src/app/games/frog-crossing/frog-crossing.js';
import { alienAttackGame } from '#root/dist/src/app/games/alien-attack/alien-attack.js';
import { mazeChaseGame } from '#root/dist/src/app/games/maze-chase/maze-chase.js';
import { tableTennisGame } from '#root/dist/src/app/games/table-tennis/table-tennis.js';
import { snakeGame } from '#root/dist/src/app/games/snake/snake.js';
import { fallingBlocksGame } from '#root/dist/src/app/games/falling-blocks/falling-blocks.js';

const DEFINITIONS = [brickBreakerGame, spaceRocksGame, jewelDropGame, frogCrossingGame, alienAttackGame, mazeChaseGame, tableTennisGame, snakeGame, fallingBlocksGame];

// A game part-way through, so the save holds more than the starting state.
const played = (definition) => {
  const game = definition.create(defaultSettings(definition.options));
  game.handleKey?.('ArrowLeft');
  for (let i = 0; i < 20; i++) game.tick(16);
  return game;
};

describe('Saved games', () => {
  it('come back the same after a trip through localStorage, for every game', () => {
    DEFINITIONS.forEach((definition) => {
      const snapshot = played(definition).snapshot();
      // Saves are stored as JSON: anything it can't hold (undefined, Map, NaN…) would be lost.
      const stored = JSON.parse(JSON.stringify(snapshot));
      expect(stored).toEqual(snapshot);

      const copy = definition.create(defaultSettings(definition.options));
      copy.restore(stored);
      expect(copy.snapshot()).toEqual(snapshot);
    });
  });
});
