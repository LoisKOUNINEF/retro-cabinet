import { MatchFourBoardComponent } from '#root/dist/src/app/components/match-four-board/match-four-board.component.js';
import { cellIndex } from '#root/dist/src/app/games/bonus/match-four/rules.js';

const empty = () => Array(42).fill(null);
const config = (overrides = {}) => ({ board: empty(), winLine: null, lastCell: null, cursor: 3, locked: false, ...overrides });
const column = (index) => $(`.m4-board__column[data-index="${index}"]`);

describe('MatchFourBoardComponent', () => {
  let host;
  let board;
  let drops;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    drops = [];
    board = new MatchFourBoardComponent(host, config(), (index) => drops.push(index));
    board.render();
  });

  afterEach(() => board.destroy());

  it('shows 7 column buttons of 6 cells, the cursor on the middle one', () => {
    expect($$('.m4-board__column').length).toBe(7);
    expect($$('.m4-board__cell').length).toBe(42);
    expect(column(3).classList.contains('m4-board__column--cursor')).toBeTruthy();
    expect(column(0).getAttribute('aria-label')).toBe('Column 1: empty');
  });

  it('drops in the clicked column', () => {
    column(5).click();
    expect(drops).toEqual([5]);
  });

  it('draws the discs, the dropped one falling and the winning line glowing', () => {
    const discs = empty();
    discs[cellIndex(5, 2)] = 'red';
    discs[cellIndex(4, 2)] = 'yellow';
    board.update(config({ board: discs, lastCell: cellIndex(4, 2), winLine: [cellIndex(5, 2)] }));

    const cells = [...column(2).querySelectorAll('.m4-board__cell')];
    expect(cells[5].classList.contains('m4-board__cell--red')).toBeTruthy();
    expect(cells[5].classList.contains('m4-board__cell--win')).toBeTruthy();
    expect(cells[4].classList.contains('m4-board__cell--yellow')).toBeTruthy();
    expect(cells[4].classList.contains('m4-board__cell--dropped-4')).toBeTruthy();
    expect(column(2).getAttribute('aria-label')).toBe('Column 3: red, yellow, 4 free');
  });

  it('only rebuilds the columns that changed', () => {
    const untouched = column(0);
    const changed = column(4);
    const discs = empty();
    discs[cellIndex(5, 4)] = 'red';
    board.update(config({ board: discs, lastCell: cellIndex(5, 4) }));
    expect(column(0)).toBe(untouched);
    expect(column(4)).not.toBe(changed);
  });

  it('disables full columns, and every column while locked', () => {
    const discs = empty();
    for (let row = 0; row < 6; row++) discs[cellIndex(row, 1)] = row % 2 ? 'red' : 'yellow';
    board.update(config({ board: discs }));
    expect(column(1).disabled).toBe(true);
    expect(column(1).getAttribute('aria-label')).toContain('full');
    expect(column(2).disabled).toBe(false);

    board.update(config({ board: discs, locked: true }));
    expect($$('.m4-board__column').every((button) => button.disabled)).toBeTruthy();
  });
});
