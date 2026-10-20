import { PlayControlsComponent } from '#root/dist/src/app/components/play-controls/play-controls.component.js';

const state = (overrides = {}) => ({ label: '▶ Start', status: 'Press Space to start', over: false, canStartOver: false, running: false, ...overrides });

describe('PlayControlsComponent', () => {
  let host;
  let controls;
  let handlers;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    handlers = { togglePlay: () => {}, newGame: () => {} };
  });

  afterEach(() => {
    controls.destroy();
    host.remove();
  });

  it('shows the label and status, and New game only when there is a game to drop', () => {
    controls = new PlayControlsComponent(host, state(), handlers);
    controls.render();

    expect($('.game__toggle').textContent).toBe('▶ Start');
    expect($('.game__status').textContent).toBe('Press Space to start');
    expect($('.game__new').hidden).toBeTruthy();
    expect($('.game__keys')).toBeFalsy();

    controls.update(state({ label: '▶ Resume', canStartOver: true }));
    expect($('.game__toggle').textContent).toBe('▶ Resume');
    expect($('.game__new').hidden).toBeFalsy();

    controls.update(state({ label: '↻ Play again', status: 'Game over', over: true }));
    expect($('.game__status').classList.contains('game__status--over')).toBeTruthy();
  });

  it('disables New game while playing', () => {
    controls = new PlayControlsComponent(host, state({ label: '⏸ Pause', canStartOver: true, running: true }), handlers);
    controls.render();
    expect($('.game__new').hidden).toBeFalsy();
    expect($('.game__new').disabled).toBeTruthy();

    controls.update(state({ label: '▶ Resume', canStartOver: true }));
    expect($('.game__new').disabled).toBeFalsy();
  });

  it('calls its handlers from the buttons', () => {
    const toggle = spyOn(handlers, 'togglePlay');
    const newGame = spyOn(handlers, 'newGame');
    controls = new PlayControlsComponent(host, state({ canStartOver: true }), handlers);
    controls.render();

    $('.game__toggle').click();
    $('.game__new').click();

    expect(toggle.callCount).toBe(1);
    expect(newGame.callCount).toBe(1);
  });

  // The game ticks many times a second: a button rebuilt under the pointer loses the click.
  it('leaves its DOM alone when nothing changed', () => {
    controls = new PlayControlsComponent(host, state({ label: '⏸ Pause' }), handlers);
    controls.render();
    const button = $('.game__toggle');
    const label = button.firstChild;

    controls.update(state({ label: '⏸ Pause' }));

    expect($('.game__toggle')).toBe(button);
    expect(button.firstChild).toBe(label);
  });

  it('keeps the focus on the button it rebuilds', () => {
    controls = new PlayControlsComponent(host, state({ canStartOver: true }), handlers);
    controls.render();
    $('.game__toggle').focus();

    controls.update(state({ label: '⏸ Pause', canStartOver: true }));
    expect(document.activeElement).toBe($('.game__toggle'));

    $('.game__new').focus();
    controls.update(state({ label: '▶ Start' }));
    expect(document.activeElement).toBe($('.game__toggle'));

    // Disabled while playing: back to the main button too.
    controls.update(state({ label: '▶ Resume', canStartOver: true }));
    $('.game__new').focus();
    controls.update(state({ label: '⏸ Pause', canStartOver: true, running: true }));
    expect(document.activeElement).toBe($('.game__toggle'));
  });

  it('describes the keys once the layout is known', async () => {
    controls = new PlayControlsComponent(host, state(), handlers, [{ action: 'move', codes: ['ArrowLeft', 'ArrowRight'] }]);
    controls.render();
    await flushPromises();

    expect($('.game__keys').textContent).toContain('move');

    controls.update(state({ label: '⏸ Pause' }));
    expect($('.game__keys').textContent).toContain('move');
  });
});
