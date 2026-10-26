import { DIFFICULTIES, Pong, aiTarget, paddleReturn, pongGame, predictY } from '#root/dist/src/app/games/pong/pong.js';
import { defaultSettings } from '#root/dist/src/app/games/game.js';

const near = (a, b, tolerance = 1e-6) => Math.abs(a - b) < tolerance;
// random() = 0.5: serves go straight, aiming errors are 0.
const newGame = (options = {}) => new Pong({ random: () => 0.5, ...options });
// In play: no serve countdown, the ball where the test puts it.
const inPlay = (game, ball) => {
  game.serveMs = 0;
  game.ball = { vx: 0, vy: 0, ...ball };
  return game;
};

describe('Pong', () => {
  it('moves the player paddle while an arrow is held, within the court', () => {
    const game = newGame();
    game.handleKey('ArrowDown');
    game.tick(100);
    expect(game.playerY).toBe(142);

    game.tick(5000);
    expect(game.playerY).toBe(224);

    game.releaseKeys();
    game.tick(100);
    expect(game.playerY).toBe(224);
  });

  it('serves after a second, to the AI first', () => {
    const game = newGame();
    game.tick(999);
    expect(game.ball.vx).toBe(0);
    game.tick(1);
    expect(near(game.ball.vx, 160)).toBeTruthy();
    expect(near(game.ball.vy, 0)).toBeTruthy();
  });

  it('serves to whoever lost the last point', () => {
    const game = newGame();
    game.playerY = 16;
    inPlay(game, { x: 2, y: 200, vx: -300 });

    game.tick(50);
    expect(game.aiPoints).toBe(1);
    expect(game.servingTo).toBe('player');
    expect(game.ball).toEqual({ x: 160, y: 120, vx: 0, vy: 0 });

    game.tick(1000);
    expect(game.ball.vx).toBeLessThan(0);
  });

  it('bounces off the top and bottom walls', () => {
    const game = inPlay(newGame(), { x: 160, y: 3, vy: -100 });
    game.tick(50);
    expect(game.ball.vy).toBeGreaterThan(0);

    inPlay(game, { x: 160, y: 237, vy: 100 });
    game.tick(50);
    expect(game.ball.vy).toBeLessThan(0);
  });

  it('returns the ball flat off the paddle\'s centre, 5% faster', () => {
    const game = inPlay(newGame(), { x: 20, y: 120, vx: -200 });
    game.tick(50);

    expect(near(game.ball.vx, 210)).toBeTruthy();
    expect(near(game.ball.vy, 0)).toBeTruthy();
    expect(game.hits).toBe(1);
  });

  it('returns the ball at 60° off the paddle\'s end', () => {
    expect(paddleReturn(136, 120, 210, 1)).toEqual({ vx: 210 * Math.cos(Math.PI / 3), vy: 210 * Math.sin(Math.PI / 3) });
    expect(paddleReturn(100, 120, 210, -1).vx).toBeLessThan(0);
    expect(paddleReturn(100, 120, 210, -1).vy).toBeLessThan(0);
  });

  it('caps the ball speed', () => {
    const game = inPlay(newGame(), { x: 20, y: 120, vx: -410 });
    game.tick(16);
    expect(near(Math.hypot(game.ball.vx, game.ball.vy), 420)).toBeTruthy();
  });

  it('never lets a fast ball pass through a paddle', () => {
    const game = inPlay(newGame(), { x: 60, y: 120, vx: -2000 });
    game.tick(50);
    expect(game.ball.vx).toBeGreaterThan(0);
    expect(game.aiPoints).toBe(0);
  });

  it('scores 100 for each point won', () => {
    const game = newGame();
    game.aiY = 16;
    inPlay(game, { x: 318, y: 200, vx: 300 });
    game.tick(50);

    expect(game.playerPoints).toBe(1);
    expect(game.score).toBe(100);
    expect(game.stats()).toEqual({ you: 1, computer: 0 });
    expect(game.servingTo).toBe('ai');
  });

  it('ends the match at 11, with a win bonus by difficulty', () => {
    [['easy', 500], ['medium', 1000], ['hard', 2000]].forEach(([difficulty, bonus]) => {
      const game = newGame({ difficulty });
      game.playerPoints = 10;
      game.score = 1000;
      game.aiY = 16;
      inPlay(game, { x: 318, y: 200, vx: 300 });
      game.tick(50);

      expect(game.isOver).toBeTruthy();
      expect(game.score).toBe(1100 + bonus);
    });
  });

  it('gives no bonus for a lost match', () => {
    const game = newGame();
    game.aiPoints = 10;
    game.score = 300;
    game.playerY = 16;
    inPlay(game, { x: 2, y: 200, vx: -300 });
    game.tick(50);

    expect(game.isOver).toBeTruthy();
    expect(game.score).toBe(300);
  });

  it('predicts where the ball will arrive, wall bounces included', () => {
    expect(predictY({ x: 100, y: 120, vx: 100, vy: 0 }, 200)).toBe(120);
    expect(predictY({ x: 100, y: 20, vx: 100, vy: -100 }, 200)).toBe(84);
    expect(predictY({ x: 100, y: 120, vx: 100, vy: 400 }, 200)).toBe(48);
  });

  it('lets Easy wait for mid-court, while Medium and Hard react at once', () => {
    const coming = { x: 100, y: 60, vx: 100, vy: 0 };
    expect(aiTarget('easy', coming, 0)).toBe(null);
    expect(aiTarget('medium', coming, 0)).toBe(60);
    expect(aiTarget('hard', coming, 0)).toBe(60);
    expect(aiTarget('easy', { ...coming, x: 200 }, 5)).toBe(65);
  });

  it('sends Medium and Hard back to the centre while the ball goes away', () => {
    const leaving = { x: 200, y: 60, vx: -100, vy: 0 };
    expect(aiTarget('easy', leaving, 0)).toBe(null);
    expect(aiTarget('medium', leaving, 0)).toBe(120);
    expect(aiTarget('hard', leaving, 0)).toBe(120);
  });

  it('moves the AI paddle at its difficulty\'s speed', () => {
    [['easy', 131], ['medium', 135], ['hard', 141]].forEach(([difficulty, y]) => {
      const game = inPlay(newGame({ difficulty }), { x: 200, y: 220, vx: 1 });
      game.tick(100);
      expect(near(game.aiY, y, 0.01)).toBeTruthy();
    });
  });

  it('re-rolls the AI\'s aiming error only when the player returns the ball', () => {
    const game = inPlay(new Pong({ difficulty: 'medium', random: () => 1 }), { x: 20, y: 120, vx: -200 });
    game.tick(50);
    expect(game.aiError).toBe(DIFFICULTIES.medium.error);

    game.aiError = 3;
    inPlay(game, { x: 296, y: game.aiY, vx: 200 });
    game.tick(50);
    expect(game.ball.vx).toBeLessThan(0);
    expect(game.aiError).toBe(3);
  });

  it('keeps the AI still for its reaction time after the player\'s return', () => {
    // An edge hit (y 104 on a paddle at 120): the ball leaves at an angle, so the AI must move.
    const game = inPlay(newGame({ difficulty: 'medium' }), { x: 18, y: 104, vx: -200, vy: 0 });
    game.tick(16);
    expect(game.ball.vx).toBeGreaterThan(0);
    expect(game.aiReactMs).toBe(DIFFICULTIES.medium.reactionMs);
    const still = game.aiY;
    game.tick(200);
    expect(game.aiY).toBe(still);
    game.tick(200);
    expect(game.aiY).not.toBe(still);
  });

  it('returns more balls the harder it is, and even Hard can be beaten', () => {
    // The player's shot just left the paddle, over a spread of heights, angles and aiming errors.
    const returnRate = (difficulty, speed) => {
      let returned = 0;
      const trials = 150;
      for (let k = 0; k < trials; k++) {
        const angle = ((k % 9) - 4) * 0.25;
        const game = inPlay(newGame({ difficulty }), {
          x: 16, y: 20 + ((k * 37) % 200), vx: speed * Math.cos(angle), vy: speed * Math.sin(angle),
        });
        game.aiError = (((k * 7) % 11) / 5 - 1) * DIFFICULTIES[difficulty].error;
        game.aiReactMs = DIFFICULTIES[difficulty].reactionMs;
        for (let i = 0; i < 300 && game.ball.vx > 0 && game.aiPoints + game.playerPoints === 0; i++) game.tick(16);
        if (game.ball.vx < 0) returned += 1;
      }
      return returned / trials;
    };

    [160, 420].forEach((speed) => {
      const easy = returnRate('easy', speed);
      const medium = returnRate('medium', speed);
      const hard = returnRate('hard', speed);
      expect(easy).toBeLessThan(medium);
      expect(medium).toBeLessThan(hard);
      expect(hard).toBeLessThan(1);
    });
  });

  it('has a simple touch layout, key hints, and its difficulty as level', () => {
    const game = newGame({ difficulty: 'hard' });
    expect(game.touch).toEqual({ pad: 'stick', directions: ['up', 'down'] });
    expect(game.keyHints).toEqual([{ action: 'Move', codes: ['ArrowUp', 'ArrowDown'] }]);
    expect(game.level).toBe(3);
    expect(newGame({ difficulty: 'easy' }).level).toBe(1);
  });

  it('builds from its definition, Medium by default', () => {
    expect(defaultSettings(pongGame.options)).toEqual({ difficulty: 'medium' });
    expect(pongGame.create({ difficulty: 'hard' }).difficulty).toBe('hard');
  });

  it('saves and restores its exact state', () => {
    const game = newGame();
    game.handleKey('ArrowUp');
    for (let i = 0; i < 100; i++) game.tick(16);
    game.releaseKeys();

    const copy = newGame();
    copy.restore(JSON.parse(JSON.stringify(game.snapshot())));
    expect(copy.snapshot()).toEqual(game.snapshot());

    for (let i = 0; i < 100; i++) { game.tick(16); copy.tick(16); }
    expect(copy.snapshot()).toEqual(game.snapshot());
  });

  it('gives the AI a fresh aim on every serve, so one big mistake can\'t repeat', () => {
    // Regression: a mistake past the paddle's reach, kept from the last return, made the AI
    // miss every serve after losing a point — the player could win without touching the ball.
    const game = newGame({ difficulty: 'hard' });
    game.aiError = 19;
    game.aiY = 30;
    inPlay(game, { x: 315, y: 200, vx: 300 });
    for (let i = 0; i < 10 && game.playerPoints === 0; i++) game.tick(16);
    expect(game.playerPoints).toBe(1);
    expect(game.servingTo).toBe('ai');

    // The serve comes after a second, with a fresh aim (random() = 0.5: no error)…
    for (let i = 0; i < 70; i++) game.tick(16);
    expect(game.ball.vx).toBeGreaterThan(0);
    expect(game.aiError).toBe(0);

    // …so the AI returns it instead of conceding again.
    for (let i = 0; i < 200 && game.ball.vx > 0 && game.playerPoints === 1; i++) game.tick(16);
    expect(game.ball.vx).toBeLessThan(0);
    expect(game.playerPoints).toBe(1);
  });
});
