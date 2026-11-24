import { CodeBreakerBoardComponent } from '#root/dist/src/app/components/code-breaker-board/code-breaker-board.component.js';

const config = (overrides = {}) => ({
  pegs: 4,
  tries: 8,
  rules: '4 pegs, 6 colours, repeats allowed',
  guesses: [],
  current: [null, null, null, null],
  cursor: 0,
  palette: [0, 1, 2, 3, 4, 5].map((peg) => ({ peg, disabled: false })),
  code: null,
  full: false,
  locked: false,
  ...overrides,
});
const hole = (index) => $$('.code-breaker__button--slot')[index];
const colour = (index) => $$('.code-breaker__button--colour')[index];

describe('CodeBreakerBoardComponent', () => {
  let host;
  let board;
  let picks;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    picks = [];
    board = new CodeBreakerBoardComponent(host, config(), (index, action) => picks.push([index, action]));
    board.render();
  });

  afterEach(() => board.destroy());

  it('hides the code, and shows the row being played, the rows left and the colours', () => {
    expect($('.code-breaker__row--code').getAttribute('aria-label')).toBe('The code: hidden');
    expect($$('.code-breaker__button--slot').length).toBe(4);
    expect(hole(0).getAttribute('aria-label')).toBe('Hole 1: not filled, selected');
    expect(hole(0).classList.contains('code-breaker__button--cursor')).toBeTruthy();
    expect($$('.code-breaker__row--future').length).toBe(7);
    expect($$('.code-breaker__button--colour').length).toBe(6);
    expect(colour(1).getAttribute('aria-label')).toBe('Orange, key 2');
    expect($('.code-breaker__check').disabled).toBe(true);
  });

  it('tells which colour, hole or Check was picked', () => {
    colour(2).click();
    hole(3).click();
    board.update(config({ full: true }));
    $('.code-breaker__check').click();
    expect(picks).toEqual([[2, 'colour'], [3, 'slot'], [0, 'check']]);
  });

  it('only rebuilds the holes and colours that changed', () => {
    const untouchedHole = hole(3);
    const untouchedColour = colour(5);
    board.update(config({ current: [2, null, null, null], cursor: 1, palette: [0, 1, 2, 3, 4, 5].map((peg) => ({ peg, disabled: peg === 2 })) }));
    expect(hole(3)).toBe(untouchedHole);
    expect(colour(5)).toBe(untouchedColour);
    expect(hole(0).getAttribute('aria-label')).toBe('Hole 1: Yellow');
    expect(hole(0).querySelector('.code-breaker__peg--yellow')).toBeTruthy();
    expect(colour(2).disabled).toBe(true);
  });

  it('reads each guess with its feedback, and keeps the ones already played', () => {
    const first = { pegs: [0, 1, 1, 2], exact: 1, misplaced: 2 };
    board.update(config({ guesses: [first] }));
    const row = $('.code-breaker__rows li .code-breaker__row');
    expect(row.getAttribute('aria-label')).toBe('Guess 1: Red, Orange, Orange, Yellow: 1 in place, 2 misplaced');
    expect(row.querySelectorAll('.code-breaker__key-peg--exact').length).toBe(1);
    expect(row.querySelectorAll('.code-breaker__key-peg--misplaced').length).toBe(2);

    board.update(config({ guesses: [first, { pegs: [3, 3, 3, 3], exact: 0, misplaced: 0 }] }));
    expect($('.code-breaker__rows li .code-breaker__row')).toBe(row);
    expect($$('.code-breaker__row--future').length).toBe(5);
  });

  it('shows the code once the round is over, with nothing left to play', () => {
    board.update(config({ code: [5, 4, 3, 2], locked: true, guesses: [{ pegs: [5, 4, 3, 2], exact: 4, misplaced: 0 }] }));
    expect($('.code-breaker__row--code').getAttribute('aria-label')).toBe('The code: Blue, Cyan, Green, Yellow');
    expect($('.code-breaker__row--current')).toBeFalsy();
    expect($$('.code-breaker__row--future').length).toBe(0);
    expect($$('.code-breaker__button--colour').every((button) => button.disabled)).toBeTruthy();
  });
});
