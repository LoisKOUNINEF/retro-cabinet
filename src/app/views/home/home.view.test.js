import { HomeView } from '#root/dist/src/app/views/home/home.view.js';
import { Navigation } from '#root/dist/src/core/index.js';
import { GAME_CARDS } from '#root/dist/src/app/views/home/game-cards.js';
import { PersistenceService } from '#root/dist/src/app/services/persistence/persistence.service.js';
import { CUP_ICON } from '#root/dist/src/app/games/icons.js';

describe('HomeView', () => {
  let view;

  beforeEach(() => {
    localStorage.clear();
    view = new HomeView();
    view.render();
  });

  afterEach(() => view.destroy());

  it('names the tab after the site', () => {
    expect(view.documentTitle()).toBe('Retro Cabinet');
  });

  it('shows one card per game, in a list', () => {
    const cards = $$('.home__games > li a.game-card');
    expect(cards.length).toBe(9);
    expect(cards.map((card) => card.getAttribute('href'))).toEqual([
      '/games/falling-blocks', '/games/maze-chase', '/games/alien-attack', '/games/snake', '/games/brick-breaker', '/games/space-rocks',
      '/games/jewel-drop', '/games/frog-crossing', '/games/table-tennis',
    ]);
  });

  it('keeps the bonus games off the list', () => {
    expect(GAME_CARDS.some((card) => card.path.includes('bonus'))).toBeFalsy();
    expect($('a[href="/bonus"]')).toBeFalsy();
  });

  it('gives every card an icon with rectangular pixel art', () => {
    GAME_CARDS.forEach(({ icon }) => {
      expect(icon.length).toBeGreaterThan(0);
      icon.forEach((row) => expect(row.length).toBe(icon[0].length));
    });
    $$('.game-card__icon').forEach((svg) => expect(svg.querySelectorAll('rect').length).toBeGreaterThan(0));
  });

  it('ends with a Random card that opens one of the games', () => {
    const items = $$('.home__games > li');
    expect(items.length).toBe(10);
    const random = items[9].querySelector('button.game-card');
    expect(random.textContent).toContain('Random');

    const paths = [];
    const stop = Navigation.onNavigate(({ path }) => paths.push(path));
    random.click();
    stop();

    expect(paths.length).toBe(1);
    expect(GAME_CARDS.map((card) => card.path)).toContain(paths[0]);
  });

  it('shows the cup to the bonus games only once they are earned', () => {
    expect($('.home__bonus')).toBeFalsy();

    view.destroy();
    PersistenceService.getInstance().saveReward('enthusiast');
    view = new HomeView();
    view.render();

    const cup = $('.home__bonus a.game-card--plain');
    expect(cup.getAttribute('href')).toBe('/bonus');
    expect(cup.textContent.trim()).toBe('Bonus');
    expect($('.home__bonus').nextElementSibling).toBe($('h1'));
    CUP_ICON.forEach((row) => expect(row.length).toBe(CUP_ICON[0].length));

    const paths = [];
    const stop = Navigation.onNavigate(({ path }) => paths.push(path));
    cup.click();
    stop();
    expect(paths).toEqual(['/bonus']);
  });
});
