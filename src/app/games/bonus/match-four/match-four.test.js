import { MatchFourRound, matchFourGame } from '#root/dist/src/app/games/bonus/match-four/match-four.js';
import { AI_DELAY_MS } from '#root/dist/src/app/games/bonus/turns.js';
import { cellIndex } from '#root/dist/src/app/games/bonus/match-four/rules.js';

const round = (options = {}) => new MatchFourRound({ playerDisc: 'red', difficulty: 'easy', aiFirst: false, random: () => 0, ...options });

describe('Match four round', () => {
  it('waits for the player, then asks for a tick while the AI thinks', () => {
    const game = round();
    expect(game.nextTickIn()).toBe(null);
    expect(game.status).toBe('Your turn (Red).');

    game.select(3);
    expect(game.game.board[cellIndex(5, 3)]).toBe('red');
    expect(game.status).toBe('Thinking…');
    expect(game.nextTickIn()).toBe(AI_DELAY_MS);
    // Not the player's turn: ignored.
    game.select(4);
    expect(game.game.board[cellIndex(5, 4)]).toBe(null);

    game.tick(AI_DELAY_MS);
    // Easy with random() = 0: the first free column.
    expect(game.game.board[cellIndex(5, 0)]).toBe('yellow');
    expect(game.nextTickIn()).toBe(null);
  });

  it('lets the AI open when it plays first', () => {
    const game = round({ aiFirst: true, playerDisc: 'yellow', difficulty: 'medium' });
    expect(game.locked).toBe(true);
    game.tick(AI_DELAY_MS);
    expect(game.game.board[cellIndex(5, 3)]).toBe('red');
    expect(game.status).toBe('Your turn (Yellow).');
  });

  it('moves the cursor with the arrows, staying on the board; Enter drops, 1–7 drop in a column', () => {
    const game = round();
    expect(game.cursor).toBe(3);
    ['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft'].forEach((code) => expect(game.handleKey(code)).toBe(true));
    expect(game.cursor).toBe(0);
    expect(game.handleKey('Enter')).toBe(true);
    expect(game.game.board[cellIndex(5, 0)]).toBe('red');

    game.tick(AI_DELAY_MS);
    expect(game.handleKey('Digit7')).toBe(true);
    expect(game.cursor).toBe(6);
    expect(game.game.board[cellIndex(5, 6)]).toBe('red');
    expect(game.handleKey('Digit8')).toBe(false);
    expect(game.handleKey('KeyA')).toBe(false);
  });

  it('tells the outcome from the player side', () => {
    // Easy (random() = 0) piles up in column 0, so red wins along the bottom.
    const game = round();
    [3, 4, 5, 6].forEach((column) => {
      game.select(column);
      game.tick(AI_DELAY_MS);
    });
    expect(game.outcome).toBe('wins');
    expect(game.status).toContain('You win!');
    expect(game.locked).toBe(true);
  });

  it('is defined for the BonusGameView, tallying per difficulty', () => {
    expect(matchFourGame.id).toBe('match-four');
    expect(matchFourGame.results.key({ difficulty: 'hard' })).toBe('hard');
    const game = matchFourGame.create({ difficulty: 'hard', colour: 'yellow', first: 'ai' }, () => 0.99);
    expect(game.playerDisc).toBe('yellow');
    expect(matchFourGame.board.config(game)).toEqual({ board: Array(42).fill(null), winLine: null, lastCell: null, cursor: 3, locked: true });
  });
});
