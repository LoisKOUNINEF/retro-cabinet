import { WariBoardComponent } from '#root/dist/src/app/components/wari-board/wari-board.component.js';
import { PILE_SPRITE, SEED_SPRITES } from '#root/dist/src/app/games/bonus/wari/seeds.js';

const config = (overrides = {}) => ({
  pits: Array(12).fill(4),
  stores: { player: 0, ai: 0 },
  legal: Array(6).fill(true),
  lastSown: null,
  capturing: [],
  cursor: 0,
  turn: 'player',
  ...overrides,
});
const pit = (index) => $(`.wari__pit-button[data-index="${index}"]`);
const lit = (svg) => svg.querySelectorAll('rect').length;

describe('WariBoardComponent', () => {
  let host;
  let board;
  let picks;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    picks = [];
    board = new WariBoardComponent(host, config(), (index) => picks.push(index));
    board.render();
  });

  afterEach(() => {
    board.destroy();
    host.remove();
  });

  it('draws one seed sprite per count, and a pile past twelve', () => {
    SEED_SPRITES.forEach((sprite, count) => {
      expect(sprite.join('').split('#').length - 1).toBe(count * 4);
      sprite.forEach((row) => expect(row.length).toBe(sprite[0].length));
    });
    PILE_SPRITE.forEach((row) => expect(row.length).toBe(PILE_SPRITE[0].length));
  });

  it('shows the player\'s six pits as buttons, numbered, and the opponent\'s row facing them', () => {
    expect($$('.wari__pit-button').length).toBe(6);
    expect($$('.wari__key').map((key) => key.textContent)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(pit(2).getAttribute('aria-label')).toBe('Pit 3: 4 seeds');
    expect(lit(pit(2).querySelector('.wari__seeds'))).toBe(16);
    expect(pit(0).classList.contains('wari__pit--cursor')).toBeTruthy();
    expect($$('.wari__row--ai .wari__pit').length).toBe(6);
    expect($('.wari__row--ai').getAttribute('aria-label')).toBe('Opponent\'s pits: 4, 4, 4, 4, 4, 4');
    expect($$('.wari__store-count').map((count) => count.textContent)).toEqual(['0', '0']);
    expect($('.wari__store--player').classList.contains('wari__store--playing')).toBeTruthy();
  });

  it('sows the clicked pit', () => {
    pit(4).click();
    expect(picks).toEqual([4]);
  });

  it('shows a move under way: pits locked, the last seed sown and the pits about to be taken', () => {
    const pits = [0, 5, 5, 5, 5, 1, 2, 3, 15, 4, 4, 4];
    board.update(config({ pits, legal: Array(6).fill(false), lastSown: 7, capturing: [7, 6] }));
    expect($$('.wari__pit-button').every((button) => button.disabled)).toBeTruthy();
    expect(pit(5).getAttribute('aria-label')).toBe('Pit 6: 1 seed');
    // The opponent's row from its left, on the player's right: pit 11 first.
    const opponent = $$('.wari__row--ai .wari__pit');
    expect(opponent.map((li) => li.querySelector('.wari__count').textContent)).toEqual(['4', '4', '4', '15', '3', '2']);
    expect(opponent[4].classList.contains('wari__pit--sown')).toBeTruthy();
    expect(opponent.filter((li) => li.classList.contains('wari__pit--capturing')).length).toBe(2);
    expect($('.wari__row--ai').getAttribute('aria-label')).toBe('Opponent\'s pits: 2, 3, 15, 4, 4, 4');
  });

  it('only rebuilds the pits that changed', () => {
    const untouched = pit(5);
    board.update(config({ pits: [0, 5, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4], stores: { player: 0, ai: 0 } }));
    expect(pit(5)).toBe(untouched);
    expect(pit(0).getAttribute('aria-label')).toBe('Pit 1: 0 seeds');
  });
});
