import { BEATS, HANDS, HAND_SPRITES, duel } from '#root/dist/src/app/games/bonus/rpsls/hands.js';
import { REVEAL_MS, RPSLS_OPTIONS, Rpsls, rpslsGame } from '#root/dist/src/app/games/bonus/rpsls/rpsls.js';
import { defaultSettings } from '#root/dist/src/app/games/game.js';

// random() that makes the AI play `hand`.
const playing = (hand) => () => (HANDS.indexOf(hand) + 0.5) / HANDS.length;
const match = (bestOf, ai) => new Rpsls({ bestOf, random: playing(ai) });
const play = (game, hand) => {
  game.select(HANDS.indexOf(hand));
  game.tick(REVEAL_MS);
};

describe('Rock Paper Scissors Lizard Spock', () => {
  it('has each hand beat exactly two others, and lose to the other two', () => {
    HANDS.forEach((hand) => {
      expect(Object.keys(BEATS[hand]).length).toBe(2);
      expect(HANDS.filter((other) => BEATS[other][hand]).length).toBe(2);
      HAND_SPRITES[hand].forEach((row) => expect(row.length).toBe(HAND_SPRITES[hand][0].length));
    });
  });

  it('settles all 25 pairings, with the classic lines', () => {
    let draws = 0;
    HANDS.forEach((a) => HANDS.forEach((b) => {
      const result = duel(a, b);
      if (a === b) {
        expect(result).toBe(null);
        draws++;
        return;
      }
      expect(result.winner === a ? Boolean(BEATS[a][b]) : Boolean(BEATS[b][a])).toBeTruthy();
      expect(duel(b, a)).toEqual(result);
    }));
    expect(draws).toBe(5);
    expect(duel('rock', 'spock').line).toBe('Spock vaporizes Rock');
    expect(duel('scissors', 'paper').line).toBe('Scissors cuts Paper');
    expect(duel('lizard', 'scissors').line).toBe('Scissors decapitates Lizard');
    expect(duel('paper', 'spock').line).toBe('Paper disproves Spock');
  });

  it('defaults to a single round', () => {
    expect(defaultSettings(RPSLS_OPTIONS)).toEqual({ match: 'single' });
  });

  it('lets the AI pick any hand, uniformly', () => {
    HANDS.forEach((hand) => {
      const game = match(null, hand);
      play(game, 'rock');
      expect(game.ai).toBe(hand);
    });
  });

  it('shakes before showing the AI\'s hand, ignoring hands shown meanwhile', () => {
    const game = match(null, 'spock');
    expect(game.status).toBe('Pick your hand.');
    expect(game.nextTickIn()).toBe(null);
    game.select(0);
    expect(game.phase).toBe('shaking');
    expect(game.ai).toBe(null);
    expect(game.nextTickIn()).toBe(REVEAL_MS);
    expect(game.status).toBe('Rock, paper, scissors, lizard, Spock…');
    game.select(1);
    expect(game.player).toBe('rock');

    game.tick(REVEAL_MS);
    expect(game.phase).toBe('shown');
    expect(game.ai).toBe('spock');
    expect(game.outcome).toBe('losses');
    expect(game.status).toBe('Spock vaporizes Rock. Your opponent wins. Press Enter or New round to play again.');
  });

  it('ends a single round on a win, a loss or a draw', () => {
    const won = match(null, 'rock');
    play(won, 'paper');
    expect(won.outcome).toBe('wins');
    expect(won.status).toContain('Paper covers Rock. You win!');

    const drawn = match(null, 'lizard');
    play(drawn, 'lizard');
    expect(drawn.outcome).toBe('draws');
    expect(drawn.isOver).toBe(true);
    expect(drawn.status).toContain('Both Lizard: a draw.');
    // Over: no more hands.
    drawn.select(0);
    expect(drawn.phase).toBe('shown');
  });

  it('plays a best of 3 to two round wins, replaying draws', () => {
    const game = match(3, 'rock');
    expect(game.status).toBe('Pick your hand. First to 2 wins.');
    play(game, 'rock');
    expect(game.isOver).toBe(false);
    expect(game.status).toBe('Both Rock: a draw. Again! Pick your next hand.');
    play(game, 'paper');
    expect(game.status).toBe('Paper covers Rock. Your round. Pick your next hand.');
    expect(game.stats()).toEqual([{ key: 'you', label: 'You', value: 1 }, { key: 'ai', label: 'Opponent', value: 0 }]);
    play(game, 'scissors');
    expect(game.aiWins).toBe(1);
    expect(game.status).toContain('Your opponent\'s round.');
    play(game, 'spock');
    expect(game.outcome).toBe('wins');
    expect(game.status).toContain('Spock vaporizes Rock. You win the match!');
  });

  it('plays a best of 5 to three', () => {
    const game = match(5, 'paper');
    [1, 2, 3].forEach(() => play(game, 'rock'));
    expect(game.outcome).toBe('losses');
    expect(game.status).toContain('Your opponent wins the match.');
  });

  it('shows hands with 1–5, or the arrows and Enter', () => {
    const game = match(3, 'rock');
    expect(game.handleKey('Digit5')).toBe(true);
    expect(game.player).toBe('spock');
    game.tick(REVEAL_MS);
    game.handleKey('ArrowLeft');
    expect(game.cursor).toBe(3);
    game.handleKey('ArrowRight');
    game.handleKey('ArrowRight');
    expect(game.cursor).toBe(4);
    game.handleKey('Enter');
    expect(game.phase).toBe('shaking');
    expect(game.handleKey('Digit6')).toBe(false);
    expect(game.handleKey('KeyA')).toBe(false);
  });

  it('is defined for the BonusGameView, tallied per match length', () => {
    expect(rpslsGame.id).toBe('rpsls');
    expect(rpslsGame.results.key({ match: '5' })).toBe('5');
    const game = rpslsGame.create({ match: '3' }, playing('rock'));
    expect(game.target).toBe(2);
    expect(rpslsGame.create({ match: 'single' }, playing('rock')).target).toBe(1);
    expect(rpslsGame.board.config(game, true)).toEqual({ player: null, ai: null, phase: 'pick', roundWinner: null, cursor: 0, locked: false });
    game.select(0);
    expect(rpslsGame.board.config(game, true).locked).toBe(true);
  });
});
