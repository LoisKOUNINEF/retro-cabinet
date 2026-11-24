import { AlienSmashBoardComponent } from '#root/dist/src/app/components/alien-smash-board/alien-smash-board.component.js';

const empty = () => Array.from({ length: 9 }, () => ({ target: null, state: 'up', points: 0 }));
const config = (overrides = {}) => ({ holes: empty(), cursor: 4, active: true, ...overrides });
const hole = (index) => $(`.alien-smash-board__hole[data-index="${index}"]`);

describe('AlienSmashBoardComponent', () => {
  let host;
  let board;
  let smashes;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    smashes = [];
    board = new AlienSmashBoardComponent(host, config(), (index) => smashes.push(index));
    board.render();
  });

  afterEach(() => board.destroy());

  it('shows 9 empty holes numbered as a numpad, the cursor in the middle', () => {
    expect($$('.alien-smash-board__hole').length).toBe(9);
    expect($$('.alien-smash-board__key').map((key) => key.textContent)).toEqual(['7', '8', '9', '4', '5', '6', '1', '2', '3']);
    expect(hole(0).getAttribute('aria-label')).toBe('Hole 7: empty');
    expect(hole(4).classList.contains('alien-smash-board__hole--cursor')).toBeTruthy();
  });

  it('smashes on the press, so an alien leaving before the release still counts', () => {
    hole(2).querySelector('.alien-smash-board__key').dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
    expect(smashes).toEqual([2]);
  });

  it('leaves the pointer\'s own click alone, but smashes on a keyboard click', () => {
    hole(3).dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 1 }));
    expect(smashes).toEqual([]);
    // Enter or Space on a focused button, or an assistive technology: detail 0.
    hole(3).click();
    expect(smashes).toEqual([3]);
  });

  it('ignores presses on disabled holes and with other mouse buttons', () => {
    const right = new window.Event('pointerdown', { bubbles: true });
    Object.defineProperty(right, 'button', { value: 2 });
    hole(1).dispatchEvent(right);
    board.update(config({ active: false }));
    hole(1).dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
    expect(smashes).toEqual([]);
  });

  it('keeps one press listener across renders', () => {
    board.update(config({ cursor: 0 }));
    board.update(config({ cursor: 1 }));
    hole(5).dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
    expect(smashes).toEqual([5]);
  });

  it('shows an alien with its two frames, and its explosion and points once hit', () => {
    const holes = empty();
    holes[0] = { target: 'squid', state: 'up', points: 30 };
    holes[4] = { target: 'crab', state: 'leaving', points: 20 };
    holes[8] = { target: 'ufo', state: 'hit', points: 150 };
    board.update(config({ holes }));

    expect(hole(0).querySelectorAll('.alien-smash-board__frame').length).toBe(2);
    expect(hole(0).querySelector('.alien-smash-board__target--squid')).toBeTruthy();
    expect(hole(0).getAttribute('aria-label')).toBe('Hole 7: squid, 30 points');
    expect(hole(8).querySelector('.alien-smash-board__explosion')).toBeTruthy();
    expect(hole(8).querySelector('.alien-smash-board__points').textContent).toBe('+150');
    expect(hole(8).getAttribute('aria-label')).toBe('Hole 3: hit, 150 points');
    expect(hole(4).querySelector('.alien-smash-board__target--leaving')).toBeTruthy();
    expect(hole(4).getAttribute('aria-label')).toBe('Hole 5: crab going back down');
  });

  it('only rebuilds the holes that changed', () => {
    const untouched = hole(1);
    const holes = empty();
    holes[0] = { target: 'crab', state: 'up', points: 20 };
    board.update(config({ holes }));
    expect(hole(1)).toBe(untouched);
  });

  it('disables the holes while the clock is stopped', () => {
    board.update(config({ active: false }));
    expect($$('.alien-smash-board__hole').every((button) => button.disabled)).toBeTruthy();
  });
});
