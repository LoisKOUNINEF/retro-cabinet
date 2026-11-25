import { DotsAndBoxesBoardComponent } from '#root/dist/src/app/components/dots-and-boxes-board/dots-and-boxes-board.component.js';

const config = (overrides = {}) => ({
  size: 3,
  lines: Array(24).fill(null),
  boxes: Array(9).fill(null),
  lastLine: null,
  cursor: 17,
  locked: false,
  ...overrides,
});
const line = (index) => $(`.dots-boxes__line[data-index="${index}"]`);

describe('DotsAndBoxesBoardComponent', () => {
  let host;
  let board;
  let picks;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    picks = [];
    board = new DotsAndBoxesBoardComponent(host, config(), (index) => picks.push(index));
    board.render();
  });

  afterEach(() => board.destroy());

  it('lays out the dots, lines and boxes on a grid, naming lines by their dots', () => {
    expect($('.dots-boxes').classList.contains('dots-boxes--size-3')).toBeTruthy();
    expect($$('.dots-boxes__dot').length).toBe(16);
    expect($$('.dots-boxes__line').length).toBe(24);
    expect($$('.dots-boxes__box').length).toBe(9);
    expect(line(0).getAttribute('aria-label')).toBe('Line A1–A2: free');
    expect(line(12).getAttribute('aria-label')).toBe('Line A1–B1: free');
    expect($$('.dots-boxes__box')[0].getAttribute('aria-label')).toBe('Box A1: open');
    // Grid cell 17: row 2, column 3, line 4.
    expect(line(4).classList.contains('dots-boxes__line--cursor')).toBeTruthy();
  });

  it('draws the clicked line', () => {
    line(13).click();
    expect(picks).toEqual([13]);
  });

  it('only rebuilds the cells that changed', () => {
    const untouched = line(23);
    const lines = Array(24).fill(null);
    lines[0] = 'player';
    lines[13] = 'ai';
    const boxes = Array(9).fill(null);
    boxes[0] = 'ai';
    board.update(config({ lines, boxes, lastLine: 13 }));
    expect(line(23)).toBe(untouched);
    expect(line(0).disabled).toBe(true);
    expect(line(0).getAttribute('aria-label')).toBe('Line A1–A2: drawn by you');
    expect(line(13).classList.contains('dots-boxes__line--ai')).toBeTruthy();
    expect(line(13).classList.contains('dots-boxes__line--last')).toBeTruthy();
    const box = $$('.dots-boxes__box')[0];
    expect(box.getAttribute('aria-label')).toBe('Box A1: your opponent\'s');
    expect(box.querySelector('.dots-boxes__mark')).toBeTruthy();
  });

  it('takes no line while it is the turn of the AI', () => {
    board.update(config({ locked: true }));
    expect($$('.dots-boxes__line').every((button) => button.disabled)).toBeTruthy();
  });
});
