import { Service } from '../../../core/index.js';
import { SAVE_VERSION, defaultChoice, type GameOption, type Settings, type Snapshot } from '../../games/game.js';

const PREFIX = 'retro-cabinet';
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

// Stored JSON is untrusted (older versions, hand edits, other code on the origin): every
// reader checks the shape it gets and treats anything else as nothing stored.
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isScoreEntry = (value: unknown): value is ScoreEntry =>
  isRecord(value) && typeof value.score === 'number' && typeof value.level === 'number' && typeof value.date === 'string';

const isSavedGame = (value: unknown): value is SavedGame =>
  isRecord(value) && typeof value.version === 'number' && isRecord(value.settings) && isRecord(value.state);

const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

// Each option's stored value, or its default when missing or no longer one of its choices.
export function validSettings(stored: unknown, options: GameOption[] = []): Settings {
  const record = isRecord(stored) ? stored : {};
  return Object.fromEntries(options.map((option) => {
    const value = record[option.key];
    const isValid = typeof value === 'string' && option.choices.some((choice) => choice.value === value);
    return [option.key, isValid ? value : defaultChoice(option)];
  }));
}

// Everything the app keeps between visits, per game: chosen options, the top-5 table
// and one saved game. Plain JSON in localStorage; when storage is unavailable
// (private mode, full quota), reads fall back to defaults and writes are skipped.
export class PersistenceService extends Service<PersistenceService> {
  // The stored options, falling back to each option's default when missing or no longer valid.
  settings(gameId: string, options: GameOption[] = []): Settings {
    return validSettings(this.read('settings', gameId), options);
  }

  saveSettings(gameId: string, settings: Settings): void {
    this.write('settings', gameId, settings);
  }

  scores(gameId: string): ScoreEntry[] {
    const scores = this.read('scores', gameId);
    return Array.isArray(scores) ? scores.filter(isScoreEntry) : [];
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

  // A save from another version of the game can't be trusted: it is dropped.
  savedGame(gameId: string, version = SAVE_VERSION): SavedGame | null {
    const save = this.read('save', gameId);
    if (save === null) return null;
    if (!isSavedGame(save) || save.version !== version) {
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
    const all = this.read('tally', gameId);
    const stored = isRecord(all) ? all[key] : undefined;
    if (!isRecord(stored)) return { wins: 0, draws: 0, losses: 0 };
    return { wins: count(stored.wins), draws: count(stored.draws), losses: count(stored.losses) };
  }

  recordResult(gameId: string, key: string, result: TallyResult): Tally {
    const stored = this.read('tally', gameId);
    const all = isRecord(stored) ? stored : {};
    const tally = this.tally(gameId, key);
    tally[result] += 1;
    this.write('tally', gameId, { ...all, [key]: tally });
    return tally;
  }

  private key(kind: Kind, gameId: string): string {
    return `${PREFIX}:${kind}:${gameId}`;
  }

  // The parsed value, or null when missing, unreadable or not JSON.
  private read(kind: Kind, gameId: string): unknown {
    try {
      const raw = localStorage.getItem(this.key(kind, gameId));
      return raw === null ? null : (JSON.parse(raw) as unknown);
    } catch {
      return null;
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
