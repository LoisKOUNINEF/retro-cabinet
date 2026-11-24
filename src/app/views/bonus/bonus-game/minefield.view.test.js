import { BonusGameView } from '#root/dist/src/app/views/bonus/bonus-game/bonus-game.view.js';
import { minefieldGame } from '#root/dist/src/app/games/bonus/minefield/minefield.js';
import { PersistenceService } from '#root/dist/src/app/services/persistence/persistence.service.js';

const cell = (index) => $(`.minefield__cell[data-index="${index}"]`);
const status = () => $('.game__status').textContent;
const stat = (key) => $(`.game__stat-value[data-stat="${key}"]`)?.textContent;

describe('BonusGameView (Minefield)', () => {
  let view;

  const open = () => {
    view = new BonusGameView(minefieldGame, Math.random);
    view.render();
    view.onEnter();
  };

  beforeEach(() => {
    localStorage.clear();
    // The bonus games already earned: no Explorer toast.
    PersistenceService.getInstance().saveReward('explorer');
    useFakeTimers();
  });

  afterEach(() => {
    view.onExit();
    view.destroy();
    useRealTimers();
  });

  it('starts its clock on the first dig, losing no time to the moves in between', () => {
    open();
    expect(view.documentTitle()).toBe('Minefield');
    expect($$('.minefield__cell').length).toBe(81);
    expect(status()).toBe('Dig anywhere: the first cell is always safe.');
    advanceTimersByTime(3000);
    expect(stat('time')).toBe('0');

    cell(40).click();
    advanceTimersByTime(1500);
    expect(stat('time')).toBe('1');
    // A flag half-way through a second: the clock keeps the half second already gone.
    const hidden = $$('.minefield__cell--hidden')[0];
    hidden.dispatchEvent(new MouseEvent('contextmenu', { cancelable: true }));
    advanceTimersByTime(500);
    expect(stat('time')).toBe('2');
  });

  it('is lost on a mine, and tallied', () => {
    open();
    cell(40).click();
    const mine = view._game.cells.findIndex((c) => c.mine);
    cell(mine).click();
    expect(status()).toContain('Boom!');
    expect(PersistenceService.getInstance().tally('minefield', 'beginner')).toEqual({ wins: 0, draws: 0, losses: 1 });
    expect($$('.minefield__cell--mine').length).toBe(9);
    expect(cell(mine).classList.contains('minefield__cell--exploded')).toBeTruthy();
  });
});
