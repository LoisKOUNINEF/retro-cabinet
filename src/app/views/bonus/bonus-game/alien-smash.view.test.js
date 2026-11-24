import { BonusGameView } from '#root/dist/src/app/views/bonus/bonus-game/bonus-game.view.js';
import { TICK_MS, alienSmashGame } from '#root/dist/src/app/games/bonus/alien-smash/alien-smash.js';
import { PersistenceService } from '#root/dist/src/app/services/persistence/persistence.service.js';

const status = () => $('.game__status').textContent;
const toggle = () => $('.game__toggle');
const stat = (key) => $(`.game__stat-value[data-stat="${key}"]`)?.textContent;
const press = (code) => document.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true }));
const upHoles = () => $$('.alien-smash-board__hole--up');
const smash = (hole) => hole.dispatchEvent(new window.Event('pointerdown', { bubbles: true }));

describe('BonusGameView (Alien Smash)', () => {
  let view;

  const open = () => {
    // random() = 0.5: crabs, no UFO.
    view = new BonusGameView(alienSmashGame, () => 0.5);
    view.render();
    view.onEnter();
  };

  beforeEach(() => {
    localStorage.clear();
    // The bonus games already earned: no Explorer toast.
    PersistenceService.getInstance().saveReward('explorer');
    PersistenceService.getInstance().saveSettings('alien-smash', { time: '15', speed: 'normal' });
    useFakeTimers();
  });

  afterEach(() => {
    view.onExit();
    view.destroy();
    useRealTimers();
  });

  it('waits for Start, with the holes disabled, a Stats section and a score table', () => {
    open();
    expect(view.documentTitle()).toBe('Alien Smash');
    expect(status()).toBe('Press Space to start');
    expect(toggle().textContent).toBe('▶ Start');
    expect($$('.alien-smash-board__hole').every((hole) => hole.disabled)).toBeTruthy();
    expect(stat('time')).toBe('15');
    expect($('.score-table__empty').textContent).toBe('No scores yet');
    // No tally for a score game.
    expect(stat('wins')).toBeUndefined();

    advanceTimersByTime(1000);
    expect(stat('time')).toBe('15');
  });

  it('starts and pauses with Space, the clock only running in between', () => {
    open();
    press('Space');
    expect(toggle().textContent).toBe('⏸ Pause');
    expect($('fieldset.game__options').disabled).toBe(true);
    advanceTimersByTime(1000);
    expect(stat('time')).toBe('14');
    expect(upHoles().length).toBeGreaterThan(0);

    press('Space');
    expect(toggle().textContent).toBe('▶ Resume');
    expect(status()).toBe('Paused - press Space to resume');
    expect($('fieldset.game__options').disabled).toBe(false);
    advanceTimersByTime(3000);
    expect(stat('time')).toBe('14');
  });

  it('pauses when the window loses focus', () => {
    open();
    toggle().click();
    advanceTimersByTime(TICK_MS * 2);
    window.dispatchEvent(new window.Event('blur'));
    expect(toggle().textContent).toBe('▶ Resume');
  });

  it('scores a smash on a click or its number key', () => {
    open();
    press('Space');
    advanceTimersByTime(300);
    smash(upHoles()[0]);
    expect(stat('score')).toBe('20');

    advanceTimersByTime(700);
    const hole = upHoles()[0];
    press(`Digit${hole.querySelector('.alien-smash-board__key').textContent}`);
    expect(stat('score')).toBe('40');
  });

  it('counts a smash pressed just before the alien leaves', () => {
    open();
    press('Space');
    advanceTimersByTime(300);
    const [hole] = upHoles();
    // Pressed while it's up; it would leave before the release.
    smash(hole);
    advanceTimersByTime(1150);
    expect(stat('score')).toBe('20');
  });

  it('records the score when the time is up, and Space plays again', () => {
    open();
    press('Space');
    advanceTimersByTime(300);
    smash(upHoles()[0]);
    advanceTimersByTime(15_000);

    expect(status()).toBe("Time's up! 20 points. New high score!");
    expect(toggle().textContent).toBe('↻ Play again');
    expect(PersistenceService.getInstance().scores('alien-smash:15-normal').map((entry) => entry.score)).toEqual([20]);
    expect($$('.score-table li').length).toBe(1);

    press('Space');
    expect(toggle().textContent).toBe('⏸ Pause');
    expect(stat('score')).toBe('0');
    expect(stat('time')).toBe('15');
  });

  it('keeps a score table per time and speed', () => {
    PersistenceService.getInstance().addScore('alien-smash:30-fast', { score: 500, level: 3, date: new Date().toISOString() });
    open();
    expect($('.score-table__empty')).toBeTruthy();
    const select = $('select[data-option="time"]');
    select.value = '30';
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
    const speed = $('select[data-option="speed"]');
    speed.value = 'fast';
    speed.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect($$('.score-table li').length).toBe(1);
  });
});
