import { PlayControlsComponent } from '#root/dist/src/app/components/play-controls/play-controls.component.js';

// The lines of the Controls and Rules popovers (in <body>).
const lines = () => $$('[id^="game-controls-"] li').map((li) => li.textContent);
const ruleLines = () => $$('[id^="game-rules-"] li').map((li) => li.textContent);
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
    expect($('.game__controls')).toBeFalsy();
    expect($('.game__rules')).toBeFalsy();

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

  it('lists the keys once the layout is known, one per line', async () => {
    controls = new PlayControlsComponent(host, state(), handlers, { keyHints: [{ action: 'Move', codes: ['ArrowLeft', 'ArrowRight'] }, { action: 'Fire', codes: ['ArrowUp'] }], mouseHint: 'Mouse: click to fire' });
    controls.render();
    expect($('.game__controls')).toBeFalsy();
    await flushPromises();

    expect($('.game__controls')).toBeTruthy();
    expect(lines()).toEqual(['Move: ← →', 'Fire: ↑', 'Mouse: click to fire']);

    controls.update(state({ label: '⏸ Pause' }));
    expect(lines()).toEqual(['Move: ← →', 'Fire: ↑', 'Mouse: click to fire']);
  });

  it('shows the mouse hint alone for a game without key hints, but not on touch devices', () => {
    controls = new PlayControlsComponent(host, state(), handlers, { mouseHint: 'Mouse: click to turn' });
    controls.render();
    expect(lines()).toEqual(['Mouse: click to turn']);
    controls.destroy();

    document.documentElement.classList.add('touch');
    controls = new PlayControlsComponent(host, state(), handlers, { mouseHint: 'Mouse: click to turn' });
    controls.render();
    expect($('.game__controls')).toBeFalsy();
    document.documentElement.classList.remove('touch');
  });

  it('opens and closes the controls from its button, anchored to it', () => {
    controls = new PlayControlsComponent(host, state(), handlers, { mouseHint: 'Mouse: click to turn' });
    controls.render();
    const button = $('.game__controls');
    const popover = document.getElementById(button.getAttribute('aria-controls'));
    expect(popover.anchorElement).toBe(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');

    // jsdom rejects the library's open/close events (an Event from another realm) and logs it.
    silenceConsole('error', () => {
      button.click();
      expect(popover.open).toBeTruthy();
      // A re-render keeps it open, and anchors it to the new button.
      controls.update(state({ label: '▶ Resume', canStartOver: true }));
      expect($('.game__controls').getAttribute('aria-expanded')).toBe('true');
      expect(popover.anchorElement).toBe($('.game__controls'));

      $('.game__controls').click();
      expect(popover.open).toBeFalsy();
      expect($('.game__controls').getAttribute('aria-expanded')).toBe('false');
    });
  });

  it('removes its popovers from <body> when destroyed', () => {
    controls = new PlayControlsComponent(host, state(), handlers, { rules: ['Goal: win.'], mouseHint: 'Mouse: click to turn' });
    controls.render();
    const ids = [$('.game__rules'), $('.game__controls')].map((button) => button.getAttribute('aria-controls'));
    expect(ids.every((id) => document.getElementById(id))).toBeTruthy();

    controls.destroy();
    expect(ids.some((id) => document.getElementById(id))).toBeFalsy();
  });

  it('lists what a click does after the keys, on touch devices too', async () => {
    controls = new PlayControlsComponent(host, state(), handlers, { keyHints: [{ action: 'Aim', codes: ['ArrowLeft', 'ArrowRight'] }], clickHints: ['Or click a column.'] });
    controls.render();
    await flushPromises();
    expect(lines()).toEqual(['Aim: ← →', 'Or click a column.']);
    controls.destroy();

    document.documentElement.classList.add('touch');
    controls = new PlayControlsComponent(host, state(), handlers, { clickHints: ['Or tap a column.'] });
    controls.render();
    expect(lines()).toEqual(['Or tap a column.']);
    document.documentElement.classList.remove('touch');
  });

  it('lists the rules beside the controls', () => {
    controls = new PlayControlsComponent(host, state(), handlers, { rules: ['Goal: win.', 'Then win again.'] });
    controls.render();
    expect(ruleLines()).toEqual(['Goal: win.', 'Then win again.']);
    // No controls to list: the Rules button alone.
    expect($('.game__controls')).toBeFalsy();
    expect($('.game__rules').getAttribute('aria-controls')).toContain('game-rules-');
  });

  it('opens one popover at a time', () => {
    controls = new PlayControlsComponent(host, state(), handlers, { rules: ['Goal: win.'], mouseHint: 'Mouse: click to turn' });
    controls.render();
    const rules = document.getElementById($('.game__rules').getAttribute('aria-controls'));
    const keys = document.getElementById($('.game__controls').getAttribute('aria-controls'));
    // jsdom rejects the library's open/close events (an Event from another realm) and logs it.
    silenceConsole('error', () => {
      $('.game__rules').click();
      expect(rules.open).toBeTruthy();
      expect($('.game__rules').getAttribute('aria-expanded')).toBe('true');

      $('.game__controls').click();
      expect(keys.open).toBeTruthy();
      expect(rules.open).toBeFalsy();
      expect($('.game__rules').getAttribute('aria-expanded')).toBe('false');

      $('.game__rules').click();
      expect(rules.open).toBeTruthy();
      expect(keys.open).toBeFalsy();
      $('.game__rules').click();
      expect(rules.open).toBeFalsy();
    });
  });

  it('keeps the focus on a rebuilt Rules button', () => {
    controls = new PlayControlsComponent(host, state(), handlers, { rules: ['Goal: win.'] });
    controls.render();
    $('.game__rules').focus();
    controls.update(state({ label: '▶ Resume', canStartOver: true }));
    expect(document.activeElement).toBe($('.game__rules'));
  });
});
