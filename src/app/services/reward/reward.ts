import { GAMES } from '../../games/registry.js';
import { PersistenceService, type Achievement } from '../persistence/persistence.service.js';

export type { Achievement };

// Dedicated: this many scores, across the cabinet's games.
export const DEDICATED_SCORES = 12;

// What the player did to earn the bonus games, as told in the congratulations.
export const ACHIEVEMENT_TEXT: Record<Achievement, { name: string; feat: string }> = {
  dedicated: { name: 'Dedicated', feat: `${DEDICATED_SCORES} high scores across the games` },
  enthusiast: { name: 'Enthusiast', feat: `a high score in all ${GAMES.length} games` },
  explorer: { name: 'Explorer', feat: 'found the bonus games' },
};

// The bonus games are a one-time reward: earned by scores in the cabinet's games
// (the bonus games' own don't count), or by finding them (direct URL, the 404 page).
export const hasReward = (): boolean => PersistenceService.getInstance().reward() !== null;

// The score achievement met by these score counts (one per cabinet game), if any.
export function scoreAchievement(counts: number[]): Achievement | null {
  if (counts.length > 0 && counts.every((count) => count > 0)) return 'enthusiast';
  if (counts.reduce((sum, count) => sum + count, 0) >= DEDICATED_SCORES) return 'dedicated';
  return null;
}

// Grants the reward if the stored scores now earn it: the achievement just met, else null
// (not met, or already rewarded).
export function checkScoreReward(): Achievement | null {
  const storage = PersistenceService.getInstance();
  if (storage.reward()) return null;
  const achievement = scoreAchievement(GAMES.map(({ id }) => storage.scores(id).length));
  if (achievement) storage.saveReward(achievement);
  return achievement;
}

// The player found the bonus games on their own: true if that just granted the reward.
export function unlockExplorer(): boolean {
  const storage = PersistenceService.getInstance();
  if (storage.reward()) return false;
  storage.saveReward('explorer');
  return true;
}
