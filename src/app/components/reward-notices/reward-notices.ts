import { Navigation } from '../../../core/index.js';
import { ACHIEVEMENT_TEXT, unlockExplorer, type Achievement } from '../../services/reward/reward.js';

// How long the Explorer toast stays, in ms.
export const TOAST_DURATION = 5000;

// The reward just earned by scores: a banner until dismissed, its action leading to the
// home page, where the cup now is. The bundle loads on first use.
export async function showRewardBanner(achievement: Achievement): Promise<void> {
  const { showNotificationBanner } = await import('a11y-elements/overlays/notification-banner');
  showNotificationBanner(`Congrats for having ${ACHIEVEMENT_TEXT[achievement].feat}! A gift is waiting for you on the home page.`, {
    type: 'success',
    actionText: 'See my gift',
    // The banner closes itself after its action.
    onAction: () => Navigation.navigateTo('/'),
  });
}

// The bonus games found by the player: a toast in the bottom-right corner, as an achievement.
export async function showExplorerToast(): Promise<void> {
  const { notify } = await import('a11y-elements/overlays/snackbar');
  notify(`Achievement unlocked: ${ACHIEVEMENT_TEXT.explorer.name}`, { type: 'success', position: 'bottom', duration: TOAST_DURATION });
}

// On every bonus page (hub or game): reaching it before earning it grants the reward.
// Arriving by the cup can't: the cup only shows once it's granted.
export function discoverBonus(): void {
  // A toast that can't show (its bundle failed to load) leaves the reward granted all the same.
  if (unlockExplorer()) showExplorerToast().catch(() => {});
}
