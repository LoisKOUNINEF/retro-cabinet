import { GameCardComponent, iconPixels } from '#root/dist/src/app/components/game-card/game-card.component.js';
import { Navigation } from '#root/dist/src/core/index.js';

const card = { title: 'Tetris', path: '/games/tetris', icon: ['###', '.#.'] };

describe('GameCardComponent', () => {
  let host;
  let component;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    component = new GameCardComponent(host, card);
    component.render();
  });

  afterEach(() => component.destroy());

  it('turns pixel art into lit-pixel coordinates', () => {
    expect(iconPixels(['#.', '.#'])).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  });

  it('draws the icon as one square per lit pixel, sized to the art', () => {
    const svg = $('.game-card__icon');
    expect(svg.getAttribute('viewBox')).toBe('0 0 3 2');
    expect(svg.querySelectorAll('rect').length).toBe(4);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it('links to the game by its title', () => {
    const link = $('.game-card');
    expect(link.getAttribute('href')).toBe('/games/tetris');
    expect($('.game-card__title').textContent).toBe('Tetris');
  });

  it('navigates in the app on click', () => {
    const paths = [];
    const stop = Navigation.onNavigate(({ path }) => paths.push(path));

    $('.game-card').click();

    expect(paths).toEqual(['/games/tetris']);
    stop();
  });

  it('renders an action card as a button that calls its callback', () => {
    let selected = 0;
    const host2 = document.createElement('div');
    document.body.append(host2);
    const button = new GameCardComponent(host2, { title: 'Random', icon: ['#'], onSelect: () => { selected += 1; } });
    button.render();

    const card = $('button.game-card');
    expect(card.getAttribute('href')).toBe(null);
    expect(card.querySelector('.game-card__title').textContent).toBe('Random');
    expect(card.querySelectorAll('rect').length).toBe(1);

    card.click();
    expect(selected).toBe(1);
    button.destroy();
  });
});
