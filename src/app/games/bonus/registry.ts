import type { Sprite } from '../sprites.js';
import { CODE_BREAKER_ICON, DOTS_AND_BOXES_ICON, MINEFIELD_ICON, NAVAL_BATTLE_ICON, MATCH_FOUR_ICON, MATCHING_PAIRS_ICON, NOUGHTS_CROSSES_ICON, RPSLS_ICON, ALIEN_SMASH_ICON } from './icons.js';
import type { BonusGameDefinition } from './bonus-game.js';

// The bonus cabinet's games, in hub order: the one list its routes, cards and menu are built from.
// Each game's code stays behind its import() and loads on the first visit to its page, with the
// BonusGameView. Kept apart from the main registry: nothing there links here.
export const BONUS_GAMES = [
  {
    id: 'match-four',
    title: 'Match Four',
    icon: MATCH_FOUR_ICON,
    load: () => import('./match-four/match-four.js').then((m) => m.matchFourGame),
  },
  {
    id: 'dots-and-boxes',
    title: 'Dots and Boxes',
    // The card's title fits ~8 characters a line: "Dots and" would take a third one.
    cardTitle: 'Dots and Boxes',
    icon: DOTS_AND_BOXES_ICON,
    load: () => import('./dots-and-boxes/dots-and-boxes.js').then((m) => m.dotsAndBoxesGame),
  },
  {
    id: 'naval-battle',
    title: 'Naval Battle',
    icon: NAVAL_BATTLE_ICON,
    load: () => import('./naval-battle/naval-battle.js').then((m) => m.navalBattleGame),
  },
  {
    id: 'matching-pairs',
    title: 'Matching Pairs',
    icon: MATCHING_PAIRS_ICON,
    load: () => import('./matching-pairs/matching-pairs.js').then((m) => m.matchingPairsGame),
  },
  {
    id: 'code-breaker',
    title: 'Code Breaker',
    icon: CODE_BREAKER_ICON,
    load: () => import('./code-breaker/code-breaker.js').then((m) => m.codeBreakerGame),
  },
  {
    id: 'minefield',
    title: 'Minefield',
    icon: MINEFIELD_ICON,
    load: () => import('./minefield/minefield.js').then((m) => m.minefieldGame),
  },
  {
    id: 'alien-smash',
    title: 'Alien Smash',
    icon: ALIEN_SMASH_ICON,
    load: () => import('./alien-smash/alien-smash.js').then((m) => m.alienSmashGame),
  },
  {
    id: 'noughts-and-crosses',
    title: 'Noughts & Crosses',
    // The card's title fits ~8 characters a line: "Noughts &" would take a third one.
    cardTitle: 'Noughts Crosses',
    icon: NOUGHTS_CROSSES_ICON,
    load: () => import('./noughts-and-crosses/noughts-and-crosses.js').then((m) => m.noughtsCrossesGame),
  },
  {
    id: 'rpsls',
    title: 'RPSLS',
    // The card's title fits ~8 characters a line, on two lines.
    cardTitle: 'RPSLS',
    icon: RPSLS_ICON,
    load: () => import('./rpsls/rpsls.js').then((m) => m.rpslsGame),
  },
] as const satisfies readonly { id: string; title: string; cardTitle?: string; icon: Sprite; load: () => Promise<BonusGameDefinition> }[];

export type BonusGameId = typeof BONUS_GAMES[number]['id'];

export const BONUS_PATH = '/bonus';

export const bonusGamePath = (id: BonusGameId) => `${BONUS_PATH}/${id}`;

export const bonusGameTitle = (id: BonusGameId) => BONUS_GAMES.find((game) => game.id === id)?.title ?? id;
