import { BonusGameView } from '#root/dist/src/app/views/bonus/bonus-game/bonus-game.view.js';
import { codeBreakerGame } from '#root/dist/src/app/games/bonus/code-breaker/code-breaker.js';
import { PersistenceService } from '#root/dist/src/app/services/persistence/persistence.service.js';

const colour = (index) => $$('.code-breaker__button--colour')[index];
const status = () => $('.game__status').textContent;
const stat = (key) => $(`.game__stat-value[data-stat="${key}"]`)?.textContent;
const press = (code) => document.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true }));

describe('BonusGameView (Code Breaker)', () => {
  let view;

  // random() = 0: the code is all Red on Normal.
  const open = () => {
    view = new BonusGameView(codeBreakerGame, () => 0);
    view.render();
    view.onEnter();
  };

  beforeEach(() => {
    localStorage.clear();
    // The bonus games already earned: no Explorer toast.
    PersistenceService.getInstance().saveReward('explorer');
  });

  afterEach(() => {
    view.onExit();
    view.destroy();
  });

  it('cracks the code with the mouse, tallying the win and the fewest guesses', () => {
    open();
    expect(view.documentTitle()).toBe('Code Breaker');
    expect(status()).toBe('Guess 1 of 10: colours may repeat.');

    [1, 1, 1, 1].forEach((i) => colour(i).click());
    $('.code-breaker__check').click();
    expect(status()).toBe('0 in place, 0 misplaced. Guess 2 of 10: colours may repeat.');
    expect(stat('guesses')).toBe('1/10');

    [0, 0, 0, 0].forEach((i) => colour(i).click());
    $('.code-breaker__check').click();
    expect(status()).toContain('Cracked in 2 guesses!');
    expect(PersistenceService.getInstance().tally('code-breaker', 'normal-10')).toEqual({ wins: 1, draws: 0, losses: 0 });
    expect(PersistenceService.getInstance().best('code-breaker', 'normal-10')).toBe(2);
    expect($('.code-breaker__row--code').getAttribute('aria-label')).toBe('The code: Red, Red, Red, Red');

    press('Enter');
    expect(status()).toBe('Guess 1 of 10: colours may repeat.');
  });

  it('plays Hard from the keyboard, with five holes and Empty', () => {
    PersistenceService.getInstance().saveSettings('code-breaker', { difficulty: 'hard', tries: '8' });
    open();
    expect($$('.code-breaker__button--slot').length).toBe(5);
    expect(colour(8).getAttribute('aria-label')).toBe('Empty, key 9');
    ['Digit9', 'Digit1', 'Digit1', 'Digit1', 'Digit1'].forEach(press);
    press('Enter');
    expect(status()).toBe('4 in place, 0 misplaced. Guess 2 of 8: colours may repeat.');
  });
});
