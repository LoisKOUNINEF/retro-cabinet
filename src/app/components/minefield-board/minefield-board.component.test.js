import { MinefieldBoardComponent } from '#root/dist/src/app/components/minefield-board/minefield-board.component.js';
import { LONG_PRESS_MS } from '#root/dist/src/app/components/minefield-board/minefield-cell/minefield-cell.component.js';

const config = (overrides = {}) => ({
  rows: 3,
  columns: 3,
  cells: Array.from({ length: 9 }, () => ({ view: 'hidden', count: 0 })),
  cursor: 4,
  locked: false,
  ...overrides,
});
const cell = (index) => $(`.minefield__cell[data-index="${index}"]`);
const mode = (name) => $(`.minefield__mode[data-mode="${name}"]`);

describe('MinefieldBoardComponent', () => {
  let host;
  let board;
  let picks;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    picks = [];
    board = new MinefieldBoardComponent(host, config(), (index, action) => picks.push([index, action]));
    board.render();
  });

  afterEach(() => board.destroy());

  it('names each cell by its row and column', () => {
    expect($$('.minefield__cell').length).toBe(9);
    expect(cell(5).getAttribute('aria-label')).toBe('B3: hidden');
    expect(cell(4).classList.contains('minefield__cell--cursor')).toBeTruthy();
    expect(mode('dig').getAttribute('aria-pressed')).toBe('true');
  });

  it('digs on a click, or flags with the toggle on Flag', () => {
    cell(1).click();
    mode('flag').click();
    expect(mode('flag').getAttribute('aria-pressed')).toBe('true');
    cell(2).click();
    expect(picks).toEqual([[1, 'dig'], [2, 'flag']]);
  });

  it('flags on a right-click', () => {
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    cell(3).dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(picks).toEqual([[3, 'flag']]);
  });

  it('flags on a long press, and the click ending it does nothing more', () => {
    useFakeTimers();
    cell(6).dispatchEvent(new MouseEvent('pointerdown'));
    advanceTimersByTime(LONG_PRESS_MS);
    cell(6).dispatchEvent(new MouseEvent('pointerup'));
    cell(6).click();
    expect(picks).toEqual([[6, 'flag']]);

    cell(7).dispatchEvent(new MouseEvent('pointerdown'));
    advanceTimersByTime(LONG_PRESS_MS / 2);
    cell(7).dispatchEvent(new MouseEvent('pointerup'));
    cell(7).click();
    expect(picks).toEqual([[6, 'flag'], [7, 'dig']]);
    useRealTimers();
  });

  it('shows numbers, flags and mines, only rebuilding the cells that changed', () => {
    const untouched = cell(8);
    const cells = config().cells.map((c) => ({ ...c }));
    cells[0] = { view: 'open', count: 0 };
    cells[1] = { view: 'open', count: 2 };
    cells[2] = { view: 'flag', count: 0 };
    board.update(config({ cells }));
    expect(cell(8)).toBe(untouched);
    expect(cell(0).getAttribute('aria-label')).toBe('A1: empty');
    expect(cell(1).textContent).toBe('2');
    expect(cell(1).classList.contains('minefield__cell--count-2')).toBeTruthy();
    expect(cell(1).getAttribute('aria-label')).toBe('A2: 2 mines around');
    expect(cell(2).getAttribute('aria-label')).toBe('A3: flagged');
    expect(cell(2).querySelector('svg')).toBeTruthy();
  });

  it('keeps the Flag toggle when the game updates the board', () => {
    mode('flag').click();
    board.update(config({ cursor: 0 }));
    expect(mode('flag').getAttribute('aria-pressed')).toBe('true');
    cell(0).click();
    expect(picks).toEqual([[0, 'flag']]);
  });
});
