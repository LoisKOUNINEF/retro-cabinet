import { BonusGameView } from '#root/dist/src/app/views/bonus/bonus-game/bonus-game.view.js';
import { CAPTURE_MS, SOW_MS, wariGame } from '#root/dist/src/app/games/bonus/wari/wari.js';
import { codeBreakerGame } from '#root/dist/src/app/games/bonus/code-breaker/code-breaker.js';
import { AI_DELAY_MS } from '#root/dist/src/app/games/bonus/turns.js';
import { Navigation } from '#root/dist/src/core/index.js';
import { PersistenceService } from '#root/dist/src/app/services/persistence/persistence.service.js';

const pit = (index) => $(`.wari__pit-button[data-index="${index}"]`);
// Every pit's seeds, 0–11: the player's row, then the opponent's (shown from its pit 11).
const seeds = () => [
  ...$$('.wari__pit-button .wari__count'),
  ...$$('.wari__row--ai .wari__count').reverse(),
].map((count) => Number(count.textContent));
const FRESH = Array(12).fill(4);
const status = () => $('.game__status').textContent;
const stat = (key) => $(`.game__stat-value[data-stat="${key}"]`)?.textContent;
const menuItems = () => $$('#game-menu [role="menuitem"]');
const item = (label) => menuItems().find((el) => el.textContent === label);
const navigations = (fn) => {
  const paths = [];
  const stop = Navigation.onNavigate(({ path }) => paths.push(path));
  fn();
  stop();
  return paths;
};
const controlLines = () => $$('[id^="game-controls-"] li').map((li) => li.textContent);
const ruleLines = () => $$('[id^="game-rules-"] li').map((li) => li.textContent);
const press = (code) => document.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true }));

// Wari dealt one move from the player's win: pit 6 (1 seed) makes 2 in the AI's pit 7.
const nearWin = {
  ...wariGame,
  create: (settings, random) => {
    const game = wariGame.create(settings, random);
    game.state = { ...game.state, pits: [0, 0, 0, 0, 0, 1, 1, 0, 0, 3, 0, 0], stores: { player: 23, ai: 18 } };
    return game;
  },
};

