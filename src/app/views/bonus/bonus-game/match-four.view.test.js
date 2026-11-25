import { BonusGameView } from '#root/dist/src/app/views/bonus/bonus-game/bonus-game.view.js';
import { matchFourGame } from '#root/dist/src/app/games/bonus/match-four/match-four.js';
import { AI_DELAY_MS } from '#root/dist/src/app/games/bonus/turns.js';
import { PersistenceService } from '#root/dist/src/app/services/persistence/persistence.service.js';

const column = (index) => $(`.m4-board__column[data-index="${index}"]`);
// The bottom row, as letters: 'r', 'y' or '.'.
const bottom = () => $$('.m4-board__column').map((button) => {
  const cell = [...button.querySelectorAll('.m4-board__cell')].at(-1);
  return cell.classList.contains('m4-board__cell--red') ? 'r' : cell.classList.contains('m4-board__cell--yellow') ? 'y' : '.';
}).join('');
const status = () => $('.game__status').textContent;
const press = (code) => document.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true }));

describe('BonusGameView (Match Four)', () => {
  let view;

  const open = (random = () => 0) => {
    view = new BonusGameView(matchFourGame, random);
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

  it('drops a disc on a click, then lets the AI think before answering', () => {
    open();
    expect(view.documentTitle()).toBe('Match Four');
    expect($('h1').textContent).toBe('Match Four');
    expect(status()).toBe('Your turn (Red).');

    column(0).click();
    expect(bottom()).toBe('r......');
    expect(status()).toBe('Thinking…');

    advanceTimersByTime(AI_DELAY_MS);
    // Medium, nothing to win or block: the centre.
    expect(bottom()).toBe('r..y...');
    expect(status()).toBe('Your turn (Red).');
  });

  it('plays with the keyboard, and remembers the options', () => {
    PersistenceService.getInstance().saveSettings('match-four', { difficulty: 'easy', colour: 'yellow', first: 'you' });
    open();
    expect($('select[data-option="colour"]').value).toBe('yellow');

    press('ArrowRight');
    press('Enter');
    expect(bottom()).toBe('....y..');
    press('Digit1');
    // The AI is still thinking: ignored.
    expect(bottom()).toBe('....y..');
  });

  it('records the result in the tally for the difficulty, and Enter starts a new round', () => {
    PersistenceService.getInstance().saveSettings('match-four', { difficulty: 'easy', colour: 'red', first: 'you' });
    open();
    [3, 4, 5, 6].forEach((index) => {
      column(index).click();
      advanceTimersByTime(AI_DELAY_MS);
    });

    expect(status()).toContain('You win!');
    expect($$('.game__stat-value').map((value) => value.textContent)).toEqual(['1', '0', '0']);
    expect(PersistenceService.getInstance().tally('match-four', 'easy')).toEqual({ wins: 1, draws: 0, losses: 0 });

    press('Enter');
    expect(bottom()).toBe('.......');
  });

  it('cancels the AI move on an option change', () => {
    open();
    column(0).click();
    const select = $('select[data-option="difficulty"]');
    select.value = 'hard';
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
    advanceTimersByTime(AI_DELAY_MS);
    expect(bottom()).toBe('.......');
    expect(status()).toBe('Your turn (Red).');
  });
});
