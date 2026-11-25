import { BonusGameView } from '#root/dist/src/app/views/bonus/bonus-game/bonus-game.view.js';
import { MISMATCH_MS, MatchingPairs, matchingPairsGame } from '#root/dist/src/app/games/bonus/matching-pairs/matching-pairs.js';
import { PersistenceService } from '#root/dist/src/app/services/persistence/persistence.service.js';

const random = () => 0.3;
// The same deck the view deals with the same random function.
const deck = (cards = 16) => new MatchingPairs({ cards, tries: null, random }).cards;
const card = (index) => $(`.matching-pairs-board__card[data-index="${index}"]`);
const status = () => $('.game__status').textContent;
const stat = (key) => $(`.game__stat-value[data-stat="${key}"]`)?.textContent;
const press = (code) => document.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true }));
const pairs = (cards) => {
  const byFace = {};
  cards.forEach(({ face }, index) => (byFace[face] ??= []).push(index));
  return Object.values(byFace);
};

describe('BonusGameView (Matching Pairs)', () => {
  let view;

  const open = () => {
    view = new BonusGameView(matchingPairsGame, random);
    view.render();
    view.onEnter();
  };

  beforeEach(() => {
    localStorage.clear();
    // The bonus games already earned: no Explorer toast.
    PersistenceService.getInstance().saveReward('explorer');
    useFakeTimers();
  });

  afterEach(() => {
    view.onExit();
    view.destroy();
    useRealTimers();
  });

  it('deals 16 cards, with the Stats section and a tally without draws', () => {
    open();
    expect(view.documentTitle()).toBe('Matching Pairs');
    expect($$('.matching-pairs-board__card').length).toBe(16);
    expect(status()).toBe('Find the pairs.');
    expect(stat('pairs')).toBe('0/8');
    expect(stat('misses')).toBe('0');
    expect(stat('tries')).toBeUndefined();
    expect(stat('draws')).toBeUndefined();
    expect(stat('best')).toBe('—');
  });

  it('turns a mismatched pair back after a while', () => {
    open();
    const cards = deck();
    const [a] = pairs(cards)[0];
    const [b] = pairs(cards)[1];
    card(a).click();
    card(b).click();
    expect(status()).toBe('No match.');
    expect(stat('misses')).toBe('1');

    advanceTimersByTime(MISMATCH_MS);
    expect(card(a).classList.contains('matching-pairs-board__card--hidden')).toBeTruthy();
    expect(status()).toBe('Find the pairs.');
  });

  it('records a win with its misses as the best, and Enter deals again', () => {
    PersistenceService.getInstance().saveSettings('matching-pairs', { cards: '12', tries: '10' });
    open();
    expect(stat('tries')).toBe('10');
    const [first, second] = pairs(deck(12));
    // One miss first.
    card(first[0]).click();
    card(second[0]).click();
    advanceTimersByTime(MISMATCH_MS);
    pairs(deck(12)).forEach((pair) => pair.forEach((index) => card(index).click()));

    expect(status()).toContain('with 1 miss!');
    expect(stat('wins')).toBe('1');
    expect(stat('best')).toBe('1');
    expect(PersistenceService.getInstance().best('matching-pairs', '12-10')).toBe(1);

    press('Enter');
    expect($$('.matching-pairs-board__card--hidden').length).toBe(12);
    expect(stat('pairs')).toBe('0/6');
  });

  it('records a loss when the tries run out', () => {
    PersistenceService.getInstance().saveSettings('matching-pairs', { cards: '12', tries: '5' });
    open();
    const groups = pairs(deck(12));
    for (let miss = 0; miss < 5; miss++) {
      card(groups[0][0]).click();
      card(groups[1 + (miss % 5)][0]).click();
      advanceTimersByTime(MISMATCH_MS);
    }
    expect(status()).toContain('Out of tries.');
    expect(stat('losses')).toBe('1');
    expect(stat('best')).toBe('—');
    expect($$('.matching-pairs-board__card').every((button) => button.disabled)).toBeTruthy();
  });

  it('turns cards with the keyboard', () => {
    open();
    press('ArrowRight');
    press('Enter');
    expect(card(1).classList.contains('matching-pairs-board__card--shown')).toBeTruthy();
  });
});
