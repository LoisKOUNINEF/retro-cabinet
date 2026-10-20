import { defaultSettings } from '#root/dist/src/app/games/game.js';
import { arkanoidGame } from '#root/dist/src/app/games/arkanoid/arkanoid.js';
import { asteroidsGame } from '#root/dist/src/app/games/asteroids/asteroids.js';
import { columnsGame } from '#root/dist/src/app/games/columns/columns.js';
import { froggerGame } from '#root/dist/src/app/games/frogger/frogger.js';
import { invadersGame } from '#root/dist/src/app/games/invaders/invaders.js';
import { pacmanGame } from '#root/dist/src/app/games/pacman/pacman.js';
import { pongGame } from '#root/dist/src/app/games/pong/pong.js';
import { snakeGame } from '#root/dist/src/app/games/snake/snake.js';
import { tetrisGame } from '#root/dist/src/app/games/tetris/tetris.js';

const DEFINITIONS = [arkanoidGame, asteroidsGame, columnsGame, froggerGame, invadersGame, pacmanGame, pongGame, snakeGame, tetrisGame];

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
