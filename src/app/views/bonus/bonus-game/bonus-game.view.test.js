import { BonusGameView } from '#root/dist/src/app/views/bonus/bonus-game/bonus-game.view.js';
import { AI_DELAY_MS, noughtsCrossesGame } from '#root/dist/src/app/games/bonus/noughts-and-crosses/noughts-and-crosses.js';
import { Navigation } from '#root/dist/src/core/index.js';
import { PersistenceService } from '#root/dist/src/app/services/persistence/persistence.service.js';

const cell = (index) => $(`.ttt-board__cell[data-index="${index}"]`);
const marks = () => $$('.ttt-board__cell').map((button) => button.textContent || '.').join('');
const status = () => $('.game__status').textContent;
const menuItems = () => $$('#game-menu [role="menuitem"]');
const item = (label) => menuItems().find((el) => el.textContent === label);
const navigations = (fn) => {
  const paths = [];
  const stop = Navigation.onNavigate(({ path }) => paths.push(path));
  fn();
  stop();
  return paths;
};
const press = (code) => document.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true }));

describe('BonusGameView', () => {
  let view;

  const open = (random = () => 0) => {
    view = new BonusGameView(noughtsCrossesGame, random);
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

  it('plays X on a click, then lets the AI think before answering', () => {
    open();
    expect(view.documentTitle()).toBe('Noughts & Crosses');
    expect(status()).toBe('My turn (X).');

    cell(0).click();
    expect(marks()).toBe('X........');
    expect(status()).toBe('Evil Me is thinking…');
    expect($$('.ttt-board__cell').every((button) => button.disabled)).toBeTruthy();

    advanceTimersByTime(AI_DELAY_MS);
    // Medium takes the centre.
    expect(marks()).toBe('X...O....');
    expect(status()).toBe('My turn (X).');
  });

  it('lets the AI open when chosen, and remembers the options', () => {
    PersistenceService.getInstance().saveSettings('secret', { difficulty: 'hard', mark: 'O', first: 'ai' });
    open(() => 0.5);

    expect(status()).toBe('Evil Me is thinking…');
    expect($('select[data-option="mark"]').value).toBe('O');
    expect($('select[data-option="difficulty"]').value).toBe('hard');

    advanceTimersByTime(AI_DELAY_MS);
    expect(marks().replace(/\./g, '')).toBe('X');
    expect(status()).toBe('My turn (O).');
  });

  it('plays with the keyboard: arrows move the cursor, Enter plays', () => {
    open();
    press('ArrowLeft');
    press('ArrowUp');
    expect(cell(0).classList.contains('ttt-board__cell--cursor')).toBeTruthy();

    press('ArrowUp');
    press('Enter');
    expect(marks()).toBe('X........');
  });

  it('records the result in the tally for the difficulty', () => {
    PersistenceService.getInstance().saveSettings('secret', { difficulty: 'easy', mark: 'X', first: 'you' });
    // Easy with random() = 0 always takes the first free cell: 0, then 1.
    open();
    [4, 2, 6].forEach((index) => {
      cell(index).click();
      advanceTimersByTime(AI_DELAY_MS);
    });

    expect(status()).toContain('I win!');
    expect($$('.game__stat-value').map((value) => value.textContent)).toEqual(['1', '0', '0']);
    // The two sides by name; a draw is still a draw.
    expect($$('.game__stat-label').map((label) => label.textContent)).toEqual(['Me', 'Draws', 'Evil Me']);
    expect(PersistenceService.getInstance().tally('secret', 'easy')).toEqual({ wins: 1, draws: 0, losses: 0 });
    expect(PersistenceService.getInstance().tally('secret', 'hard')).toEqual({ wins: 0, draws: 0, losses: 0 });

    press('Enter');
    expect(marks()).toBe('.........');
  });

  it('cancels the AI move on a new round or an option change', () => {
    open();
    cell(0).click();
    $('.game__toggle').click();
    advanceTimersByTime(AI_DELAY_MS);
    expect(marks()).toBe('.........');

    cell(0).click();
    const select = $('select[data-option="difficulty"]');
    select.value = 'hard';
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
    advanceTimersByTime(AI_DELAY_MS);
    expect(marks()).toBe('.........');
    expect(PersistenceService.getInstance().settings('secret', [{ key: 'difficulty', choices: [{ value: 'hard' }] }]))
      .toEqual({ difficulty: 'hard' });
  });

  it('has a games menu: the bonus hub, each bonus game (this one current) and Random', () => {
    open();
    expect($('.game__back').textContent).toBe('Games');
    expect(menuItems().map((el) => el.textContent)).toEqual(['All bonus games', 'Match Four', 'Dots and Boxes', 'Naval Battle', 'Matching Pairs', 'Code Breaker', 'Minefield', 'Alien Smash', 'Shut the Box', 'Noughts & Crosses', 'Random']);
    expect(item('Noughts & Crosses').getAttribute('aria-current')).toBe('page');

    // No way back to the main cabinet's games from here.
    expect(menuItems().some((el) => el.textContent === 'All games')).toBe(false);
    expect(navigations(() => item('All bonus games').click())).toEqual(['/bonus']);
    expect(navigations(() => item('Noughts & Crosses').click())).toEqual([]);
    // Random never leaves the bonus games.
    const [random] = navigations(() => item('Random').click());
    expect(random.startsWith('/bonus')).toBe(true);
    expect(random).not.toBe('/bonus/noughts-and-crosses');
  });

  it('waits for nothing while the page is hidden', () => {
    PersistenceService.getInstance().saveSettings('secret', { difficulty: 'easy', mark: 'X', first: 'ai' });
    open();
    view.onExit();
    advanceTimersByTime(AI_DELAY_MS * 2);
    expect(marks()).toBe('.........');
    view.onEnter();
    advanceTimersByTime(AI_DELAY_MS);
    // The player is X, so the AI opens with O.
    expect(marks()).toBe('O........');
  });

  it('takes its menu away with the view', () => {
    open();
    expect($$('a11y-dropdown').length).toBe(1);
    view.onExit();
    view.destroy();
    expect($('a11y-dropdown')).toBeFalsy();
    open();
  });

  it('grants the bonus games to a player who found one of them first', () => {
    localStorage.clear();
    open();
    expect(PersistenceService.getInstance().reward().achievement).toBe('explorer');
  });
});
