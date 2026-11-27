import { gameCard } from '#root/dist/src/app/components/game-card/game-card.js';
import { iconPixels } from '#root/dist/src/app/components/pixel-art.js';
import { Navigation, View, html } from '#root/dist/src/core/index.js';

const card = { title: 'Falling Blocks', path: '/games/falling-blocks', icon: ['###', '.#.'] };

// A view listing one card, with the two handlers gameCard's markup calls.
class CardView extends View {
  constructor(shown) {
    super({ viewName: 'card-test', template: html`<div>${gameCard(shown)}</div>` });
    this.randoms = 0;
  }

  _open(path) {
    Navigation.navigateTo(path);
  }

  _random() {
    this.randoms += 1;
  }
}

describe('gameCard', () => {
  let view;

  const show = (shown) => {
    view?.destroy();
    view = new CardView(shown);
    view.render();
  };

  beforeEach(() => show(card));
  afterEach(() => view.destroy());

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
    const link = $('a.game-card');
    expect(link.getAttribute('href')).toBe('/games/falling-blocks');
    expect($('.game-card__title').textContent).toBe('Falling Blocks');
  });

  it("navigates in the app on click, through the view's _open", () => {
    const paths = [];
    const stop = Navigation.onNavigate(({ path }) => paths.push(path));

    $('.game-card').click();

    expect(paths).toEqual(['/games/falling-blocks']);
    stop();
  });

  it("renders a card without a path as a button calling the view's _random", () => {
    show({ title: 'Random', icon: ['#'] });

    const button = $('button.game-card');
    expect(button.getAttribute('href')).toBe(null);
    expect(button.querySelector('.game-card__title').textContent).toBe('Random');
    expect(button.querySelectorAll('rect').length).toBe(1);

    button.click();
    expect(view.randoms).toBe(1);
  });

  it('is framed unless plain', () => {
    expect($('.game-card').classList.contains('game-card--plain')).toBe(false);

    show({ ...card, plain: true });

    expect($('.game-card').classList.contains('game-card--plain')).toBe(true);
    expect($('.game-card__title').textContent).toBe('Falling Blocks');
  });
});
