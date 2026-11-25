import { DEDICATED_SCORES, checkScoreReward, hasReward, scoreAchievement, unlockExplorer } from '#root/dist/src/app/services/reward/reward.js';
import { PersistenceService } from '#root/dist/src/app/services/persistence/persistence.service.js';
import { GAMES } from '#root/dist/src/app/games/registry.js';

const entry = (score) => ({ score, level: 1, date: '2026-11-24T10:00:00.000Z' });
// `count` scores in each of these games.
const addScores = (ids, count) => ids.forEach((id) => {
  for (let i = 1; i <= count; i += 1) PersistenceService.getInstance().addScore(id, entry(i * 10));
});

describe('reward', () => {
  beforeEach(() => localStorage.clear());

  afterEach(() => PersistenceService.getInstance().dispose());

  it('is Dedicated from 12 scores across the games', () => {
    expect(DEDICATED_SCORES).toBe(12);
    expect(scoreAchievement([5, 5, 1, 0, 0, 0, 0, 0, 0])).toBe(null);
    expect(scoreAchievement([5, 5, 2, 0, 0, 0, 0, 0, 0])).toBe('dedicated');
    expect(scoreAchievement([2, 2, 2, 2, 2, 2, 0, 0, 0])).toBe('dedicated');
  });

  it('is Enthusiast with a score in every game', () => {
    expect(scoreAchievement([1, 1, 1, 1, 1, 1, 1, 1, 0])).toBe(null);
    expect(scoreAchievement([1, 1, 1, 1, 1, 1, 1, 1, 1])).toBe('enthusiast');
    // Both met: the rarer one is told.
    expect(scoreAchievement([2, 2, 2, 2, 2, 2, 1, 1, 1])).toBe('enthusiast');
  });

  it('grants the reward once the stored scores earn it, then never again', () => {
    addScores(['falling-blocks', 'snake'], 5);
    addScores(['table-tennis'], 1);
    expect(checkScoreReward()).toBe(null);
    expect(hasReward()).toBe(false);

    addScores(['frog-crossing'], 1);
    expect(checkScoreReward()).toBe('dedicated');
    expect(hasReward()).toBe(true);
    expect(PersistenceService.getInstance().reward().achievement).toBe('dedicated');

    addScores(GAMES.map(({ id }) => id), 1);
    expect(checkScoreReward()).toBe(null);
    expect(PersistenceService.getInstance().reward().achievement).toBe('dedicated');
  });

  it('grants it for a score in each of the cabinet\'s games', () => {
    addScores(GAMES.map(({ id }) => id), 1);
    expect(checkScoreReward()).toBe('enthusiast');
  });

  it('leaves the bonus games\' own scores out', () => {
    addScores(['alien-smash:normal', 'matching-pairs', 'minefield'], 5);
    expect(checkScoreReward()).toBe(null);
  });

  it('grants it to an explorer, unless already earned', () => {
    expect(unlockExplorer()).toBe(true);
    expect(PersistenceService.getInstance().reward().achievement).toBe('explorer');
    expect(unlockExplorer()).toBe(false);

    localStorage.clear();
    addScores(GAMES.map(({ id }) => id), 1);
    checkScoreReward();
    expect(unlockExplorer()).toBe(false);
    expect(PersistenceService.getInstance().reward().achievement).toBe('enthusiast');
  });
});
