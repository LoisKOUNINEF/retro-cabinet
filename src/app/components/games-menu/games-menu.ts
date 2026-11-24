import { Navigation } from '../../../core/index.js';
import type { DropdownElement } from 'a11y-elements/overlays/dropdown/element';

export interface MenuLink {
  label: string;
  path: string;
}

export interface GamesMenuConfig {
  // Links above the games (e.g. "All games"), the last one closing the group with a border.
  home: MenuLink[];
  games: MenuLink[];
  // The page being played: its game is marked current.
  currentPath: string;
  // Called on Random: the path of another game.
  randomPath: () => string;
  // The menu covers the board: e.g. pause the game.
  onOpen?: () => void;
}

// The header's games menu: home links, every game (the current one marked) and Random.
// Built as DOM rather than a template: overlays move to <body>, out of reach of data-event.
// Appended to <body>: the caller removes it (e.g. in onBeforeDestroy).
export function createGamesMenu({ home, games, currentPath, randomPath, onOpen }: GamesMenuConfig): DropdownElement {
  import('a11y-elements/overlays/dropdown').catch(() => {});
  const menu = document.createElement('a11y-dropdown') as DropdownElement;
  menu.id = 'game-menu';
  menu.setAttribute('placement', 'bottom-start');
  const item = ({ label, path }: MenuLink): HTMLAnchorElement => {
    const link = document.createElement('a');
    link.setAttribute('role', 'menuitem');
    link.href = path;
    link.textContent = label;
    return link;
  };
  const homeLinks = home.map(item);
  homeLinks.at(-1)?.classList.add('game-menu__home');
  const gameLinks = games.map((game) => {
    const link = item(game);
    if (game.path === currentPath) link.setAttribute('aria-current', 'page');
    return link;
  });
  const random = item({ label: 'Random', path: '/' });
  random.classList.add('game-menu__random');
  random.dataset['random'] = '';
  menu.append(...homeLinks, ...gameLinks, random);
  if (onOpen) menu.addEventListener('a11y-overlay-open', onOpen);
  // In-app navigation for plain clicks; ctrl/shift/middle clicks keep the links' default.
  menu.addEventListener('click', (event: MouseEvent) => {
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('[role="menuitem"]');
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (link.getAttribute('aria-current') === 'page') return;
    if (link.hasAttribute('data-random')) return Navigation.navigateTo(randomPath());
    Navigation.navigateTo(link.getAttribute('href') ?? '/');
  });
  document.body.append(menu);
  return menu;
}
