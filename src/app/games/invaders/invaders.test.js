import { Invaders, invadersGame } from '#root/dist/src/app/games/invaders/invaders.js';
import { CANNON_Y } from '#root/dist/src/app/games/invaders/sprites.js';
import { defaultSettings } from '#root/dist/src/app/games/game.js';

// random() = 0: bombs always come from the leftmost column.
const newGame = (options = {}) => new Invaders({ random: () => 0, ...options });

// Puts a shot just below an invader: the next short tick hits it.
const shootAt = (game, invader) => {
  const rect = game.invaderRect(invader);
  game.shot = { x: rect.x + 2, y: rect.y + rect.height + 1, width: 1, height: 4 };
  game.tick(16);
};

describe('Space Invaders', () => {
  it('starts with a full fleet of 55 above the cannon', () => {
    const game = newGame();
    const count = (type) => game.invaders.filter((inv) => inv.type === type).length;

    expect(game.invaders.length).toBe(55);
    expect([count('squid'), count('crab'), count('octopus')]).toEqual([11, 22, 22]);
    expect(game.invaderRect(game.invaders[0])).toEqual({ x: 26, y: 48, width: 8, height: 8 });
    expect(game.cannonX).toBe(105);
    expect(game.lives).toBe(3);
    expect(game.shieldChunks.length).toBeGreaterThan(0);
  });

  it('starts each wave lower, as in the arcade, then cycles from wave 2', () => {
    expect([1, 2, 3, 4, 7, 9].map((firstLevel) => newGame({ firstLevel }).fleet.y)).toEqual([48, 72, 88, 96, 104, 104]);
    expect(newGame({ firstLevel: 10 }).fleet.y).toBe(72);
  });

  it('marches at the same pace on every wave', () => {
    expect(newGame({ firstLevel: 5 }).stepMs).toBe(newGame().stepMs);
  });

  it('marches one step per stepMs, swapping animation frames', () => {
    const game = newGame();
    expect(game.stepMs).toBe(880);

    game.tick(879);
    expect(game.fleet.x).toBe(24);

    game.tick(1);
    expect(game.fleet.x).toBe(26);
    expect(game.fleet.frame).toBe(1);
  });

  it('drops and turns around at the wall', () => {
    const game = newGame();
    // The fleet is 172 wide: its right edge is now at the wall margin.
    game.fleet.x = 44;

    game.tick(880);
    expect(game.fleet.y).toBe(56);
    expect(game.fleet.direction).toBe(-1);
    expect(game.fleet.x).toBe(44);

    game.tick(880);
    expect(game.fleet.x).toBe(42);
  });

  it('marches faster as invaders die, every frame for the last one', () => {
    const game = newGame();
    game.invaders = game.invaders.slice(0, 10);
    expect(game.stepMs).toBe(160);

    game.invaders = game.invaders.slice(0, 1);
    expect(game.stepMs).toBe(16);
  });

  it('moves the cannon while an arrow is held, within the field', () => {
    const game = newGame();
    game.handleKey('ArrowRight');
    game.tick(100);
    expect(game.cannonX).toBe(111);

    game.handleKeyUp('ArrowRight');
    game.tick(100);
    expect(game.cannonX).toBe(111);

    game.handleKey('ArrowRight');
    game.tick(5000);
    expect(game.cannonX).toBe(224 - 13);

    game.releaseKeys();
    game.handleKey('ArrowLeft');
    game.releaseKeys();
    game.tick(100);
    expect(game.cannonX).toBe(211);
  });

  it('fires one shot at a time from the cannon', () => {
    const game = newGame();
    game.handleKey('ArrowUp');
    expect(game.shot).toEqual({ x: 111, y: CANNON_Y - 4, width: 1, height: 4 });

    game.handleKey('ArrowUp');
    expect(game.shotsFired).toBe(1);

    game.tick(100);
    expect(game.shot.y).toBe(CANNON_Y - 4 - 24);
  });

  it('keeps firing while ArrowUp is held, once the previous shot is gone', () => {
    const game = newGame();
    game.handleKey('ArrowUp');
    game.shot = null;

    game.tick(16);
    expect(game.shotsFired).toBe(2);

    game.handleKeyUp('ArrowUp');
    game.shot = null;
    game.tick(16);
    expect(game.shotsFired).toBe(2);
  });

  it('kills invaders for 10, 20 or 30 points by type', () => {
    const game = newGame();
    const [squid, crab, octopus] = ['squid', 'crab', 'octopus'].map((type) => game.invaders.find((inv) => inv.type === type));

    shootAt(game, octopus);
    expect(game.score).toBe(10);
    shootAt(game, crab);
    expect(game.score).toBe(30);
    shootAt(game, squid);
    expect(game.score).toBe(60);
    expect(game.invaders.length).toBe(52);
    expect(game.shot).toBe(null);
  });

  it('cancels out a shot and a bomb that meet', () => {
    const game = newGame();
    game.bombs = [{ x: 111, y: 150, width: 3, height: 7 }];
    game.shot = { x: 111, y: 160, width: 1, height: 4 };

    game.tick(16);

    expect(game.shot).toBe(null);
    expect(game.bombs.length).toBe(0);
  });

  it('reloads bombs faster as the score grows', () => {
    const game = newGame();
    expect(game.bombEveryMs).toBe(800);
    game.score = 200;
    expect(game.bombEveryMs).toBe(267);
    game.score = 2500;
    expect(game.bombEveryMs).toBe(133);
    game.score = 9000;
    expect(game.bombEveryMs).toBe(117);
  });

  it('drops bombs faster once 8 invaders or fewer are left', () => {
    const game = newGame({ shields: false });
    game.bombs = [{ x: 10, y: 100, width: 3, height: 7 }];
    game.tick(100);
    expect(game.bombs[0].y).toBe(108);

    game.invaders = game.invaders.slice(0, 8);
    game.bombs = [{ x: 10, y: 100, width: 3, height: 7 }];
    game.tick(100);
    expect(game.bombs[0].y).toBe(110);
  });

  it('drops bombs from the lowest invader of a column, at most 3', () => {
    const game = newGame();
    game.tick(950);

    // The fleet stepped to x = 26 first; column 0's lowest is an octopus at 26..38.
    expect(game.bombs).toEqual([{ x: 31, y: 48 + 64 + 8, width: 3, height: 7 }]);

    game.bombs = [1, 2, 3].map((i) => ({ x: i * 10, y: 0, width: 3, height: 7 }));
    game.tick(950);
    expect(game.bombs.length).toBe(3);
  });

  it('loses a life when a bomb hits the cannon, clearing the bombs', () => {
    const game = newGame();
    game.bombs = [{ x: 110, y: CANNON_Y - 8, width: 3, height: 7 }, { x: 10, y: 100, width: 3, height: 7 }];

    game.tick(100);

    expect(game.lives).toBe(2);
    expect(game.bombs.length).toBe(0);
  });

  it('ends the game on the last life', () => {
    const game = newGame();
    game.lives = 1;
    game.bombs = [{ x: 110, y: CANNON_Y - 8, width: 3, height: 7 }];

    game.tick(100);

    expect(game.isOver).toBeTruthy();
    game.reset();
    expect(game.lives).toBe(3);
    expect(game.invaders.length).toBe(55);
  });

  it('ends the game when the invaders reach the cannon row', () => {
    const game = newGame({ shields: false });
    // The bottom row is 72 below the fleet's top: one more step lands it on the cannon row.
    game.fleet.y = 144;

    game.tick(880);

    expect(game.isOver).toBeTruthy();
  });

  it('blasts a hole in a shield and stops the shot', () => {
    const game = newGame();
    const before = game.shieldChunks.length;
    // Under the first bunker, in its notch: the shot hits the row above.
    game.shot = { x: 40, y: 206, width: 1, height: 4 };

    game.tick(16);

    expect(game.shot).toBe(null);
    expect(game.shieldChunks.length).toBe(before - 7);
    expect(game.shieldChunks.some((c) => c.x === 40 && c.y === 202)).toBeFalsy();
  });

  it('lets bombs erode shields too', () => {
    const game = newGame();
    const before = game.shieldChunks.length;
    game.bombs = [{ x: 85, y: 185, width: 3, height: 7 }];

    game.tick(16);

    expect(game.bombs.length).toBe(0);
    expect(game.shieldChunks.length).toBeLessThan(before);
  });

  it('crushes the shields invaders march over', () => {
    const game = newGame();
    const before = game.shieldChunks.length;
    // Bottom row at y 192..200: the bunkers' top.
    game.fleet.y = 128;

    game.tick(880);

    expect(game.isOver).toBeFalsy();
    expect(game.shieldChunks.length).toBeLessThan(before);
  });

  it('builds no shields with the option off', () => {
    expect(newGame({ shields: false }).shieldChunks.length).toBe(0);
  });

  it('sends a UFO across every 25 seconds, alternating sides', () => {
    const game = newGame({ shields: false });

    game.tick(24_999);
    expect(game.ufo).toBe(null);
    game.tick(1);
    expect(game.ufo).toEqual({ x: -16, direction: 1 });

    for (let i = 0; i < 7; i++) game.tick(1000);
    expect(game.ufo).toBe(null);

    game.tick(25_000);
    expect(game.ufo).toEqual({ x: 224, direction: -1 });
  });

  it('scores the UFO from the arcade table', () => {
    const game = newGame();
    game.ufo = { x: 100, direction: 1 };
    // The 9th shot is the 300-point one.
    game.shotsFired = 9;
    game.shot = { x: 105, y: 40, width: 1, height: 4 };

    game.tick(16);

    expect(game.score).toBe(300);
    expect(game.ufo).toBe(null);
  });

  it('sends no UFO with fewer than 8 invaders', () => {
    const game = newGame();
    game.invaders = game.invaders.slice(0, 7);
    game.tick(25_000);
    expect(game.ufo).toBe(null);
  });

  it('starts a lower wave, with fresh shields, once the fleet is destroyed', () => {
    const game = newGame();
    game.invaders = [game.invaders[0]];
    game.shieldChunks = [];

    shootAt(game, game.invaders[0]);

    expect(game.level).toBe(2);
    expect(game.invaders.length).toBe(55);
    expect(game.fleet.y).toBe(72);
    expect(game.shieldChunks.length).toBeGreaterThan(0);
  });

  it('builds from its definition settings, shields on and auto-fire off by default', () => {
    expect(invadersGame.options.map((o) => o.key)).toEqual(['level', 'shields', 'autoFire']);
    expect(defaultSettings(invadersGame.options)).toEqual({ level: '1', shields: 'on', autoFire: 'off' });

    const game = invadersGame.create({ level: '2', shields: 'off' });
    expect(game.level).toBe(2);
    expect(game.shieldChunks.length).toBe(0);
    expect(game.stats()).toEqual({ lives: 3 });
  });

  it('saves and restores its exact state, timers and shields included', () => {
    const game = newGame();
    game.handleKey('ArrowUp');
    for (let i = 0; i < 80; i++) game.tick(16);
    // Held keys aren't part of a save: let go first, or only the original keeps firing.
    game.handleKeyUp('ArrowUp');

    const copy = newGame();
    copy.restore(JSON.parse(JSON.stringify(game.snapshot())));
    expect(copy.snapshot()).toEqual(game.snapshot());

    for (let i = 0; i < 80; i++) { game.tick(16); copy.tick(16); }
    expect(copy.snapshot()).toEqual(game.snapshot());
  });

  it('moves on a left/right stick and fires with the touch button', () => {
    expect(newGame().touch).toEqual({ pad: 'stick', directions: ['left', 'right'], action: { label: 'Fire', code: 'ArrowUp' } });
  });

  it('turns the touch button into a hold-fire one with auto-fire', () => {
    const { touch } = invadersGame.create({ autoFire: 'on' });
    expect(touch.autoFire).toBe(true);
    expect(touch.action).toEqual({ label: 'Hold', code: 'ArrowUp' });
  });

  it('also fires with the fire key, and keeps firing while it is held', () => {
    const game = newGame();
    game.handleKey('KeyZ');
    expect(game.shotsFired).toBe(1);

    game.shot = null;
    game.tick(16);
    expect(game.shotsFired).toBe(2);

    game.handleKeyUp('KeyZ');
    game.shot = null;
    game.tick(16);
    expect(game.shotsFired).toBe(2);
    expect(game.keyHints.map((hint) => hint.action)).toEqual(['Move', 'Fire']);
  });

  it('fires with W as well as Z', () => {
    const game = newGame();
    game.handleKey('KeyW');
    expect(game.shotsFired).toBe(1);
  });
});
