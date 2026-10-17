import { MISTAKE_CHANCE, SECRET_OPTIONS, chooseMove } from '#root/dist/src/app/games/secret/ai.js';
import { freeCells, other, resultOf } from '#root/dist/src/app/games/secret/tictactoe.js';
import { defaultSettings } from '#root/dist/src/app/games/game.js';

const board = (rows) => [...rows.join('')].map((c) => (c === '.' ? null : c));
// Above MISTAKE_CHANCE: Hard never slips.
const noMistake = () => 0.5;

describe('Noughts and crosses AI', () => {
  it('defaults to Medium, playing X, moving first', () => {
    expect(defaultSettings(SECRET_OPTIONS)).toEqual({ difficulty: 'medium', mark: 'X', first: 'you' });
  });

  it('Easy plays any free cell', () => {
    const cells = board(['XO.', '.X.', 'O..']);
    [0, 0.3, 0.6, 0.99].forEach((r) => expect(freeCells(cells)).toContain(chooseMove(cells, 'O', 'easy', () => r)));
  });

  it('Medium wins first, else blocks, else takes the centre', () => {
    expect(chooseMove(board(['OO.', 'XX.', '...']), 'O', 'medium', () => 0)).toBe(2);
    expect(chooseMove(board(['XX.', 'O..', '...']), 'O', 'medium', () => 0)).toBe(2);
    expect(chooseMove(board(['X..', '...', '...']), 'O', 'medium', () => 0)).toBe(4);
    // Nothing to win, block or take in the centre: any free cell.
    expect(chooseMove(board(['...', '.X.', '...']), 'O', 'medium', () => 0)).toBe(0);
  });

  it('Hard wins, blocks, and answers a corner opening with the centre', () => {
    expect(chooseMove(board(['OO.', 'XX.', '...']), 'O', 'hard', noMistake)).toBe(2);
    expect(chooseMove(board(['XX.', 'O..', '...']), 'O', 'hard', noMistake)).toBe(2);
    expect(chooseMove(board(['X..', '...', '...']), 'O', 'hard', noMistake)).toBe(4);
  });

  it('Hard never loses, whatever the player does', () => {
    let rounds = 0;
    // Walks every possible game: the player tries every move, the AI answers.
    const explore = (cells, turn, ai) => {
      const result = resultOf(cells);
      if (result) {
        expect(result).not.toBe(other(ai));
        rounds += 1;
        return;
      }
      if (turn === ai) {
        const next = [...cells];
        next[chooseMove(cells, ai, 'hard', noMistake)] = ai;
        return explore(next, other(turn), ai);
      }
      freeCells(cells).forEach((cell) => {
        const next = [...cells];
        next[cell] = turn;
        explore(next, other(turn), ai);
      });
    };

    explore(Array(9).fill(null), 'X', 'O'); // player first
    explore(Array(9).fill(null), 'X', 'X'); // AI first
    expect(rounds).toBeGreaterThan(100);
  });

  it('Hard sometimes slips: a random move instead of the best one', () => {
    expect(MISTAKE_CHANCE).toBe(0.1);
    // X threatens the middle row: the best move blocks at 5.
    const threatened = board(['O..', 'XX.', '...']);
    expect(chooseMove(threatened, 'O', 'hard', noMistake)).toBe(5);
    // random() = 0 takes the mistake branch, then the first free cell: no block.
    expect(chooseMove(threatened, 'O', 'hard', () => 0)).toBe(1);
  });

  it('thinks fast enough on an empty board', () => {
    const start = Date.now();
    chooseMove(Array(9).fill(null), 'X', 'hard', noMistake);
    expect(Date.now() - start).toBeLessThan(500);
  });
});
