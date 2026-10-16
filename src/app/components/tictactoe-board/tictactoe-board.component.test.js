import { TicTacToeBoardComponent } from '#root/dist/src/app/components/tictactoe-board/tictactoe-board.component.js';

const config = (overrides = {}) => ({
  board: ['X', null, null, null, 'O', null, null, null, null],
  winLine: null,
  cursor: 4,
  locked: false,
  ...overrides,
});

describe('TicTacToeBoardComponent', () => {
  let host;
  let boardComponent;
  let played;

  const mount = (overrides) => {
    boardComponent = new TicTacToeBoardComponent(host, config(overrides), (index) => played.push(index));
    boardComponent.render();
  };
  const cell = (index) => $(`.ttt-board__cell[data-index="${index}"]`);

  beforeEach(() => {
    played = [];
    host = document.createElement('div');
    document.body.append(host);
  });

  afterEach(() => boardComponent.destroy());

  it('renders 9 labelled cells with their marks', () => {
    mount();

    expect($$('.ttt-board__cell').length).toBe(9);
    expect(cell(0).textContent).toBe('X');
    expect(cell(0).getAttribute('aria-label')).toBe('Row 1, column 1: X');
    expect(cell(5).getAttribute('aria-label')).toBe('Row 2, column 3: empty');
  });

  it('plays a clicked free cell', () => {
    mount();
    cell(2).click();
    expect(played).toEqual([2]);
  });

  it('disables taken cells, and every cell while locked', () => {
    mount();
    expect(cell(0).disabled).toBeTruthy();
    expect(cell(1).disabled).toBeFalsy();
    boardComponent.destroy();

    host = document.createElement('div');
    document.body.append(host);
    mount({ locked: true });
    expect($$('.ttt-board__cell').every((button) => button.disabled)).toBeTruthy();
  });

  it('marks the cursor and the winning line', () => {
    mount();
    expect(cell(4).classList.contains('ttt-board__cell--cursor')).toBeTruthy();

    boardComponent.update(config({ board: ['X', 'X', 'X', null, 'O', 'O', null, null, null], winLine: [0, 1, 2], cursor: 8 }));
    expect([0, 1, 2].every((i) => cell(i).classList.contains('ttt-board__cell--win'))).toBeTruthy();
    expect(cell(8).classList.contains('ttt-board__cell--cursor')).toBeTruthy();
  });
});
