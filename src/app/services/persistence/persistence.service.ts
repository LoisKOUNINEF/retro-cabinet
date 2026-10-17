import { Service } from '../../../core/index.js';
import { SAVE_VERSION, defaultChoice, type GameOption, type Settings, type Snapshot } from '../../games/game.js';

const PREFIX = 'pixels-mansion';
const MAX_SCORES = 5;

export interface ScoreEntry {
  score: number;
  level: number;
  // ISO date string.
  date: string;
}

export interface SavedGame {
  version: number;
  settings: Settings;
  state: Snapshot;
  savedAt: string;
}

// Results of a turn-based game, e.g. per difficulty for the secret game.
export interface Tally {
  wins: number;
  draws: number;
  losses: number;
}

export type TallyResult = keyof Tally;

type Kind = 'settings' | 'scores' | 'save' | 'tally';

// Everything the app keeps between visits, per game: chosen options, the top-5 table
// and one saved game. Plain JSON in localStorage; when storage is unavailable
// (private mode, full quota), reads fall back to defaults and writes are skipped.
export class PersistenceService extends Service<PersistenceService> {
  // The stored options, falling back to each option's default when missing or no longer valid.
  settings(gameId: string, options: GameOption[] = []): Settings {
    const stored = this.read<Settings>('settings', gameId, {});
    return Object.fromEntries(options.map((option) => {
      const value = stored[option.key];
      const isValid = option.choices.some((choice) => choice.value === value);
      return [option.key, isValid && value !== undefined ? value : defaultChoice(option)];
    }));
  }

  saveSettings(gameId: string, settings: Settings): void {
    this.write('settings', gameId, settings);
  }

  scores(gameId: string): ScoreEntry[] {
    const scores = this.read<ScoreEntry[]>('scores', gameId, []);
    return Array.isArray(scores) ? scores : [];
  }

  // Adds a result to the table: its rank (0 = best) if it made the top 5, else null.
  addScore(gameId: string, entry: ScoreEntry): number | null {
    if (entry.score <= 0) return null;
    // A tie ranks below the existing score (the sort is stable).
    const table = [...this.scores(gameId), entry].sort((a, b) => b.score - a.score).slice(0, MAX_SCORES);
    const rank = table.indexOf(entry);
    if (rank === -1) return null;
    this.write('scores', gameId, table);
    return rank;
  }

  // A save from another SAVE_VERSION can't be trusted: it is dropped.
  savedGame(gameId: string): SavedGame | null {
    const save = this.read<SavedGame | null>('save', gameId, null);
    if (!save) return null;
    if (save.version !== SAVE_VERSION) {
      this.deleteSave(gameId);
      return null;
    }
    return save;
  }

  saveGame(gameId: string, save: SavedGame): void {
    this.write('save', gameId, save);
  }

  deleteSave(gameId: string): void {
    try {
      localStorage.removeItem(this.key('save', gameId));
    } catch {
      // Storage unavailable: nothing to delete.
    }
  }

  // The tally kept under `key` (e.g. a difficulty), zeros if none yet.
  tally(gameId: string, key: string): Tally {
    const stored = this.read<Record<string, Partial<Tally>>>('tally', gameId, {})[key] ?? {};
    return { wins: stored.wins ?? 0, draws: stored.draws ?? 0, losses: stored.losses ?? 0 };
  }

  recordResult(gameId: string, key: string, result: TallyResult): Tally {
    const all = this.read<Record<string, Tally>>('tally', gameId, {});
    const tally = this.tally(gameId, key);
    tally[result] += 1;
    this.write('tally', gameId, { ...all, [key]: tally });
    return tally;
  }

  private key(kind: Kind, gameId: string): string {
    return `${PREFIX}:${kind}:${gameId}`;
  }

  private read<T>(kind: Kind, gameId: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(this.key(kind, gameId));
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  }

  private write(kind: Kind, gameId: string, value: unknown): void {
    try {
      localStorage.setItem(this.key(kind, gameId), JSON.stringify(value));
    } catch {
      // Storage unavailable or full: the game goes on, unsaved.
    }
  }
}
