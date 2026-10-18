import { PersistenceService } from '#root/dist/src/app/services/persistence/persistence.service.js';
import { SAVE_VERSION, levelOption, onOff } from '#root/dist/src/app/games/game.js';

const OPTIONS = [levelOption, onOff('time', 'Time limit')];
const entry = (score, level = 1) => ({ score, level, date: '2026-10-16T10:00:00.000Z' });
const save = (version = SAVE_VERSION) => ({ version, settings: { level: '2' }, state: { score: 40 }, savedAt: '2026-10-16T10:00:00.000Z' });

describe('PersistenceService', () => {
  let storage;

  beforeEach(() => {
    localStorage.clear();
    storage = PersistenceService.getInstance();
  });

  afterEach(() => storage.dispose());

  it('remembers settings per game', () => {
    storage.saveSettings('frogger', { level: '4', time: 'on' });

    expect(storage.settings('frogger', OPTIONS)).toEqual({ level: '4', time: 'on' });
    expect(storage.settings('snake', OPTIONS)).toEqual({ level: '1', time: 'off' });
  });

  it('falls back to defaults for settings that are no longer valid', () => {
    storage.saveSettings('frogger', { level: '99', time: 'maybe', removed: 'x' });
    expect(storage.settings('frogger', OPTIONS)).toEqual({ level: '1', time: 'off' });
  });

  it('keeps the top 5 scores, best first, and says where a new one placed', () => {
    [100, 300, 200].forEach((score) => storage.addScore('snake', entry(score)));

    expect(storage.addScore('snake', entry(250))).toBe(1);
    expect(storage.scores('snake').map((e) => e.score)).toEqual([300, 250, 200, 100]);

    storage.addScore('snake', entry(50));
    expect(storage.addScore('snake', entry(10))).toBe(null);
    expect(storage.addScore('snake', entry(400))).toBe(0);
    expect(storage.scores('snake').map((e) => e.score)).toEqual([400, 300, 250, 200, 100]);
  });

  it('ranks a tie below the existing score and never records 0', () => {
    storage.addScore('snake', entry(100));
    expect(storage.addScore('snake', entry(100, 2))).toBe(1);
    expect(storage.addScore('snake', entry(0))).toBe(null);
    expect(storage.scores('snake').length).toBe(2);
  });

  it('saves, loads and deletes one game per id', () => {
    storage.saveGame('tetris', save());

    expect(storage.savedGame('tetris')).toEqual(save());
    expect(storage.savedGame('snake')).toBe(null);

    storage.deleteSave('tetris');
    expect(storage.savedGame('tetris')).toBe(null);
  });

  it('drops a save from another version', () => {
    storage.saveGame('tetris', save(SAVE_VERSION + 1));

    expect(storage.savedGame('tetris')).toBe(null);
    expect(localStorage.getItem('retro-cabinet:save:tetris')).toBe(null);
  });

  it('reads corrupt data as nothing stored', () => {
    localStorage.setItem('retro-cabinet:scores:snake', '{not json');
    localStorage.setItem('retro-cabinet:save:snake', '[]]');

    expect(storage.scores('snake')).toEqual([]);
    expect(storage.savedGame('snake')).toBe(null);
  });

  it('keeps working when storage is unavailable', () => {
    const fail = () => { throw new Error('QuotaExceededError'); };
    const getItem = spyOn(window.Storage.prototype, 'getItem').andCallFake(fail);
    const setItem = spyOn(window.Storage.prototype, 'setItem').andCallFake(fail);
    const removeItem = spyOn(window.Storage.prototype, 'removeItem').andCallFake(fail);

    expect(() => storage.saveGame('tetris', save())).not.toThrow();
    expect(() => storage.deleteSave('tetris')).not.toThrow();
    expect(storage.addScore('tetris', entry(100))).toBe(0);
    expect(storage.savedGame('tetris')).toBe(null);
    expect(storage.settings('tetris', OPTIONS)).toEqual({ level: '1', time: 'off' });

    getItem.restore();
    setItem.restore();
    removeItem.restore();
  });

  it('keeps a wins/draws/losses tally per key, starting at zero', () => {
    expect(storage.tally('secret', 'hard')).toEqual({ wins: 0, draws: 0, losses: 0 });

    storage.recordResult('secret', 'hard', 'draws');
    storage.recordResult('secret', 'hard', 'draws');
    expect(storage.recordResult('secret', 'easy', 'wins')).toEqual({ wins: 1, draws: 0, losses: 0 });

    expect(storage.tally('secret', 'hard')).toEqual({ wins: 0, draws: 2, losses: 0 });
    expect(storage.tally('secret', 'easy')).toEqual({ wins: 1, draws: 0, losses: 0 });
  });

  it('uses an option\'s declared default over its first choice', () => {
    const option = { key: 'difficulty', label: 'Difficulty', choices: [{ value: 'easy' }, { value: 'medium' }], defaultValue: 'medium' };
    expect(storage.settings('secret', [option])).toEqual({ difficulty: 'medium' });
  });
});
