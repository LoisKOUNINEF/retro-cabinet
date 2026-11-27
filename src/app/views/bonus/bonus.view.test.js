import { BonusView } from '#root/dist/src/app/views/bonus/bonus.view.js';
import { BONUS_CARDS, randomBonusPath } from '#root/dist/src/app/views/bonus/bonus-cards.js';
import { GAME_CARDS } from '#root/dist/src/app/views/home/game-cards.js';
import { Navigation } from '#root/dist/src/core/index.js';
import { PersistenceService } from '#root/dist/src/app/services/persistence/persistence.service.js';
import { CABINET_ICON } from '#root/dist/src/app/games/icons.js';

const toasts = () => $$('.a11y-snackbar__message').map((message) => message.textContent);
// Each toast region (in <body>) goes, with its toasts.
const removeToasts = () => $$('a11y-snackbar').forEach((region) => region.remove());

describe('BonusView', () => {
  let view;

  beforeEach(() => {
    localStorage.clear();
    useFakeTimers();
    view = new BonusView();
    view.render();
  });

  afterEach(() => {
    view.destroy();
    removeToasts();
    useRealTimers();
  });

  it('is the bonus cabinet, laid out as the home page', () => {
    expect(view.documentTitle()).toBe('Bonus Games');
    expect($('h1').textContent).toBe('Bonus Games');
    expect($('.home__games')).toBeTruthy();
  });

  it('shows one card per bonus game, then Random', () => {
    const links = $$('.home__games > li a.game-card');
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/bonus/match-four', '/bonus/dots-and-boxes', '/bonus/naval-battle', '/bonus/matching-pairs', '/bonus/code-breaker', '/bonus/minefield', '/bonus/alien-smash', '/bonus/shut-the-box', '/bonus/noughts-and-crosses']);
    expect($$('.home__games .game-card__title').map((title) => title.textContent)).toEqual(['Match Four', 'Dots and Boxes', 'Naval Battle', 'Matching Pairs', 'Code Breaker', 'Minefield', 'Alien Smash', 'Shut the Box', 'Noughts Crosses', 'Random']);
    const items = $$('.home__games > li');
    expect(items.length).toBe(BONUS_CARDS.length + 1);
    expect(items.at(-1).querySelector('button.game-card').textContent).toContain('Random');
    $$('.game-card__icon').forEach((svg) => expect(svg.querySelectorAll('rect').length).toBeGreaterThan(0));
  });

  it('gives every card rectangular pixel art', () => {
    BONUS_CARDS.forEach(({ icon }) => {
      expect(icon.length).toBeGreaterThan(0);
      icon.forEach((row) => expect(row.length).toBe(icon[0].length));
    });
  });

  it('opens a random bonus game, never one of the main cabinet', () => {
    const paths = [];
    const stop = Navigation.onNavigate(({ path }) => paths.push(path));
    $('button.game-card').click();
    stop();
    expect(BONUS_CARDS.map((card) => card.path)).toContain(paths[0]);

    const mainPaths = GAME_CARDS.map((card) => card.path);
    for (let r = 0; r < 1; r += 0.01) {
      const path = randomBonusPath(() => r);
      expect(path.startsWith('/bonus/')).toBe(true);
      expect(mainPaths).not.toContain(path);
    }
  });

  it('leads back to the main games with a frameless cabinet above the title', () => {
    const link = $('.home__bonus a.game-card--plain');
    expect(link.getAttribute('href')).toBe('/');
    expect(link.textContent.trim()).toBe('Games');
    expect(link.nextElementSibling).toBe(null);
    expect($('.home__bonus').nextElementSibling).toBe($('h1'));
    expect(link.querySelectorAll('rect').length).toBeGreaterThan(0);
    CABINET_ICON.forEach((row) => expect(row.length).toBe(CABINET_ICON[0].length));

    const paths = [];
    const stop = Navigation.onNavigate(({ path }) => paths.push(path));
    link.click();
    stop();
    expect(paths).toEqual(['/']);
  });

  it('grants the reward to a player who found it, with an Explorer toast', async () => {
    await import('a11y-elements/overlays/snackbar');
    view.onEnter();
    await flushPromises();

    expect(PersistenceService.getInstance().reward().achievement).toBe('explorer');
    expect(toasts()).toContain('Achievement unlocked: Explorer');

    // Coming back says nothing more.
    removeToasts();
    view.onEnter();
    await flushPromises();
    expect(toasts()).toEqual([]);
  });

  it('shows no toast when the reward was already earned by scores', async () => {
    await import('a11y-elements/overlays/snackbar');
    PersistenceService.getInstance().saveReward('dedicated');
    view.onEnter();
    await flushPromises();

    expect(PersistenceService.getInstance().reward().achievement).toBe('dedicated');
    expect(toasts()).toEqual([]);
  });
});
