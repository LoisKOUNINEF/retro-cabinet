import { TouchControlsComponent } from '#root/dist/src/app/components/touch-controls/touch-controls.component.js';

const ALL = ['up', 'down', 'left', 'right'];

// jsdom lays nothing out: every element sits at (0, 0), so clientX/Y are offsets from the stick's centre.
const pointer = (target, type, { id = 1, x = 0, y = 0 } = {}) =>
  target.dispatchEvent(new window.PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, cancelable: true }));

describe('TouchControlsComponent', () => {
  let host;
  let controls;
  let calls;

  const mount = (layout) => {
    controls = new TouchControlsComponent(host, layout, {
      press: (code) => calls.push(`press ${code}`),
      release: (code) => calls.push(`release ${code}`),
      togglePlay: () => calls.push('togglePlay'),
    });
    controls.render();
  };

  beforeEach(() => {
    calls = [];
    host = document.createElement('div');
    document.body.append(host);
  });

  afterEach(() => {
    controls.destroy();
    host.remove();
    useRealTimers();
  });

  it('presses a direction as the stick enters it, and releases it on the way out', () => {
    mount({ directions: ALL });
    const stick = $('.touch-controls__stick');

    pointer(stick, 'pointerdown', { x: 40 });
    pointer(stick, 'pointermove', { x: 42, y: 3 });
    pointer(stick, 'pointermove', { x: -40 });
    pointer(stick, 'pointerup');

    expect(calls).toEqual(['press ArrowRight', 'release ArrowRight', 'press ArrowLeft', 'release ArrowLeft']);
  });

  it('follows only the finger that grabbed the stick', () => {
    mount({ directions: ALL });
    const stick = $('.touch-controls__stick');

    pointer(stick, 'pointerdown', { id: 1, x: 40 });
    pointer(stick, 'pointermove', { id: 2, x: -40 });
    pointer(stick, 'pointerup', { id: 2 });
    expect(calls).toEqual(['press ArrowRight']);

    pointer(stick, 'pointercancel', { id: 1 });
    expect(calls).toEqual(['press ArrowRight', 'release ArrowRight']);
  });

  it('moves the knob with the finger, inside the base', () => {
    mount({ directions: ALL });
    const stick = $('.touch-controls__stick');

    pointer(stick, 'pointerdown', { x: 100 });
    expect($('.touch-controls__knob').style.transform).toBe('translate(56px, 0px)');
    expect(stick.classList.contains('touch-controls__stick--active')).toBeTruthy();

    pointer(stick, 'pointerup');
    expect($('.touch-controls__knob').style.transform).toBe('');
  });

  it('repeats a held direction when the game asks for it', () => {
    useFakeTimers();
    mount({ directions: ['left', 'right', 'down'], repeatMs: 120 });
    const stick = $('.touch-controls__stick');

    pointer(stick, 'pointerdown', { x: -40 });
    advanceTimersByTime(360);
    expect(calls.filter((call) => call === 'press ArrowLeft').length).toBe(4);

    pointer(stick, 'pointerup');
    advanceTimersByTime(360);
    expect(calls.filter((call) => call === 'press ArrowLeft').length).toBe(4);
  });

  it('shows the action button only when the game has one, pressing and releasing its key', () => {
    mount({ directions: ALL });
    expect($('.touch-controls__action')).toBeFalsy();
    controls.destroy();
    // The component took the host's place: mount the next one into a new host.
    host = document.createElement('div');
    document.body.append(host);

    mount({ directions: ['left', 'right'], action: { label: 'Fire', code: 'ArrowUp' } });
    const action = $('.touch-controls__action');
    expect(action.textContent).toBe('Fire');

    pointer(action, 'pointerdown', { id: 5 });
    pointer(action, 'pointerup', { id: 5 });
    expect(calls).toEqual(['press ArrowUp', 'release ArrowUp']);
  });

  it('lets the stick and the action button work at the same time', () => {
    mount({ directions: ['left', 'right'], action: { label: 'Fire', code: 'ArrowUp' } });

    pointer($('.touch-controls__stick'), 'pointerdown', { id: 1, x: 40 });
    pointer($('.touch-controls__action'), 'pointerdown', { id: 2 });
    pointer($('.touch-controls__action'), 'pointerup', { id: 2 });

    expect(calls).toEqual(['press ArrowRight', 'press ArrowUp', 'release ArrowUp']);
  });

  it('toggles play with the ⏯ button', () => {
    mount({ directions: ALL });
    $('.touch-controls__pause').click();
    expect(calls).toEqual(['togglePlay']);
  });

  it('lets go of everything on reset', () => {
    mount({ directions: ['left', 'right'], action: { label: 'Fire', code: 'ArrowUp' } });
    pointer($('.touch-controls__stick'), 'pointerdown', { id: 1, x: 40 });
    pointer($('.touch-controls__action'), 'pointerdown', { id: 2 });

    controls.reset();

    expect(calls).toEqual(['press ArrowRight', 'press ArrowUp', 'release ArrowRight', 'release ArrowUp']);
    // The stick is free again for a new finger.
    pointer($('.touch-controls__stick'), 'pointerdown', { id: 3, x: -40 });
    expect(calls[calls.length - 1]).toBe('press ArrowLeft');
  });

  it('still presses when the browser refuses to capture the pointer', () => {
    const refuse = () => { throw new Error('NotFoundError'); };
    const original = window.HTMLElement.prototype.setPointerCapture;
    window.HTMLElement.prototype.setPointerCapture = refuse;
    mount({ directions: ['left', 'right'], action: { label: 'Fire', code: 'ArrowUp' } });

    pointer($('.touch-controls__stick'), 'pointerdown', { id: 1, x: 40 });
    pointer($('.touch-controls__action'), 'pointerdown', { id: 2 });

    expect(calls).toEqual(['press ArrowRight', 'press ArrowUp']);
    window.HTMLElement.prototype.setPointerCapture = original;
  });

  it('offers a D-pad instead of the stick when the game asks for a cross', () => {
    mount({ pad: 'cross', directions: ALL });

    expect($('.touch-controls__stick')).toBeFalsy();
    expect($$('.touch-controls__cross-button').map((b) => b.dataset.direction)).toEqual(ALL);
  });

  it('presses once per tap on the D-pad, however fast the taps come', () => {
    mount({ pad: 'cross', directions: ALL });
    const up = $('.touch-controls__cross-button--up');

    pointer(up, 'pointerdown', { id: 1 });
    pointer(up, 'pointerup', { id: 1 });
    pointer(up, 'pointerdown', { id: 2 });
    pointer(up, 'pointerup', { id: 2 });

    expect(calls).toEqual(['press ArrowUp', 'release ArrowUp', 'press ArrowUp', 'release ArrowUp']);
  });

  it('releases held D-pad buttons on reset', () => {
    mount({ pad: 'cross', directions: ALL });
    pointer($('.touch-controls__cross-button--left'), 'pointerdown', { id: 1 });

    controls.reset();

    expect(calls).toEqual(['press ArrowLeft', 'release ArrowLeft']);
  });

  it('does not release a D-pad key twice when the finger lifts after a reset', () => {
    mount({ pad: 'cross', directions: ALL });
    const left = $('.touch-controls__cross-button--left');
    pointer(left, 'pointerdown', { id: 1 });

    controls.reset();
    pointer(left, 'pointerup', { id: 1 });

    expect(calls).toEqual(['press ArrowLeft', 'release ArrowLeft']);
  });
});
