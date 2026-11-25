import { MatchingPairsBoardComponent } from '#root/dist/src/app/components/matching-pairs-board/matching-pairs-board.component.js';
import { FACES } from '#root/dist/src/app/games/bonus/matching-pairs/faces.js';

const cards = (states) => states.map((state, index) => ({ face: Math.floor(index / 2), state }));
const config = (overrides = {}) => ({ cards: cards(Array(12).fill('hidden')), columns: 4, cursor: 0, locked: false, ...overrides });
const card = (index) => $(`.matching-pairs-board__card[data-index="${index}"]`);

describe('MatchingPairsBoardComponent', () => {
  let host;
  let board;
  let picks;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    picks = [];
    board = new MatchingPairsBoardComponent(host, config(), (index) => picks.push(index));
    board.render();
  });

  afterEach(() => board.destroy());

  it('lays the cards out in rows of the given length, face down', () => {
    expect($('.matching-pairs-board').classList.contains('matching-pairs-board--cols-4')).toBeTruthy();
    expect($('.matching-pairs-board').classList.contains('matching-pairs-board--rows-3')).toBeTruthy();
    expect($$('.matching-pairs-board__card').length).toBe(12);
    expect($$('.matching-pairs-board__back').length).toBe(12);
    expect(card(2).getAttribute('aria-label')).toBe('Card 3: hidden');
    expect(card(0).classList.contains('matching-pairs-board__card--cursor')).toBeTruthy();
  });

  it('turns the clicked card', () => {
    card(5).click();
    expect(picks).toEqual([5]);
  });

  it('shows turned and found faces by name, and only rebuilds the cards that changed', () => {
    // Clears the deal's turning flags, so unchanged cards are kept from now on.
    board.update(config({ cursor: 1 }));
    const untouched = card(11);
    const states = Array(12).fill('hidden');
    states[0] = 'found';
    states[1] = 'found';
    states[2] = 'shown';
    board.update(config({ cards: cards(states) }));

    expect(card(11)).toBe(untouched);
    expect(card(0).classList.contains('matching-pairs-board__card--found')).toBeTruthy();
    expect(card(0).getAttribute('aria-label')).toBe(`Card 1: ${FACES[0].name}, found`);
    expect(card(2).getAttribute('aria-label')).toBe(`Card 3: ${FACES[1].name}`);
    expect(card(2).querySelector('.matching-pairs-board__face')).toBeTruthy();
    expect(card(2).disabled).toBe(true);
    expect(card(3).disabled).toBe(false);
  });

  it('plays the turn animation on the deal, then only on the cards that just turned', () => {
    const turning = () => $$('.matching-pairs-board__card--turning').map((button) => Number(button.dataset.index));
    expect(turning().length).toBe(12);

    const states = Array(12).fill('hidden');
    states[3] = 'shown';
    board.update(config({ cards: cards(states), cursor: 3 }));
    expect(turning()).toEqual([3]);

    // Moving the cursor rebuilds the two cards involved, without playing it again.
    board.update(config({ cards: cards(states), cursor: 5 }));
    expect(turning()).toEqual([]);
    expect(card(5).classList.contains('matching-pairs-board__card--cursor')).toBeTruthy();
  });

  it('keeps unchanged cards without the turn animation across updates', () => {
    board.update(config({ cursor: 1 }));
    const untouched = card(11);
    const states = Array(12).fill('hidden');
    states[2] = 'shown';
    board.update(config({ cards: cards(states), cursor: 2 }));
    states[4] = 'shown';
    board.update(config({ cards: cards(states), cursor: 4 }));

    expect(card(11)).toBe(untouched);
    expect(untouched.classList.contains('matching-pairs-board__card--turning')).toBeFalsy();
    expect(card(2).classList.contains('matching-pairs-board__card--turning')).toBeFalsy();
    expect(card(4).classList.contains('matching-pairs-board__card--turning')).toBeTruthy();
  });

  it('disables every card once the round is over, marking the missed ones', () => {
    board.update(config({ cards: cards(Array(12).fill('revealed')), locked: true }));
    expect($$('.matching-pairs-board__card').every((button) => button.disabled)).toBeTruthy();
    expect(card(4).getAttribute('aria-label')).toContain(', missed');
  });
});
