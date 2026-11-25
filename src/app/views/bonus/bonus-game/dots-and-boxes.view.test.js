import { BonusGameView } from '#root/dist/src/app/views/bonus/bonus-game/bonus-game.view.js';
import { dotsAndBoxesGame } from '#root/dist/src/app/games/bonus/dots-and-boxes/dots-and-boxes.js';
import { AI_DELAY_MS } from '#root/dist/src/app/games/bonus/turns.js';
import { PersistenceService } from '#root/dist/src/app/services/persistence/persistence.service.js';

const status = () => $('.game__status').textContent;
const stat = (key) => Number($(`.game__stat-value[data-stat="${key}"]`)?.textContent);
const press = (code) => document.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true }));

describe('BonusGameView (Dots and Boxes)', () => {
  let view;

  const open = () => {
    view = new BonusGameView(dotsAndBoxesGame, () => 0.5);
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

  it('plays a line, then lets the AI answer after a moment', () => {
    open();
    expect(view.documentTitle()).toBe('Dots and Boxes');
    expect($$('.dots-boxes__box').length).toBe(25);
    expect(status()).toBe('Your turn.');
    $('.dots-boxes__line[data-index="0"]').click();
    expect(status()).toBe('Thinking…');
    advanceTimersByTime(AI_DELAY_MS);
    expect(status()).toBe('Your turn.');
    expect($$('.dots-boxes__line--ai').length).toBe(1);
  });

  it('plays a 3×3 round to the end, then tallies it', () => {
    PersistenceService.getInstance().saveSettings('dots-and-boxes', { size: '3', difficulty: 'easy' });
    open();
    for (let turn = 0; turn < 200 && !status().includes('play again'); turn++) {
      const free = $('.dots-boxes__line:not(:disabled)');
      if (free) free.click();
      else advanceTimersByTime(AI_DELAY_MS);
    }
    expect(stat('you') + stat('ai')).toBe(9);
    const { wins, draws, losses } = PersistenceService.getInstance().tally('dots-and-boxes', '3-easy');
    expect(wins + draws + losses).toBe(1);
    press('Enter');
    expect($$('.dots-boxes__line--player').length).toBe(0);
  });
});
