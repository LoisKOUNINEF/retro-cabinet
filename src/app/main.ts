import { AppRouter, initI18n, registerPipes } from '../core/index.js';
import { appRoutes } from './routes.js';
import { watchForTouch } from './components/touch-controls/stick.js';

document.addEventListener('DOMContentLoaded', async () => {
  await initI18n();
  registerPipes();
  watchForTouch();
  AppRouter(appRoutes);
});
