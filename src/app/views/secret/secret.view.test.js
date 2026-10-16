import { AI_DELAY_MS, SecretView } from '#root/dist/src/app/views/secret/secret.view.js';
import { PersistenceService } from '#root/dist/src/app/services/persistence/persistence.service.js';

const cell = (index) => $(`.ttt-board__cell[data-index="${index}"]`);
const marks = () => $$('.ttt-board__cell').map((button) => button.textContent || '.').join('');
const status = () => $('.secret__status').textContent;
const press = (code) => document.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true }));

describe('SecretView', () => {
  let view;

  const open = (random = () => 0) => {
    view = new SecretView(random);
    view.render();
    view.onEnter();
  };

  beforeEach(() => {
    localStorage.clear();
    useFakeTimers();
  });

  afterEach(() => {
    view.onExit();
    view.destroy();
    useRealTimers();
  });

  it('plays X on a click, then lets the AI think before answering', () => {
    open();
    expect(status()).toBe('Your turn (X).');

    cell(0).click();
    expect(marks()).toBe('X........');
    expect(status()).toBe('Thinking…');
    expect($$('.ttt-board__cell').every((button) => button.disabled)).toBeTruthy();

    advanceTimersByTime(AI_DELAY_MS);
    // Medium takes the centre.
    expect(marks()).toBe('X...O....');
    expect(status()).toBe('Your turn (X).');
  });

  it('lets the AI open when chosen, and remembers the options', () => {
    PersistenceService.getInstance().saveSettings('secret', { difficulty: 'hard', mark: 'O', first: 'ai' });
    open(() => 0.5);

    expect(status()).toBe('Thinking…');
    expect($('select[data-option="mark"]').value).toBe('O');
    expect($('select[data-option="difficulty"]').value).toBe('hard');

    advanceTimersByTime(AI_DELAY_MS);
    expect(marks().replace(/\./g, '')).toBe('X');
    expect(status()).toBe('Your turn (O).');
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

    expect(status()).toContain('You win!');
    expect($('.secret__tally').textContent).toBe('Wins 1 · Draws 0 · Losses 0');
    expect(PersistenceService.getInstance().tally('secret', 'easy')).toEqual({ wins: 1, draws: 0, losses: 0 });
    expect(PersistenceService.getInstance().tally('secret', 'hard')).toEqual({ wins: 0, draws: 0, losses: 0 });

    press('Enter');
    expect(marks()).toBe('.........');
  });

  it('cancels the AI move on a new round or an option change', () => {
    open();
    cell(0).click();
    $('.secret__new').click();
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
});
