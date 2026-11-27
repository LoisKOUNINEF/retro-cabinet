import { BonusGameView } from '#root/dist/src/app/views/bonus/bonus-game/bonus-game.view.js';
import { ROLL_MS, TURN_PAUSE_MS, shutTheBoxGame } from '#root/dist/src/app/games/bonus/shut-the-box/shut-the-box.js';
import { AI_DELAY_MS } from '#root/dist/src/app/games/bonus/turns.js';
import { PersistenceService } from '#root/dist/src/app/services/persistence/persistence.service.js';

const tile = (n) => $(`.shut-the-box__tile-button[data-index="${n - 1}"]`);
const status = () => $('.game__status').textContent;
const stat = (key) => $(`.game__stat-value[data-stat="${key}"]`)?.textContent;
const labels = () => $$('.game__stat-label').map((label) => label.textContent);
const press = (code) => document.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true }));

describe('BonusGameView (Shut the Box)', () => {
  let view;

  // random() rolling the given dice values, then 1s.
  const open = (...values) => {
    view = new BonusGameView(shutTheBoxGame, () => ((values.shift() ?? 1) - 0.5) / 6);
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

  it('plays a solo round to its end, tallying the loss and keeping the lowest score', () => {
    // 6+6 shuts 9 and 3, 1+1 shuts 2, then 1+1 again matches nothing left.
    open(6, 6, 1, 1, 1, 1);
    expect(view.documentTitle()).toBe('Shut the Box');
    expect(status()).toBe('Roll the dice.');
    expect(labels()).toEqual(['Score', 'Tiles shut', 'Wins', 'Losses', 'Lowest score']);
    expect(stat('best')).toBe('—');

    $('.shut-the-box__roll').click();
    expect(status()).toBe('Rolling…');
    advanceTimersByTime(ROLL_MS);
    expect(status()).toBe('Shut tiles adding up to 12.');
    tile(9).click();
    tile(3).click();
    expect(stat('score')).toBe('33');

    press('KeyR');
    advanceTimersByTime(ROLL_MS);
    press('Digit2');
    press('Enter');
    advanceTimersByTime(ROLL_MS);
    expect(status()).toBe('Nothing adds up to 2: you score 31. Press Enter or New round to play again.');
    expect(stat('losses')).toBe('1');
    expect(stat('best')).toBe('31');
    expect(PersistenceService.getInstance().tally('shut-the-box', '9-solo-off')).toEqual({ wins: 0, draws: 0, losses: 1 });
    expect(PersistenceService.getInstance().best('shut-the-box', '9-solo-off')).toBe(31);

    press('Enter');
    expect(status()).toBe('Roll the dice.');
  });

  it('plays the opponent\'s turn on its own after the player\'s, with draws in the tally', () => {
    PersistenceService.getInstance().saveSettings('shut-the-box', { players: 'ai' });
    // The player: 1+1 shuts 2, then 1+1 again matches nothing. The AI: 6+6 shuts 9 and 3,
    // 1+1 shuts its 2, then 1+1 again matches nothing.
    open(1, 1, 1, 1, 6, 6);
    expect(labels()).toEqual(['You', 'Opponent', 'Wins', 'Draws', 'Losses', 'Lowest score']);
    press('KeyR');
    advanceTimersByTime(ROLL_MS);
    press('Digit2');
    press('KeyR');
    advanceTimersByTime(ROLL_MS);
    expect(status()).toBe('You score 43. Your opponent\'s turn…');
    expect($('.shut-the-box__box--opponent').classList.contains('shut-the-box__box--playing')).toBeTruthy();

    advanceTimersByTime(TURN_PAUSE_MS + ROLL_MS + AI_DELAY_MS);
    expect(stat('ai')).toBe('33');
    advanceTimersByTime(2 * (AI_DELAY_MS + ROLL_MS) + AI_DELAY_MS);
    expect(status()).toBe('You score 43, your opponent 31. Your opponent wins. Press Enter or New round to play again.');
    expect(PersistenceService.getInstance().tally('shut-the-box', '9-ai-off')).toEqual({ wins: 0, draws: 0, losses: 1 });
    expect(PersistenceService.getInstance().best('shut-the-box', '9-ai-off')).toBe(43);
  });
});