// The view as every bonus game uses it, played here with Wari.
describe('BonusGameView', () => {
  let view;

  const open = (definition = wariGame, random = () => 0) => {
    view = new BonusGameView(definition, random);
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

  it('plays a move on a click, shown step by step, then lets the AI think before answering', () => {
    open();
    expect(view.documentTitle()).toBe('Wari');
    expect(status()).toBe('Your turn: pick a pit.');

    pit(0).click();
    expect(status()).toBe('Sowing…');
    expect($$('.wari__pit-button').every((button) => button.disabled)).toBeTruthy();
    advanceTimersByTime(SOW_MS);
    expect(seeds().slice(0, 3)).toEqual([0, 5, 4]);

    advanceTimersByTime(3 * SOW_MS);
    expect(seeds()).toEqual([0, 5, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4]);
    expect(status()).toBe('Thinking…');

    advanceTimersByTime(AI_DELAY_MS + 4 * SOW_MS);
    // The AI emptied one of its pits.
    expect(seeds().slice(6).filter((n) => n === 0).length).toBe(1);
    expect(status()).toBe('Your turn: pick a pit.');
  });

  it('lets the AI open when chosen, and remembers the options', () => {
    PersistenceService.getInstance().saveSettings('wari', { difficulty: 'hard', first: 'ai' });
    open();

    expect(status()).toBe('Thinking…');
    expect($('select[data-option="first"]').value).toBe('ai');
    expect($('select[data-option="difficulty"]').value).toBe('hard');

    advanceTimersByTime(AI_DELAY_MS + 4 * SOW_MS);
    expect(seeds().slice(6).filter((n) => n === 0).length).toBe(1);
    expect(status()).toBe('Your turn: pick a pit.');
  });

  it('plays with the keyboard: arrows move the cursor, Enter plays', () => {
    open();
    press('ArrowRight');
    press('ArrowRight');
    expect(pit(2).classList.contains('wari__pit--cursor')).toBeTruthy();

    press('Enter');
    expect(status()).toBe('Sowing…');
    advanceTimersByTime(4 * SOW_MS);
    expect(seeds().slice(0, 7)).toEqual([4, 4, 0, 5, 5, 5, 5]);
  });

  it('lists the round\'s keys under Controls', async () => {
    open();
    await flushPromises();
    expect(controlLines()).toEqual(['Aim: ← →', 'Sow: Enter or Space', 'Sow a pit: 1 to 6', 'Or click one of your pits.']);
  });

  it('says tap instead of click on touch devices', async () => {
    document.documentElement.classList.add('touch');
    open();
    await flushPromises();
    expect(controlLines().at(-1)).toBe('Or tap one of your pits.');
    document.documentElement.classList.remove('touch');
  });

  it('rebuilds the Controls when an option changes the keys', async () => {
    PersistenceService.getInstance().saveSettings('code-breaker', { difficulty: 'easy' });
    open(codeBreakerGame);
    await flushPromises();
    expect(controlLines()[0]).toBe('Peg: 1 to 6');
    expect(ruleLines()[0]).toBe('Goal: find the secret code of 4 pegs in 10 tries.');

    const select = $('select[data-option="difficulty"]');
    select.value = 'hard';
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
    await flushPromises();
    expect(controlLines()[0]).toBe('Peg: 1 to 9');
    expect(ruleLines()[0]).toBe('Goal: find the secret code of 5 pegs in 10 tries.');
    expect($$('a11y-popover').length).toBe(2);
  });

  it('records the result in the tally for the difficulty', () => {
    open(nearWin);
    pit(5).click();
    advanceTimersByTime(SOW_MS + CAPTURE_MS);

    expect(status()).toContain('You take 2. You win 25 to 18!');
    expect($$('.game__stat-label').map((label) => label.textContent)).toEqual(['You', 'Opponent', 'Wins', 'Draws', 'Losses']);
    expect(stat('you')).toBe('25');
    expect(stat('wins')).toBe('1');
    expect(PersistenceService.getInstance().tally('wari', 'medium')).toEqual({ wins: 1, draws: 0, losses: 0 });
    expect(PersistenceService.getInstance().tally('wari', 'hard')).toEqual({ wins: 0, draws: 0, losses: 0 });

    press('Enter');
    expect(status()).toBe('Your turn: pick a pit.');
  });

  it('cancels the AI move on a new round or an option change', () => {
    open();
    pit(0).click();
    $('.game__toggle').click();
    advanceTimersByTime(AI_DELAY_MS + 8 * SOW_MS);
    expect(seeds()).toEqual(FRESH);

    pit(0).click();
    const select = $('select[data-option="difficulty"]');
    select.value = 'hard';
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
    advanceTimersByTime(AI_DELAY_MS + 8 * SOW_MS);
    expect(seeds()).toEqual(FRESH);
    expect(PersistenceService.getInstance().settings('wari', [{ key: 'difficulty', choices: [{ value: 'hard' }] }]))
      .toEqual({ difficulty: 'hard' });
  });

  it('has a games menu: the bonus hub, each bonus game (this one current) and Random', () => {
    open();
    expect($('.game__back').textContent).toBe('Games');
    expect(menuItems().map((el) => el.textContent)).toEqual(['All bonus games', 'Match Four', 'Dots and Boxes', 'Wari', 'Minefield', 'Code Breaker', 'Matching Pairs', 'Naval Battle', 'Alien Smash', 'Shut the Box', 'Random']);
    expect(item('Wari').getAttribute('aria-current')).toBe('page');

    // No way back to the main cabinet's games from here.
    expect(menuItems().some((el) => el.textContent === 'All games')).toBe(false);
    expect(navigations(() => item('All bonus games').click())).toEqual(['/bonus']);
    expect(navigations(() => item('Wari').click())).toEqual([]);
    // Random never leaves the bonus games.
    const [random] = navigations(() => item('Random').click());
    expect(random.startsWith('/bonus')).toBe(true);
    expect(random).not.toBe('/bonus/wari');
  });

  it('waits for nothing while the page is hidden', () => {
    PersistenceService.getInstance().saveSettings('wari', { difficulty: 'easy', first: 'ai' });
    open();
    view.onExit();
    advanceTimersByTime(AI_DELAY_MS * 2);
    expect(seeds()).toEqual(FRESH);
    view.onEnter();
    advanceTimersByTime(AI_DELAY_MS + 4 * SOW_MS);
    // Easy with random() = 0 sows its first pit.
    expect(seeds()).toEqual([4, 4, 4, 4, 4, 4, 0, 5, 5, 5, 5, 4]);
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
