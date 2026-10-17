import { HomeView } from '#root/dist/src/app/views/home/home.view.js';
import { Navigation } from '#root/dist/src/core/index.js';
import { GAME_CARDS } from '#root/dist/src/app/views/home/game-cards.js';

describe('HomeView', () => {
  let view;

  beforeEach(() => {
    view = new HomeView();
    view.render();
  });

  afterEach(() => view.destroy());

  it('shows one card per game, in a list', () => {
    const cards = $$('.home__games > li a.game-card');
    expect(cards.length).toBe(9);
    expect(cards.map((card) => card.getAttribute('href'))).toEqual([
      '/games/tetris', '/games/pacman', '/games/invaders', '/games/snake', '/games/arkanoid', '/games/asteroids',
      '/games/columns', '/games/frogger', '/games/pong',
    ]);
  });

  it('keeps the secret game off the list', () => {
    expect(GAME_CARDS.some((card) => card.path.includes('secret'))).toBeFalsy();
    expect($('a[href="/secret"]')).toBeFalsy();
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
});
