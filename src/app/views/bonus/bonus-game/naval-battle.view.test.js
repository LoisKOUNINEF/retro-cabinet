import { BonusGameView } from '#root/dist/src/app/views/bonus/bonus-game/bonus-game.view.js';
import { navalBattleGame } from '#root/dist/src/app/games/bonus/naval-battle/naval-battle.js';
import { AI_DELAY_MS } from '#root/dist/src/app/games/bonus/turns.js';
import { PersistenceService } from '#root/dist/src/app/services/persistence/persistence.service.js';

const status = () => $('.game__status').textContent;
const action = (name) => $(`.naval__action[data-action="${name}"]`);
const enemy = (index) => $$('.naval__sea--enemy .naval__cell')[index];

describe('BonusGameView (Naval Battle)', () => {
  let view;

  const open = () => {
    view = new BonusGameView(navalBattleGame, Math.random);
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

  it('lays a random fleet, starts, and lets the AI answer a shot', () => {
    open();
    expect(view.documentTitle()).toBe('Naval Battle');
    action('random').click();
    expect(status()).toBe('Fleet ready: press Start (or Enter).');
    action('start').click();
    expect(status()).toBe('Your shot.');
    enemy(0).click();
    expect(status()).toContain('Thinking…');
    advanceTimersByTime(AI_DELAY_MS);
    expect(status()).toContain('Your shot.');
    expect($$('.naval__sea--own .naval__cell--hit, .naval__sea--own .naval__cell--miss').length).toBe(1);
  });

  it('tallies a won round, with its shots', () => {
    PersistenceService.getInstance().saveSettings('naval-battle', { turns: 'again' });
    open();
    action('random').click();
    action('start').click();
    view._game.enemy.ships.forEach(({ cells }) => cells.forEach((cell) => enemy(cell).click()));
    expect(status()).toContain('You sank their fleet in 17 shots!');
    expect(PersistenceService.getInstance().tally('naval-battle', 'medium-again')).toEqual({ wins: 1, draws: 0, losses: 0 });
    expect(PersistenceService.getInstance().best('naval-battle', 'medium-again')).toBe(17);
  });
});
