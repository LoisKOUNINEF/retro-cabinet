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
    storage.saveSettings('frog-crossing', { level: '4', time: 'on' });

    expect(storage.settings('frog-crossing', OPTIONS)).toEqual({ level: '4', time: 'on' });
    expect(storage.settings('snake', OPTIONS)).toEqual({ level: '1', time: 'off' });
  });

  it('falls back to defaults for settings that are no longer valid', () => {
    storage.saveSettings('frog-crossing', { level: '99', time: 'maybe', removed: 'x' });
    expect(storage.settings('frog-crossing', OPTIONS)).toEqual({ level: '1', time: 'off' });
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
    storage.saveGame('falling-blocks', save());

    expect(storage.savedGame('falling-blocks')).toEqual(save());
    expect(storage.savedGame('snake')).toBe(null);

    storage.deleteSave('falling-blocks');
    expect(storage.savedGame('falling-blocks')).toBe(null);
  });

  it('drops a save from another version', () => {
    storage.saveGame('falling-blocks', save(SAVE_VERSION + 1));

    expect(storage.savedGame('falling-blocks')).toBe(null);
    expect(localStorage.getItem('retro-cabinet:save:falling-blocks')).toBe(null);
  });

  it('reads corrupt data as nothing stored', () => {
    localStorage.setItem('retro-cabinet:scores:snake', '{not json');
    localStorage.setItem('retro-cabinet:save:snake', '[]]');

    expect(storage.scores('snake')).toEqual([]);
    expect(storage.savedGame('snake')).toBe(null);
  });

  it('reads well-formed JSON of the wrong shape as nothing stored', () => {
    ['settings', 'tally', 'save'].forEach((kind) => localStorage.setItem(`retro-cabinet:${kind}:secret`, 'null'));

    expect(storage.settings('secret', OPTIONS)).toEqual({ level: '1', time: 'off' });
    expect(storage.tally('secret', 'hard')).toEqual({ wins: 0, draws: 0, losses: 0 });
    expect(storage.recordResult('secret', 'hard', 'wins')).toEqual({ wins: 1, draws: 0, losses: 0 });
    expect(storage.savedGame('secret')).toBe(null);
  });

  it('skips malformed score entries and drops a malformed save', () => {
    localStorage.setItem('retro-cabinet:scores:snake', JSON.stringify([entry(300), null, { score: '9000' }, entry(100)]));
    localStorage.setItem('retro-cabinet:save:snake', JSON.stringify({ version: SAVE_VERSION, settings: {}, state: 'nope' }));

    expect(storage.scores('snake').map((e) => e.score)).toEqual([300, 100]);
    expect(storage.savedGame('snake')).toBe(null);
    expect(localStorage.getItem('retro-cabinet:save:snake')).toBe(null);
  });

  it('ignores stored settings that are not strings', () => {
    localStorage.setItem('retro-cabinet:settings:frog-crossing', JSON.stringify({ level: 4, time: ['on'] }));
    expect(storage.settings('frog-crossing', OPTIONS)).toEqual({ level: '1', time: 'off' });
  });

  it('keeps working when storage is unavailable', () => {
    const fail = () => { throw new Error('QuotaExceededError'); };
    const getItem = spyOn(window.Storage.prototype, 'getItem').andCallFake(fail);
    const setItem = spyOn(window.Storage.prototype, 'setItem').andCallFake(fail);
    const removeItem = spyOn(window.Storage.prototype, 'removeItem').andCallFake(fail);

    expect(() => storage.saveGame('falling-blocks', save())).not.toThrow();
    expect(() => storage.deleteSave('falling-blocks')).not.toThrow();
    expect(storage.addScore('falling-blocks', entry(100))).toBe(0);
    expect(storage.savedGame('falling-blocks')).toBe(null);
    expect(storage.settings('falling-blocks', OPTIONS)).toEqual({ level: '1', time: 'off' });

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

  it('keeps the best (lowest) value per key', () => {
    expect(storage.best('matching-pairs', '16-unlimited')).toBe(null);
    expect(storage.recordBest('matching-pairs', '16-unlimited', 6)).toBe(6);
    expect(storage.recordBest('matching-pairs', '16-unlimited', 9)).toBe(6);
    expect(storage.recordBest('matching-pairs', '16-unlimited', 3)).toBe(3);
    expect(storage.recordBest('matching-pairs', '24-10', 8)).toBe(8);
    expect(storage.best('matching-pairs', '16-unlimited')).toBe(3);
    expect(storage.best('matching-pairs', '24-10')).toBe(8);
  });

  it('reads a malformed best as none', () => {
    localStorage.setItem('retro-cabinet:best:matching-pairs', JSON.stringify({ a: 'x', b: null }));
    expect(storage.best('matching-pairs', 'a')).toBe(null);
    expect(storage.best('matching-pairs', 'b')).toBe(null);
    localStorage.setItem('retro-cabinet:best:matching-pairs', '[1]');
    expect(storage.best('matching-pairs', '0')).toBe(null);
  });

  it('keeps the reward once obtained, under one key', () => {
    expect(storage.reward()).toBe(null);

    storage.saveReward('dedicated');

    const reward = storage.reward();
    expect(reward.obtained).toBe(true);
    expect(reward.achievement).toBe('dedicated');
    expect(typeof reward.date).toBe('string');
    expect(JSON.parse(localStorage.getItem('retro-cabinet:reward:bonus')).achievement).toBe('dedicated');
  });

  it('treats a stored reward of the wrong shape as none', () => {
    [{ obtained: false, achievement: 'explorer', date: 'x' }, { obtained: true, achievement: 'cheater', date: 'x' }, { obtained: true, achievement: 'explorer' }, 'yes']
      .forEach((value) => {
        localStorage.setItem('retro-cabinet:reward:bonus', JSON.stringify(value));
        expect(storage.reward()).toBe(null);
      });
  });
});
