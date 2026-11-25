import { Minefield, SIZES, minefieldGame } from '#root/dist/src/app/games/bonus/minefield/minefield.js';

// 3×3, one mine. With random() = 0 and a first dig in the corner (cell 0), the mine is at 5:
//   . 1 1
//   . 1 * (a mine counts only its neighbours)
//   . 1 1
const small = () => new Minefield({ rows: 3, columns: 3, mines: 1, random: () => 0 });
const states = (game) => game.cells.map((cell) => cell.state);
const views = (game) => minefieldGame.board.config(game, true).cells.map(({ view }) => view);

describe('Minefield', () => {
  it('keeps the first dig and its neighbours clear, so it always opens an area', () => {
    for (let i = 0; i < 20; i++) {
      const game = new Minefield({ ...SIZES.easy, random: Math.random });
      game.select(40);
      expect(game.cells.filter((cell) => cell.mine).length).toBe(10);
      [40, ...game.neighbours(40)].forEach((index) => expect(game.cells[index].mine).toBe(false));
      expect(game.cells.filter((cell) => cell.state === 'open').length).toBeGreaterThan(8);
      expect(game.isOver).toBe(false);
    }
  });

  it('counts the mines around each cell, and opens the empty area around a 0', () => {
    const game = small();
    game.select(0);
    expect(game.cells[5].mine).toBe(true);
    expect(game.cells.map((cell) => cell.count)).toEqual([0, 1, 1, 0, 1, 0, 0, 1, 1]);
    expect(states(game)).toEqual(['open', 'open', 'hidden', 'open', 'open', 'hidden', 'open', 'open', 'hidden']);
    expect(game.status).toBe('Careful…');
  });

  it('cycles a cell from flag to question mark to hidden, and never digs a flag', () => {
    const game = small();
    game.select(0);
    game.select(8, 'flag');
    expect(game.cells[8].state).toBe('flag');
    expect(game.stats()[0]).toEqual({ key: 'mines', label: 'Mines left', value: 0 });
    game.select(8);
    expect(game.cells[8].state).toBe('flag');
    game.select(8, 'flag');
    expect(game.cells[8].state).toBe('question');
    game.select(8, 'flag');
    expect(game.cells[8].state).toBe('hidden');
    game.select(0, 'flag');
    expect(game.cells[0].state).toBe('open');
  });

  it('opens around a number once its flags are placed, and is won when every safe cell is open', () => {
    const game = small();
    game.select(0);
    game.select(4);
    expect(states(game)[2]).toBe('hidden');
    game.select(5, 'flag');
    game.select(4);
    expect(game.outcome).toBe('wins');
    expect(game.cells[5].state).toBe('flag');
    expect(game.status).toContain('Cleared in');
  });

  it('is lost on a mine, showing the mines and the wrong flags', () => {
    const game = small();
    game.select(0);
    game.select(2, 'flag');
    // 1 has its one flag (a wrong one): opening around it digs the mine.
    game.select(1);
    expect(game.outcome).toBe('losses');
    expect(game.exploded).toBe(5);
    expect(game.status).toContain('Boom!');
    expect(views(game)[5]).toBe('exploded');
    expect(views(game)[2]).toBe('wrong');
    game.select(8);
    expect(game.cells[8].state).toBe('hidden');
  });

  it('runs its clock from the first dig to the end, ticking on whole seconds', () => {
    const game = small();
    expect(game.nextTickIn()).toBe(null);
    game.tick(500);
    expect(game.elapsed).toBe(0);
    game.select(0);
    expect(game.nextTickIn()).toBe(1000);
    game.tick(1400);
    expect(game.nextTickIn()).toBe(600);
    expect(game.stats()[1]).toEqual({ key: 'time', label: 'Time', value: 1 });
    game.select(5, 'flag');
    game.select(4);
    expect(game.nextTickIn()).toBe(null);
    game.tick(1000);
    expect(game.elapsed).toBe(1400);
    expect(minefieldGame.results.best.score(game)).toBe(2);
  });

  it('plays from the keyboard: arrows, Enter to dig, F to flag', () => {
    const game = small();
    expect(game.cursor).toBe(4);
    game.handleKey('ArrowUp');
    game.handleKey('ArrowLeft');
    game.handleKey('ArrowLeft');
    expect(game.cursor).toBe(0);
    game.handleKey('Enter');
    expect(game.cells[0].state).toBe('open');
    game.handleKey('ArrowDown');
    game.handleKey('ArrowRight');
    game.handleKey('ArrowRight');
    game.handleKey('KeyF');
    expect(game.cells[5].state).toBe('flag');
    expect(game.handleKey('KeyQ')).toBe(false);
  });

  it('keeps a tally per size, without draws', () => {
    const { results } = minefieldGame;
    expect(results.key({})).toBe('easy');
    expect(results.key({ size: 'hard' })).toBe('hard');
    expect(results.draws).toBe(false);
  });
});
