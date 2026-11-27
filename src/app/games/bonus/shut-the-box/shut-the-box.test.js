import { DIE_FACES, canComplete, combinations, matchChance, rollDie } from '#root/dist/src/app/games/bonus/shut-the-box/dice.js';
import { ROLL_MS, SHUT_THE_BOX_OPTIONS, ShutTheBox, TURN_PAUSE_MS, aiChoice, shutTheBoxGame } from '#root/dist/src/app/games/bonus/shut-the-box/shut-the-box.js';
import { defaultSettings } from '#root/dist/src/app/games/game.js';

// random() rolling the given dice values, one per call, then 1s.
const rolling = (...values) => () => ((values.shift() ?? 1) - 0.5) / 6;
const game = (values = [], options = {}) => new ShutTheBox({ tiles: 9, vs: false, oneDie: false, random: rolling(...values), ...options });
// Leaves only the given tiles open on that side.
const leaveOpen = (round, side, open) => round.shut[side].forEach((_, i) => (round.shut[side][i] = !open.includes(i + 1)));
const roll = (round, dice = 2) => {
  round.select(dice, 'roll');
  round.tick(ROLL_MS);
};
// Ticks through whatever the game waits for (the dice, the AI's turn).
const runTicks = (round) => {
  for (let guard = 0; round.nextTickIn() !== null && guard < 100; guard++) round.tick(round.nextTickIn());
};

