import type { Component } from '../../../core/index.js';
import type { Stat } from '../../components/stats/stat/stat.component.js';
import type { GameOption, KeyHint, Random, Settings } from '../game.js';
import type { TallyResult } from '../../services/persistence/persistence.service.js';
import type { BonusGameId } from './registry.js';

// Contract between a bonus game and the BonusGameView, as Game is for the GameView:
// the game owns its state, rules and timing (an AI thinking, cards turning back, a clock),
// and knows nothing about the DOM or timers. The view asks when it next needs a tick,
// waits that long, then ticks it; between ticks the game waits for the player.
export interface BonusGame {
  // The Play section's line, e.g. "Your turn (X)." or "You win!".
  readonly status: string;
  // The round has ended: Enter or Space starts the next one.
  readonly isOver: boolean;
  // How the round ended for the player, for games tallying wins, draws and losses.
  readonly outcome?: TallyResult | null;
  // For games keeping a score table.
  readonly score?: number;
  readonly level?: number;
  // ms until the game next needs tick(); null while it waits for the player.
  nextTickIn(): number | null;
  // dt: the ms waited, as asked by nextTickIn().
  tick(dt: number): void;
  // The player picks a spot on the board: a cell, a column, a card, a hole…
  // action: what was picked, for boards with several kinds of controls (a slot or a colour…).
  select(index: number, action?: string): void;
  // A key pressed during the round (Enter/Space on a finished round start a new one,
  // in the view); true when the game used it, so its default is prevented.
  handleKey(code: string): boolean;
  // The round's keys, listed by the Play section's Controls button. A getter for keys that
  // depend on the options (e.g. Code Breaker's palette).
  readonly keyHints?: KeyHint[];
  // Values worth showing while playing, e.g. pairs found and misses; none by default.
  stats?(): Stat[];
}

// The board: a component (e.g. an UpdatableComponent) its parent refreshes with a config read from the game.
export type BoardComponent<C> = Component & { update(config: C): void };

// Method syntax on purpose: definitions with their own game and config types fit BonusGameDefinition.
export interface BonusBoard<G extends BonusGame, C extends object> {
  create(mountTarget: HTMLElement, config: C, onSelect: (index: number, action?: string) => void): BoardComponent<C>;
  // active: the view takes the player's input (always, except while a realtime game is paused).
  config(game: G, active: boolean): C;
}

// How a game's results are kept, per key (e.g. per difficulty):
// - tally: wins, draws and losses (from the game's outcome), and optionally the best won round;
// - scores: the top 5 (from the game's score and level), as in the cabinet's games.
export type BonusResults<G extends BonusGame> = {
  kind: 'tally';
  key(settings: Settings): string;
  // False for games that can't end in a draw (e.g. Matching Pairs): the tally leaves draws out.
  // A function for games where it depends on the options (e.g. Shut the Box, played solo or not).
  draws?: boolean | ((settings: Settings) => boolean);
  // Names for the wins and losses rows, when the game names its two sides (e.g. "Me" / "Evil Me").
  labels?: { wins: string; losses: string };
  // A won round's score, lower being better (e.g. misses): the best is kept per key.
  // everyRound: lost and drawn rounds count too, for games whose score is kept whatever the
  // outcome (e.g. Shut the Box's tiles left open, 0 on every win).
  best?: { label: string; score(game: G): number; everyRound?: boolean };
} | {
  kind: 'scores';
  key(settings: Settings): string;
};


// What a route hands to the BonusGameView: how to build a round from the chosen options,
// its board, and how its results are kept.
export interface BonusGameDefinition<G extends BonusGame = BonusGame, C extends object = object> {
  id: BonusGameId;
  // Names the stored options and results; defaults to the id.
  storageId?: string;
  options: GameOption[];
  create(settings: Settings, random: Random): G;
  board: BonusBoard<G, C>;
  results: BonusResults<G>;
  // Games played against the clock: a Start/Pause button (and Space), ticks only while running,
  // a pause when the page loses focus or the menu opens, options locked while running.
  // Absent for turn-based games, which wait for the player.
  realtime?: true;
}
