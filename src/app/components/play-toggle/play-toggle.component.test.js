import { PlayToggleComponent } from '#root/dist/src/app/components/play-toggle/play-toggle.component.js';

describe('PlayToggleComponent', () => {
  let host;
  let toggle;
  let toggles;

  beforeEach(() => {
    toggles = 0;
    host = document.createElement('div');
    document.body.append(host);
    toggle = new PlayToggleComponent(host, { running: false }, () => { toggles += 1; });
    toggle.render();
  });

  afterEach(() => {
    toggle.destroy();
    host.remove();
  });

  it('offers to play while stopped, and to pause while running', () => {
    expect($('.play-toggle').textContent).toBe('▶');
    expect($('.play-toggle').getAttribute('aria-label')).toBe('Play');

    toggle.update({ running: true });
    expect($('.play-toggle').textContent).toBe('⏸');
    expect($('.play-toggle').getAttribute('aria-label')).toBe('Pause');
  });

  it('toggles on click, keeping the focus across a state change', () => {
    $('.play-toggle').focus();
    $('.play-toggle').click();
    toggle.update({ running: true });

    expect(toggles).toBe(1);
    expect(document.activeElement).toBe($('.play-toggle'));
  });

  it('leaves its button alone when the state is unchanged', () => {
    const button = $('.play-toggle');
    toggle.update({ running: false });
    expect($('.play-toggle')).toBe(button);
  });
});
