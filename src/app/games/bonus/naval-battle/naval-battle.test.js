import { CHAIN_DELAY_MS, NavalBattle, navalBattleGame } from '#root/dist/src/app/games/bonus/naval-battle/naval-battle.js';
import { AI_DELAY_MS } from '#root/dist/src/app/games/bonus/turns.js';

const round = (overrides = {}) => new NavalBattle({ difficulty: 'easy', aiFirst: false, hitAgain: false, touching: true, random: () => 0, ...overrides });
// The fleet in the top rows, one ship a row, from the left.
const placeAll = (game) => [0, 10, 20, 30, 40].forEach((cell) => game.select(cell, 'place'));
const water = (game) => game.enemy.shots.findIndex((_, cell) => !game.enemy.shipAt(cell));

describe('Naval Battle round', () => {
  it('places the ships in turn where clicked, as they lie', () => {
    const game = round();
    expect(game.status).toBe('Place your Carrier (5): click a cell, R or the mouse wheel to rotate.');
    game.select(0, 'place');
    expect(game.placed).toEqual([{ id: 'carrier', cells: [0, 1, 2, 3, 4] }]);
    expect(game.status).toContain('Battleship (4)');

    // Off the grid's edge: nothing placed.
    game.select(7, 'place');
    expect(game.placed.length).toBe(1);
    game.select(9, 'place');
    expect(game.placed.length).toBe(1);
    game.select(0, 'rotate');
    game.select(9, 'aim');
    expect(game.preview).toEqual({ cells: [9, 19, 29, 39], fits: true });
    game.select(9, 'place');
    expect(game.placed[1]).toEqual({ id: 'battleship', cells: [9, 19, 29, 39] });
  });

  it('picks a placed ship back up, the way it lay', () => {
    const game = round();
    game.select(0, 'rotate');
    game.select(0, 'place');
    game.select(0, 'rotate');
    game.select(20, 'place');
    expect(game.placed.length).toBe(0);
    expect(game.horizontal).toBe(false);
    expect(game.nextShip.id).toBe('carrier');
  });

  it('lays the rest at random, clears, and only starts with the whole fleet', () => {
    const game = round();
    game.select(0, 'place');
    game.select(0, 'start');
    expect(game.phase).toBe('placing');
    game.select(0, 'random');
    expect(game.placed.length).toBe(5);
    expect(game.placed[0].cells).toEqual([0, 1, 2, 3, 4]);
    expect(game.status).toBe('Fleet ready: press Start (or Enter).');
    game.select(0, 'clear');
    expect(game.placed.length).toBe(0);
    placeAll(game);
    game.select(0, 'start');
    expect(game.phase).toBe('battle');
    expect(game.status).toBe('Your shot.');
  });

  it('takes turns: the AI answers each shot after a moment', () => {
    const game = round();
    placeAll(game);
    game.select(0, 'start');
    const cell = water(game);
    game.select(cell, 'fire');
    expect(game.status).toBe('Miss. Thinking…');
    expect(game.nextTickIn()).toBe(AI_DELAY_MS);
    game.select(cell + 1, 'fire');
    expect(game.playerShots).toBe(1);
    game.tick(AI_DELAY_MS);
    // random() = 0: the AI fires at A1, the Carrier's bow.
    expect(game.player.shots[0]).toBe('hit');
    expect(game.status).toBe('The enemy hit your ship! Your shot.');
    expect(game.turn).toBe('player');
  });

  it('gives another shot after a hit, with "Hit = shoot again"', () => {
    const game = round({ hitAgain: true, aiFirst: true });
    placeAll(game);
    game.select(0, 'start');
    expect(game.status).toBe('Thinking…');
    game.tick(AI_DELAY_MS);
    expect(game.turn).toBe('ai');
    expect(game.nextTickIn()).toBe(CHAIN_DELAY_MS);
  });

  it('is won once every enemy ship is sunk, in the fewest shots', () => {
    const game = round({ hitAgain: true });
    placeAll(game);
    game.select(0, 'start');
    game.enemy.ships.forEach(({ cells }) => cells.forEach((cell) => game.select(cell, 'fire')));
    expect(game.outcome).toBe('wins');
    expect(game.status).toContain('You sank their fleet in 17 shots!');
    expect(navalBattleGame.results.best.score(game)).toBe(17);
    expect(game.stats()).toEqual([
      { key: 'yours', label: 'Your ships', value: 5 },
      { key: 'theirs', label: 'Enemy ships', value: 0 },
      { key: 'shots', label: 'Shots', value: 17 },
    ]);
  });

  it('names the ship sunk', () => {
    const game = round({ hitAgain: true });
    placeAll(game);
    game.select(0, 'start');
    const destroyer = game.enemy.ships.find(({ id }) => id === 'destroyer');
    destroyer.cells.forEach((cell) => game.select(cell, 'fire'));
    expect(game.status).toBe('You sank their Destroyer! Your shot.');
  });

  it('plays from the keyboard: arrows, R, Enter to place, start and fire', () => {
    const game = round();
    expect(game.cursor).toBe(44);
    game.handleKey('KeyR');
    expect(game.horizontal).toBe(false);
    game.handleKey('KeyR');
    ['ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft'].forEach((code) => game.handleKey(code));
    expect(game.cursor).toBe(0);
    game.handleKey('Enter');
    expect(game.placed.length).toBe(1);
    [10, 20, 30, 40].forEach((cell) => game.select(cell, 'place'));
    game.handleKey('Enter');
    expect(game.phase).toBe('battle');
    game.handleKey('Space');
    expect(game.playerShots).toBe(1);
    expect(game.handleKey('KeyR')).toBe(false);
  });

  it('tallies per difficulty and turn rule', () => {
    expect(navalBattleGame.results.key({})).toBe('medium-one');
    expect(navalBattleGame.results.key({ difficulty: 'hard', turns: 'again' })).toBe('hard-again');
  });
});
