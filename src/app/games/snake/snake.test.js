import { BONUS_ENDING_TICKS, BONUS_TICKS, Snake, snakeGame } from '#root/dist/src/app/games/snake/snake.js';

// random() = 0 always picks the first free cell, (0, 0) on an empty board.
const newSnake = () => new Snake({ random: () => 0 });
// …and, with bonuses on, always spawns one after an apple: a golden one (the first kind).
const bonusSnake = () => new Snake({ random: () => 0, bonuses: true });

describe('Snake', () => {
  it('starts in the middle, heading right, with food on a free cell', () => {
    const game = newSnake();

    expect(game.body).toEqual([{ x: 10, y: 10 }]);
    expect(game.direction).toEqual({ x: 1, y: 0 });
    expect(game.food).toEqual({ x: 0, y: 0 });
    expect(game.cells()[10][10]).toBe('snake-head-right');
    expect(game.cells()[0][0]).toBe('food');
  });

  it('moves one cell per tick in its direction', () => {
    const game = newSnake();
    game.tick();
    expect(game.head).toEqual({ x: 11, y: 10 });
  });

  it('ignores a turn back onto the same axis', () => {
    const game = newSnake();
    game.handleKey('ArrowLeft');
    expect(game.direction).toEqual({ x: 1, y: 0 });
  });

  it('accepts only one turn per tick', () => {
    const game = newSnake();
    game.body = [{ x: 10, y: 10 }, { x: 9, y: 10 }];

    game.handleKey('ArrowUp');
    game.handleKey('ArrowLeft');
    expect(game.direction).toEqual({ x: 0, y: -1 });

    game.tick();
    game.handleKey('ArrowLeft');
    expect(game.direction).toEqual({ x: -1, y: 0 });
    expect(game.cells()[9][10]).toBe('snake-head-up');
  });

  it('turns the drawn head only when the snake actually turns', () => {
    const game = newSnake();
    game.handleKey('ArrowUp');

    // Pressed, but the snake hasn't moved yet: the head still faces right.
    expect(game.heading).toEqual({ x: 1, y: 0 });
    expect(game.cells()[10][10]).toBe('snake-head-right');

    game.tick();
    expect(game.heading).toEqual({ x: 0, y: -1 });
    expect(game.cells()[9][10]).toBe('snake-head-up');
  });

  it('grows and scores when eating, then respawns the food off the snake', () => {
    const game = newSnake();
    game.food = { x: 11, y: 10 };

    game.tick();

    expect(game.body).toEqual([{ x: 11, y: 10 }, { x: 10, y: 10 }]);
    expect(game.score).toBe(10);
    expect(game.body.some((p) => p.x === game.food.x && p.y === game.food.y)).toBeFalsy();
  });

  it('dies when it hits a wall', () => {
    const game = newSnake();
    game.body = [{ x: 20, y: 10 }];

    game.tick();

    expect(game.isOver).toBeTruthy();
  });

  it('dies when it runs into its body', () => {
    const game = newSnake();
    game.body = [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 }, { x: 4, y: 6 }];
    game.direction = { x: 0, y: 1 };

    game.tick();

    expect(game.isOver).toBeTruthy();
  });

  it('can move into the cell its tail is leaving', () => {
    const game = newSnake();
    game.body = [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 5, y: 6 }];
    game.direction = { x: 0, y: 1 };

    game.tick();

    expect(game.isOver).toBeFalsy();
    expect(game.head).toEqual({ x: 5, y: 6 });
  });

  it('levels up at 100 points and scores more per food after', () => {
    const game = newSnake();
    game.score = 90;
    game.food = { x: 11, y: 10 };
    const slowSpeed = game.speed();

    game.tick();
    expect(game.score).toBe(100);
    expect(game.level).toBe(2);
    expect(game.speed()).toBeLessThan(slowSpeed);

    game.food = { x: 12, y: 10 };
    game.tick();
    expect(game.score).toBe(120);
  });

  it('resets to a fresh game', () => {
    const game = newSnake();
    game.body = [{ x: 20, y: 10 }];
    game.tick();
    game.reset();

    expect(game.isOver).toBeFalsy();
    expect(game.body).toEqual([{ x: 10, y: 10 }]);
    expect(game.score).toBe(0);
  });

  it('starts at the chosen level, with its speed and score multiplier', () => {
    const game = new Snake({ random: () => 0, firstLevel: 3 });
    expect(game.level).toBe(3);
    expect(game.speed()).toBeLessThan(newSnake().speed());

    game.food = { x: 11, y: 10 };
    game.tick();
    expect(game.score).toBe(30);

    game.reset();
    expect(game.level).toBe(3);
  });

  it('reads the starting level from its definition settings', () => {
    expect(snakeGame.options.map((o) => o.key)).toEqual(['level', 'bonuses']);
    expect(snakeGame.create({ level: '3' }).level).toBe(3);
  });

  describe('bonus food', () => {
    it('is off by default and turned on by the option', () => {
      // Real random source: a bonus follows 1 apple in 4, so eat up to 100 of them.
      const bonusAfterApples = (game) => {
        for (let i = 0; i < 100 && !game.bonus; i++) {
          game.body = [{ x: 10, y: 10 }];
          game.food = { x: 11, y: 10 };
          game.tick();
        }
        return game.bonus;
      };
      expect(snakeGame.options.find((o) => o.key === 'bonuses').defaultValue).toBe('off');
      expect(bonusAfterApples(snakeGame.create({}))).toBe(null);
      expect(bonusAfterApples(snakeGame.create({ bonuses: 'on' }))).not.toBe(null);
    });

    it('never appears when off', () => {
      const game = newSnake();
      for (let x = 11; x < 15; x++) {
        game.food = { x, y: 10 };
        game.tick();
      }
      expect(game.bonus).toBe(null);
    });

    it('appears after an apple, on a cell free of the snake and the apple', () => {
      const game = bonusSnake();
      game.food = { x: 11, y: 10 };
      game.tick();

      expect(game.food).toEqual({ x: 0, y: 0 });
      expect(game.bonus).toEqual({ x: 1, y: 0, kind: 'golden', ticksLeft: BONUS_TICKS });
      expect(game.cells()[0][1]).toBe('bonus-golden');
    });

    it('golden apple: grows the snake and is worth 5 apples, the apple staying put', () => {
      const game = bonusSnake();
      game.bonus = { x: 11, y: 10, kind: 'golden', ticksLeft: BONUS_TICKS };
      game.tick();

      expect(game.body.length).toBe(2);
      expect(game.score).toBe(50);
      expect(game.food).toEqual({ x: 0, y: 0 });
      expect(game.bonus).toBe(null);
    });

    it('shrink berry: cuts 3 segments off the tail, never the head', () => {
      const game = bonusSnake();
      game.body = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }];
      game.bonus = { x: 11, y: 10, kind: 'shrink', ticksLeft: BONUS_TICKS };
      game.tick();

      expect(game.body).toEqual([{ x: 11, y: 10 }, { x: 10, y: 10 }]);
      expect(game.score).toBe(10);

      game.bonus = { x: 12, y: 10, kind: 'shrink', ticksLeft: BONUS_TICKS };
      game.tick();
      expect(game.body).toEqual([{ x: 12, y: 10 }]);
    });

    it('blinks before it goes, then disappears', () => {
      const game = bonusSnake();
      game.body = [{ x: 0, y: 10 }];
      game.bonus = { x: 0, y: 20, kind: 'shrink', ticksLeft: BONUS_ENDING_TICKS + 1 };
      expect(game.cells()[20][0]).toBe('bonus-shrink');

      game.tick();
      expect(game.cells()[20][0]).toBe('bonus-shrink-ending');

      for (let i = 0; i < BONUS_ENDING_TICKS - 1; i++) game.tick();
      expect(game.bonus).not.toBe(null);
      game.tick();
      expect(game.bonus).toBe(null);
      expect(game.cells()[20][0]).toBe(null);
    });

    it('is saved and restored', () => {
      const game = bonusSnake();
      game.food = { x: 11, y: 10 };
      game.tick();

      const copy = bonusSnake();
      copy.restore(JSON.parse(JSON.stringify(game.snapshot())));
      expect(copy.bonus).toEqual(game.bonus);
    });

    it('drops saves from before bonuses', () => {
      expect(snakeGame.saveVersion).toBeGreaterThan(7);
    });
  });

  it('steers with the touch stick, unlike the other games', () => {
    expect(newSnake().touch.pad).toBe('stick');
  });

  it('saves and restores its exact state', () => {
    const game = newSnake();
    game.food = { x: 12, y: 10 };
    game.tick();
    game.tick();
    game.handleKey('ArrowUp');

    const copy = newSnake();
    copy.restore(JSON.parse(JSON.stringify(game.snapshot())));
    expect(copy.snapshot()).toEqual(game.snapshot());

    for (let i = 0; i < 5; i++) { game.tick(); copy.tick(); }
    expect(copy.snapshot()).toEqual(game.snapshot());
    expect(copy.body.length).toBe(2);
    expect(copy.heading).toEqual(game.heading);
  });
});