describe('Shut the Box', () => {
  it('rolls dice from 1 to 6, drawn with their pips', () => {
    expect(rollDie(() => 0)).toBe(1);
    expect(rollDie(() => 0.999)).toBe(6);
    expect(DIE_FACES.length).toBe(6);
    DIE_FACES.forEach((face, i) => {
      expect(face.length).toBe(9);
      face.forEach((row) => expect(row.length).toBe(9));
      // Dark pixels: the four rounded corners and the pips.
      expect(face.join('').split('.').length - 1 - 4).toBe(i + 1);
    });
  });

  it('finds the sets of open tiles adding up to a total', () => {
    const tiles = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(combinations(tiles, 7)).toEqual([[1, 2, 4], [1, 6], [2, 5], [3, 4], [7]]);
    expect(combinations([5, 9], 2)).toEqual([]);
    expect(canComplete(tiles, [4], 3, 7)).toBe(true);
    expect(canComplete(tiles, [4], 1, 7)).toBe(true);
    expect(canComplete(tiles, [4], 5, 7)).toBe(false);
    expect(canComplete([1, 3, 4], [4], 1, 7)).toBe(false);
    expect(matchChance([1], 1)).toBe(1 / 6);
    expect(matchChance(tiles, 2)).toBe(1);
  });

  it('has the AI shut the highest tile it can, with the fewest tiles', () => {
    expect(aiChoice([1, 2, 3, 4, 5, 6, 7, 8, 9], 7)).toEqual([7]);
    expect(aiChoice([1, 2, 3, 4, 5, 6], 7)).toEqual([1, 6]);
    expect(aiChoice([1, 2, 3, 4], 7)).toEqual([3, 4]);
    expect(aiChoice([5, 9], 2)).toBe(null);
  });

  it('defaults to nine tiles, solo, two dice', () => {
    expect(defaultSettings(SHUT_THE_BOX_OPTIONS)).toEqual({ tiles: '9', players: 'solo', oneDie: 'off' });
  });

  it('rolls, then shuts the picked tiles once they add up to the roll', () => {
    const round = game([3, 4]);
    expect(round.status).toBe('Roll the dice.');
    expect(round.nextTickIn()).toBe(null);
    round.select(2, 'roll');
    expect(round.phase).toBe('rolling');
    expect(round.dice).toEqual([0, 0]);
    expect(round.status).toBe('Rolling…');
    expect(round.nextTickIn()).toBe(ROLL_MS);
    round.tick(ROLL_MS);
    expect(round.dice).toEqual([3, 4]);
    expect(round.phase).toBe('pick');
    expect(round.nextTickIn()).toBe(null);
    expect(round.status).toBe('Shut tiles adding up to 7.');
    expect(round.canToggle(8)).toBe(false);

    round.select(3);
    expect(round.selected).toEqual([4]);
    expect(round.status).toBe('Shut tiles adding up to 7: 4 so far.');
    expect(round.canToggle(5)).toBe(false);
    // Unpicked, then picked again.
    round.select(3);
    expect(round.selected).toEqual([]);
    round.select(3);
    round.select(2);
    expect(round.open('player')).toEqual([1, 2, 5, 6, 7, 8, 9]);
    expect(round.phase).toBe('roll');
    expect(round.status).toBe('Roll again.');
    expect(round.stats()).toEqual([{ key: 'score', label: 'Score', value: 38 }, { key: 'shut', label: 'Tiles shut', value: '2/9' }]);
  });

  it('ends a solo round when nothing adds up to the roll: the open tiles are the score', () => {
    const round = game([1, 1]);
    leaveOpen(round, 'player', [9]);
    roll(round);
    expect(round.outcome).toBe('losses');
    expect(round.playerScore).toBe(9);
    expect(round.status).toBe('Nothing adds up to 2: you score 9. Press Enter or New round to play again.');
    round.select(0, 'roll');
    expect(round.phase).toBe('over');
  });

  it('wins at once on shutting the box', () => {
    const round = game([3, 4], { vs: true });
    leaveOpen(round, 'player', [7]);
    roll(round);
    round.select(6);
    expect(round.outcome).toBe('wins');
    expect(round.playerScore).toBe(0);
    expect(round.status).toBe('You shut the box! Press Enter or New round to play again.');
  });

  it('allows a single die once the tiles from 7 up are shut, with the option on', () => {
    const off = game();
    leaveOpen(off, 'player', [1, 2, 3]);
    off.select(1, 'roll');
    expect(off.phase).toBe('roll');

    const on = game([2], { oneDie: true });
    expect(on.canRollOne()).toBe(false);
    on.select(1, 'roll');
    expect(on.phase).toBe('roll');
    leaveOpen(on, 'player', [1, 2, 6]);
    expect(on.status).toBe('Roll the dice, or a single die.');
    roll(on, 1);
    expect(on.dice).toEqual([2]);
    expect(on.status).toBe('Shut tiles adding up to 2.');
  });

  it('plays the AI\'s turn on its own box after the player\'s, the lower score winning', () => {
    // The player rolls 1+1 on a 9 left; the AI shuts its 5 with 2+3, then rolls 1+1 on its 4.
    const round = game([1, 1, 2, 3, 1, 1], { vs: true });
    leaveOpen(round, 'player', [9]);
    leaveOpen(round, 'ai', [4, 5]);
    roll(round);
    expect(round.isOver).toBe(false);
    expect(round.turn).toBe('ai');
    expect(round.nextTickIn()).toBe(TURN_PAUSE_MS);
    expect(round.status).toBe('You score 9. Your opponent\'s turn…');
    // The player can't play meanwhile.
    round.select(2, 'roll');
    expect(round.dice).toEqual([1, 1]);
    runTicks(round);
    expect(round.open('ai')).toEqual([4]);
    expect(round.outcome).toBe('losses');
    expect(round.status).toBe('You score 9, your opponent 4. Your opponent wins. Press Enter or New round to play again.');
  });

  it('settles a vs round: a win, a draw, or the AI shutting its box', () => {
    const won = game([1, 1, 1, 1], { vs: true });
    leaveOpen(won, 'player', [3]);
    leaveOpen(won, 'ai', [9]);
    roll(won);
    runTicks(won);
    expect(won.outcome).toBe('wins');
    expect(won.status).toContain('You score 3, your opponent 9. You win!');
    expect(won.stats()).toEqual([{ key: 'you', label: 'You', value: 3 }, { key: 'ai', label: 'Opponent', value: 9 }]);

    const drawn = game([1, 1, 1, 1], { vs: true });
    leaveOpen(drawn, 'player', [9]);
    leaveOpen(drawn, 'ai', [4, 5]);
    roll(drawn);
    runTicks(drawn);
    expect(drawn.outcome).toBe('draws');
    expect(drawn.status).toContain('A draw.');

    const lost = game([1, 1, 3, 4], { vs: true });
    leaveOpen(lost, 'player', [9]);
    leaveOpen(lost, 'ai', [7]);
    roll(lost);
    runTicks(lost);
    expect(lost.outcome).toBe('losses');
    expect(lost.status).toContain('Your opponent shut the box.');
  });

  it('has the AI roll a single die when it may and that\'s likelier to give a total it can shut', () => {
    const round = game([1, 1, 2], { vs: true, oneDie: true });
    leaveOpen(round, 'player', [9]);
    leaveOpen(round, 'ai', [1, 2, 3]);
    roll(round);
    round.tick(TURN_PAUSE_MS);
    expect(round.dice).toEqual([0]);
  });

  it('plays with the keys: R and Enter roll, digits and the cursor pick tiles', () => {
    const round = game([5, 5, 6, 4], { tiles: 10 });
    expect(round.handleKey('KeyR')).toBe(true);
    round.tick(ROLL_MS);
    expect(round.handleKey('Digit0')).toBe(true);
    expect(round.open('player')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);

    round.handleKey('Enter');
    round.tick(ROLL_MS);
    expect(round.total).toBe(10);
    // The cursor stayed on tile 10, now shut: it moves to 9, then Enter picks it.
    round.handleKey('ArrowLeft');
    expect(round.cursor).toBe(8);
    round.handleKey('Enter');
    expect(round.selected).toEqual([9]);
    round.handleKey('Numpad1');
    expect(round.open('player')).toEqual([2, 3, 4, 5, 6, 7, 8]);
    // The cursor followed tile 1, and stops at either end.
    expect(round.cursor).toBe(0);
    round.handleKey('ArrowLeft');
    expect(round.cursor).toBe(0);
    Array.from({ length: 12 }, () => round.handleKey('ArrowRight'));
    expect(round.cursor).toBe(9);
    expect(round.handleKey('KeyA')).toBe(false);
  });

  it('is defined for the BonusGameView, tallied per tiles, players and dice rule', () => {
    expect(shutTheBoxGame.id).toBe('shut-the-box');
    const { results } = shutTheBoxGame;
    expect(results.key({ tiles: '12', players: 'ai', oneDie: 'on' })).toBe('12-ai-on');
    expect(results.draws({ players: 'solo' })).toBe(false);
    expect(results.draws({ players: 'ai' })).toBe(true);
    expect(results.best.everyRound).toBe(true);

    const round = shutTheBoxGame.create({ tiles: '10', players: 'ai', oneDie: 'on' }, rolling(3, 4));
    expect(round.tiles).toBe(10);
    expect(round.vs).toBe(true);
    const config = shutTheBoxGame.board.config(round, true);
    expect(config.tiles.length).toBe(10);
    expect(config.tiles[0]).toEqual({ state: 'open', disabled: true });
    expect(config.opponent.length).toBe(10);
    expect(config.canRoll).toBe(true);
    expect(config.canRollOne).toBe(false);
    expect(config.total).toBe(null);

    roll(round);
    round.select(3);
    const picking = shutTheBoxGame.board.config(round, true);
    expect(picking.tiles[3]).toEqual({ state: 'selected', disabled: false });
    expect(picking.tiles[4]).toEqual({ state: 'open', disabled: true });
    expect(picking.total).toBe(7);
    expect(picking.selectedSum).toBe(4);
    expect(picking.canRoll).toBe(false);
    expect(results.best.score(round)).toBe(55);
    expect(shutTheBoxGame.board.config(shutTheBoxGame.create({}, rolling()), true).canRollOne).toBe(null);
  });
});
