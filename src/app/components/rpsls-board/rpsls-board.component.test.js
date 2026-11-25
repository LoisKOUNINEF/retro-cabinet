import { RpslsBoardComponent } from '#root/dist/src/app/components/rpsls-board/rpsls-board.component.js';

const config = (overrides = {}) => ({ player: null, ai: null, phase: 'pick', roundWinner: null, cursor: 0, locked: false, ...overrides });
const choice = (index) => $(`.rpsls-board__choice[data-index="${index}"]`);
const sides = () => $$('.rpsls-board__side');

describe('RpslsBoardComponent', () => {
  let host;
  let board;
  let picks;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    picks = [];
    board = new RpslsBoardComponent(host, config(), (index) => picks.push(index));
    board.render();
  });

  afterEach(() => board.destroy());

  it('offers the five hands, numbered, and lists the ten rules', () => {
    expect($$('.rpsls-board__choice-name').map((name) => name.textContent)).toEqual(['Rock', 'Paper', 'Scissors', 'Lizard', 'Spock']);
    expect($$('.rpsls-board__key').map((key) => key.textContent)).toEqual(['1', '2', '3', '4', '5']);
    expect($$('.rpsls-board__rules li').length).toBe(10);
    expect(choice(0).classList.contains('rpsls-board__choice--cursor')).toBeTruthy();
    expect(sides().map((side) => side.querySelector('.rpsls-board__hand-name').textContent)).toEqual(['?', '?']);
  });

  it('shows the clicked hand', () => {
    choice(3).click();
    expect(picks).toEqual([3]);
  });

  it('shakes the AI\'s side until its hand is shown, with the hands locked', () => {
    board.update(config({ player: 'lizard', phase: 'shaking', locked: true }));
    expect(sides()[0].querySelector('.rpsls-board__hand-name').textContent).toBe('Lizard');
    expect(sides()[1].classList.contains('rpsls-board__side--shaking')).toBeTruthy();
    expect($$('.rpsls-board__choice').every((button) => button.disabled)).toBeTruthy();
  });

  it('marks the round\'s winner and loser, or a draw', () => {
    board.update(config({ player: 'rock', ai: 'spock', phase: 'shown', roundWinner: 'ai' }));
    expect(sides()[0].classList.contains('rpsls-board__side--lose')).toBeTruthy();
    expect(sides()[1].classList.contains('rpsls-board__side--win')).toBeTruthy();
    expect(sides()[1].querySelector('.rpsls-board__hand-name').textContent).toBe('Spock');

    board.update(config({ player: 'rock', ai: 'rock', phase: 'shown', roundWinner: null }));
    expect(sides().every((side) => side.classList.contains('rpsls-board__side--draw'))).toBeTruthy();
  });
});
