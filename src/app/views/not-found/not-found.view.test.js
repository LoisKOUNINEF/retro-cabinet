import { NotFoundView } from '#root/dist/src/app/views/not-found/not-found.view.js';
import { Navigation } from '#root/dist/src/core/index.js';

describe('NotFoundView', () => {
  it('hides the way to the secret game behind the dopefish', () => {
    const paths = [];
    const stop = Navigation.onNavigate(({ path }) => paths.push(path));
    const view = new NotFoundView();
    view.render();

    expect(view.documentTitle()).toBe('Page not found');
    const dopefish = $('.not-found__dopefish');
    expect(dopefish.getAttribute('aria-label')).toBe('Dopefish lives!');
    expect(dopefish.querySelector('img').getAttribute('src')).toBe('/assets/images/dopefish.png');

    dopefish.click();
    expect(paths).toEqual(['/secret']);

    stop();
    view.destroy();
  });
});
