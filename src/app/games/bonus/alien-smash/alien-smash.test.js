import { HITS_PER_LEVEL, HIT_MS, HOLE_KEYS, LEAVE_MS, POINTS, STAY_MS, TICK_MS, UFO_CHANCE, ALIEN_SMASH_OPTIONS, AlienSmash, alienSmashGame } from '#root/dist/src/app/games/bonus/alien-smash/alien-smash.js';
import { defaultSettings, levelSpeed } from '#root/dist/src/app/games/game.js';

// random() always `r`: with 0.5, aliens are crabs and nothing is a UFO.
const round = (options = {}) => new AlienSmash({ seconds: 30, speed: 'normal', random: () => 0.5, ...options });
const up = (game) => game.holes.flatMap((hole, i) => (hole.target && hole.state === 'up' ? [i] : []));
// Runs the clock for `ms`, in TICK_MS steps.
const run = (game, ms) => {
  for (let t = 0; t < ms; t += TICK_MS) game.tick(TICK_MS);
};

describe('Alien Smash', () => {
  it('defaults to 30 seconds at normal speed', () => {
    expect(defaultSettings(ALIEN_SMASH_OPTIONS)).toEqual({ time: '30', speed: 'normal' });
  });

  it('pops an alien shortly after the start, then more, which go back down after their stay', () => {
    const game = round();
    expect(up(game)).toEqual([]);
    expect(game.nextTickIn()).toBe(TICK_MS);
    run(game, 300);
    expect(up(game).length).toBe(1);
    const [first] = up(game);
    expect(game.holes[first].target).toBe('crab');
    expect(game.holes[first].points).toBe(POINTS.crab);

    // The next one comes 0.6 × the stay later (random() = 0.5: no jitter): at 990 ms.
    run(game, 700);
    expect(up(game).length).toBe(2);
    // The first starts sinking back after its 1150 ms stay (at 1450 ms), and is gone LEAVE_MS later.
    run(game, 500);
    expect(game.holes[first].state).toBe('leaving');
    expect(up(game).length).toBe(1);
    run(game, LEAVE_MS);
    // Gone (a new alien may have popped up in the emptied hole since).
    expect(game.holes.some((hole) => hole.state === 'leaving')).toBe(false);
    expect(game.score).toBe(0);
  });

  it('picks aliens by their odds, and the odd UFO', () => {
    const kind = (r) => {
      const game = round({ random: () => r });
      run(game, 300);
      return game.holes[up(game)[0]].target;
    };
    // Below UFO_CHANCE: a UFO, worth 50 to 150.
    expect(kind(UFO_CHANCE / 2)).toBe('ufo');
    expect(kind(0.3)).toBe('octopus');
    expect(kind(0.6)).toBe('crab');
    expect(kind(0.9)).toBe('squid');
  });

  it('scores a smash once, shows the hit, then empties the hole', () => {
    const game = round();
    run(game, 300);
    const [hole] = up(game);
    game.select(hole);
    expect(game.score).toBe(20);
    expect(game.hits).toBe(1);
    expect(game.holes[hole].state).toBe('hit');
    game.select(hole);
    expect(game.score).toBe(20);

    game.tick(HIT_MS);
    expect(game.holes[hole].target).toBe(null);
  });

  it('can\'t hit an alien once it is sinking back', () => {
    const game = round();
    run(game, 300);
    const [hole] = up(game);
    run(game, STAY_MS.normal);
    expect(game.holes[hole].state).toBe('leaving');
    game.select(hole);
    expect(game.score).toBe(0);
    expect(game.holes[hole].state).toBe('leaving');
  });

  it('ignores smashes on empty holes', () => {
    const game = round();
    game.select(0);
    expect(game.score).toBe(0);
    expect(game.cursor).toBe(0);
  });

  it('levels up every 10 hits, and aliens then stay up for less time', () => {
    const game = round();
    const firstStay = game.stay;
    while (game.hits < HITS_PER_LEVEL) {
      game.tick(TICK_MS);
      up(game).forEach((hole) => game.select(hole));
    }
    expect(game.level).toBe(2);
    expect(game.stay).toBe(levelSpeed(STAY_MS.normal, 2));
    expect(game.stay).toBeLessThan(firstStay);
  });

  it('ends when the time is up, clearing the holes', () => {
    const game = round({ seconds: 15 });
    expect(game.stats().at(-1)).toEqual({ key: 'time', label: 'Time', value: 15 });
    run(game, 14_000);
    expect(game.isOver).toBe(false);
    run(game, 1_000);
    expect(game.isOver).toBe(true);
    expect(up(game)).toEqual([]);
    expect(game.nextTickIn()).toBe(null);
    expect(game.status).toBe(`Time's up! ${game.score} points.`);
    game.select(0);
    expect(game.score).toBe(0);
  });

  it('smashes with the number keys laid out as a numpad, or aims with the arrows and Enter', () => {
    const game = round();
    run(game, 300);
    const [hole] = up(game);
    expect(game.handleKey(`Digit${HOLE_KEYS[hole]}`)).toBe(true);
    expect(game.score).toBe(20);

    expect(HOLE_KEYS.slice(0, 3)).toEqual([7, 8, 9]);
    expect(game.handleKey('Numpad7')).toBe(true);
    expect(game.cursor).toBe(0);
    game.handleKey('ArrowLeft');
    game.handleKey('ArrowUp');
    expect(game.cursor).toBe(0);
    game.handleKey('ArrowDown');
    game.handleKey('ArrowDown');
    game.handleKey('ArrowDown');
    game.handleKey('ArrowRight');
    expect(game.cursor).toBe(7);
    expect(game.handleKey('Enter')).toBe(true);
    expect(game.handleKey('KeyA')).toBe(false);
  });

  it('is defined for the BonusGameView: realtime, a score table per time and speed', () => {
    expect(alienSmashGame.id).toBe('alien-smash');
    expect(alienSmashGame.realtime).toBeDefined();
    expect(alienSmashGame.results.kind).toBe('scores');
    expect(alienSmashGame.results.key({ time: '60', speed: 'fast' })).toBe('60-fast');
    const game = alienSmashGame.create({ time: '15', speed: 'slow' }, () => 0.5);
    expect(game.timeLeft).toBe(15_000);
    expect(game.stay).toBe(STAY_MS.slow);
    expect(alienSmashGame.board.config(game, false)).toEqual({
      holes: Array.from({ length: 9 }, () => ({ target: null, state: 'up', points: 0 })),
      cursor: 4,
      active: false,
    });
  });
});
