import { AppPipeRegistry, AppRouter, datePipe, initI18n } from '../core/index.js';
import { appRoutes } from './routes.js';
import { watchForTouch } from './components/touch-controls/stick.js';
import { checkScoreReward } from './services/reward/reward.js';

document.addEventListener('DOMContentLoaded', async () => {
  await initI18n();
  AppPipeRegistry.register('date', datePipe);
  watchForTouch();
  // Scores from before the reward existed earn it too, silently: the banner is for the moment it's earned.
  checkScoreReward();
  AppRouter(appRoutes);
});
