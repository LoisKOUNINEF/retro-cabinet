import { NavalBattleBoardComponent, WHEEL_PAUSE_MS } from '#root/dist/src/app/components/naval-battle-board/naval-battle-board.component.js';

const carrier = { id: 'carrier', cells: [0, 1, 2, 3, 4] };
const config = (overrides = {}) => ({
  phase: 'placing',
  ownShips: [carrier],
  ownShots: [],
  enemyShips: [],
  enemyShots: Array(100).fill(null),
  preview: { cells: [44, 45, 46, 47], fits: true },
  lastShot: null,
  cursor: 44,
  locked: false,
  ...overrides,
});
const own = (index) => $$('.naval__sea--own .naval__cell')[index];
const enemy = (index) => $$('.naval__sea--enemy .naval__cell')[index];
const action = (name) => $(`.naval__action[data-action="${name}"]`);

describe('NavalBattleBoardComponent', () => {
  let host;
  let board;
  let picks;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    picks = [];
    board = new NavalBattleBoardComponent(host, config(), (index, act) => picks.push([index, act]));
    board.render();
  });

  afterEach(() => board.destroy());

  it('shows the fleet being placed, with the next ship under the cursor', () => {
    expect($('.naval__sea--enemy')).toBeFalsy();
    expect($$('.naval__sea--own .naval__cell').length).toBe(100);
    expect(own(0).classList.contains('naval__cell--h-start')).toBeTruthy();
    expect(own(4).classList.contains('naval__cell--h-end')).toBeTruthy();
    expect(own(0).getAttribute('aria-label')).toBe('A1: your Carrier');
    expect(own(45).classList.contains('naval__cell--preview-fits')).toBeTruthy();
    expect(own(44).classList.contains('naval__cell--cursor')).toBeTruthy();
    expect($('.naval__ship--next').textContent).toContain('Battleship');
    expect(action('start').disabled).toBe(true);
  });

  it('places on a click, aims on hovering, and sends the panel buttons', () => {
    own(20).click();
    own(30).querySelector('.naval__hover').dispatchEvent(new MouseEvent('pointerenter'));
    action('rotate').click();
    action('random').click();
    action('clear').click();
    expect(picks).toEqual([[20, 'place'], [30, 'aim'], [0, 'rotate'], [0, 'random'], [0, 'clear']]);
  });

  it('turns the next ship with the mouse wheel over the grid, once per gesture', () => {
    useFakeTimers();
    const grid = $('.naval__sea--own .naval__grid');
    const wheel = () => {
      const event = new WheelEvent('wheel', { deltaY: 40, cancelable: true });
      grid.dispatchEvent(event);
      return event;
    };
    expect(wheel().defaultPrevented).toBe(true);
    wheel();
    expect(picks).toEqual([[0, 'rotate']]);
    advanceTimersByTime(WHEEL_PAUSE_MS);
    wheel();
    expect(picks).toEqual([[0, 'rotate'], [0, 'rotate']]);
    useRealTimers();
  });

  it('leaves the wheel alone in battle', () => {
    board.update(config({ phase: 'battle', preview: null }));
    const event = new WheelEvent('wheel', { deltaY: 40, cancelable: true });
    $('.naval__sea--own .naval__grid').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(picks).toEqual([]);
  });

  it('marks a blocked spot for the next ship', () => {
    board.update(config({ preview: { cells: [3, 4, 5, 6], fits: false }, cursor: 3 }));
    expect(own(5).classList.contains('naval__cell--preview-blocked')).toBeTruthy();
  });

  it('fires at the enemy waters in battle, and only there', () => {
    board.update(config({ phase: 'battle', preview: null, ownShots: Array(100).fill(null) }));
    expect($$('.naval__sea--enemy .naval__cell').length).toBe(100);
    expect(enemy(12).getAttribute('aria-label')).toBe('B3: not fired at');
    expect(own(50).disabled).toBe(true);
    expect($('.naval__actions')).toBeFalsy();
    enemy(12).click();
    expect(picks).toEqual([[12, 'fire']]);
  });

  it('shows hits, misses and sunk ships, only rebuilding the cells that changed', () => {
    const battle = { phase: 'battle', preview: null, ownShots: Array(100).fill(null) };
    board.update(config(battle));
    const untouched = enemy(99);
    const enemyShots = Array(100).fill(null);
    enemyShots[10] = 'hit';
    enemyShots[11] = 'hit';
    enemyShots[12] = 'miss';
    const ownShots = Array(100).fill(null);
    ownShots[0] = 'hit';
    board.update(config({ ...battle, ownShots, enemyShots, enemyShips: [{ id: 'destroyer', cells: [10, 11] }], lastShot: { side: 'ai', cell: 0 } }));
    expect(enemy(99)).toBe(untouched);
    expect(enemy(10).getAttribute('aria-label')).toBe('B1: their Destroyer, sunk');
    expect(enemy(10).classList.contains('naval__cell--sunk')).toBeTruthy();
    expect(enemy(10).disabled).toBe(true);
    expect(enemy(12).getAttribute('aria-label')).toBe('B3: miss');
    expect(own(0).getAttribute('aria-label')).toBe('A1: your Carrier, hit');
    expect(own(0).classList.contains('naval__cell--last')).toBeTruthy();
    expect($('.naval__sea--enemy .naval__ship--sunk').textContent).toContain('Destroyer');
  });

  it('takes no shot while the AI is playing', () => {
    board.update(config({ phase: 'battle', preview: null, locked: true }));
    expect($$('.naval__sea--enemy .naval__cell').every((button) => button.disabled)).toBeTruthy();
  });
});
