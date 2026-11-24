import { BonusGameView } from '#root/dist/src/app/views/bonus/bonus-game/bonus-game.view.js';
import { REVEAL_MS, rpslsGame } from '#root/dist/src/app/games/bonus/rpsls/rpsls.js';
import { PersistenceService } from '#root/dist/src/app/services/persistence/persistence.service.js';

const choice = (index) => $(`.rpsls-board__choice[data-index="${index}"]`);
const status = () => $('.game__status').textContent;
const stat = (key) => $(`.game__stat-value[data-stat="${key}"]`)?.textContent;
const press = (code) => document.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true }));

describe('BonusGameView (RPSLS)', () => {
  let view;

  // random() = 0: the AI always plays Rock.
  const open = () => {
    view = new BonusGameView(rpslsGame, () => 0);
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

  it('plays a single round: the AI shows its hand after a moment, and the result is tallied', () => {
    open();
    expect(view.documentTitle()).toBe('RPSLS');
    expect(status()).toBe('Pick your hand.');

    choice(1).click();
    expect(status()).toBe('Rock, paper, scissors, lizard, Spock…');
    advanceTimersByTime(REVEAL_MS);
    expect(status()).toContain('Paper covers Rock. You win!');
    expect(stat('wins')).toBe('1');
    expect($$('.game__stat-label').map((label) => label.textContent)).toEqual(['You', 'Opponent', 'Wins', 'Draws', 'Losses']);
    expect(PersistenceService.getInstance().tally('rpsls', 'single')).toEqual({ wins: 1, draws: 0, losses: 0 });

    press('Enter');
    expect(status()).toBe('Pick your hand.');
  });

  it('plays a best of 3 with the number keys, tallying the match once', () => {
    PersistenceService.getInstance().saveSettings('rpsls', { match: '3' });
    open();
    press('Digit3');
    advanceTimersByTime(REVEAL_MS);
    expect(stat('ai')).toBe('1');
    expect(status()).toContain('Rock crushes Scissors. Your opponent\'s round.');
    press('Digit1');
    advanceTimersByTime(REVEAL_MS);
    expect(status()).toContain('a draw. Again!');
    press('Digit4');
    advanceTimersByTime(REVEAL_MS);
    expect(status()).toContain('Your opponent wins the match.');
    expect(PersistenceService.getInstance().tally('rpsls', '3')).toEqual({ wins: 0, draws: 0, losses: 1 });
  });
});
