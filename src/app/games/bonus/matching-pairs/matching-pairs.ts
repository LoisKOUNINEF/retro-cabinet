import { MatchingPairsBoardComponent, type MatchingPairsBoardConfig } from '../../../components/matching-pairs-board/matching-pairs-board.component.js';
import type { Stat } from '../../../components/stats/stat/stat.component.js';
import type { TallyResult } from '../../../services/persistence/persistence.service.js';
import { choiceOf, shuffle, type GameOption, type Random, type Settings, ARROW_CODES, PICK_CODES, type KeyHint } from '../../game.js';
import { clickHint, type BonusGame, type BonusGameDefinition } from '../bonus-game.js';
import { FACES } from './faces.js';

export const CARDS_OPTION: GameOption<'12' | '16' | '20' | '24'> = {
  key: 'cards',
  label: 'Cards',
  choices: [{ value: '12', label: '12' }, { value: '16', label: '16' }, { value: '20', label: '20' }, { value: '24', label: '24' }],
  defaultValue: '16',
};

// Misses allowed before the round is lost.
export const TRIES_OPTION: GameOption<'unlimited' | '5' | '10' | '15' | '20'> = {
  key: 'tries',
  label: 'Tries',
  choices: [
    { value: 'unlimited', label: 'Unlimited' },
    { value: '5', label: '5' },
    { value: '10', label: '10' },
    { value: '15', label: '15' },
    { value: '20', label: '20' },
  ],
};

// How long two different cards stay face up before turning back, in ms; 'click': until a card is picked.
export const REVEAL_OPTION: GameOption<'500' | '1000' | '2000' | '3000' | 'click'> = {
  key: 'reveal',
  label: 'Reveal time',
  choices: [
    { value: '500', label: '0.5 s' },
    { value: '1000', label: '1 s' },
    { value: '2000', label: '2 s' },
    { value: '3000', label: '3 s' },
    { value: 'click', label: 'Until click' },
  ],
  defaultValue: '1000',
};

export const MATCHING_PAIRS_OPTIONS: GameOption[] = [CARDS_OPTION, TRIES_OPTION, REVEAL_OPTION];

// Cards per row, per deck size: 4×3, 4×4, 5×4, 6×4.
export const GRID_COLUMNS: Record<number, number> = { 12: 4, 16: 4, 20: 5, 24: 6 };

// 'revealed': face up once the round is lost, to show where the pairs were.
export type CardState = 'hidden' | 'shown' | 'found' | 'revealed';

export interface MatchingPairsCard {
  // Index in FACES.
  face: number;
  state: CardState;
}

export interface MatchingPairsOptions {
  cards: number;
  // Misses allowed; null for unlimited.
  tries: number | null;
  // How long a mismatched pair stays face up, in ms; null until a card is picked.
  revealMs: number | null;
  random: Random;
}

// A round of Matching Pairs: turn two cards, keep them if they match, find every pair before
// running out of tries.
export class MatchingPairs implements BonusGame {
  readonly clickHints = clickHint('a card.');
  get rules(): string[] {
    return [
      `Goal: find all ${this.pairs} pairs.`,
      'Turn over two cards: a pair stays face up.',
      ...(this.tries === null ? [] : [`${this.tries} misses allowed.`]),
    ];
  }

  readonly keyHints: KeyHint[] = [{ action: 'Move', codes: ARROW_CODES }, { action: 'Turn over', codes: PICK_CODES }];
  readonly cards: MatchingPairsCard[];
  readonly columns: number;
  readonly tries: number | null;
  readonly revealMs: number | null;
  cursor = 0;
  misses = 0;
  pairsFound = 0;
  // The face-up cards of the turn, at most two.
  private _turned: number[] = [];
  // Time left before a mismatched pair turns back.
  private _hideIn: number | null = null;

  constructor({ cards, tries, revealMs, random }: MatchingPairsOptions) {
    const pairs = shuffle(FACES.map((_, face) => face), random).slice(0, cards / 2);
    this.cards = shuffle([...pairs, ...pairs], random).map((face) => ({ face, state: 'hidden' as CardState }));
    this.columns = GRID_COLUMNS[cards] ?? 4;
    this.tries = tries;
    this.revealMs = revealMs;
  }

  get pairs(): number {
    return this.cards.length / 2;
  }

  get triesLeft(): number | null {
    return this.tries === null ? null : Math.max(this.tries - this.misses, 0);
  }

  // A mismatched pair is face up: the next pick only turns it back.
  get turningBack(): boolean {
    return this._turned.length === 2;
  }

  get isOver(): boolean {
    return this.outcome !== null;
  }

  get outcome(): TallyResult | null {
    if (this.pairsFound === this.pairs) return 'wins';
    return this.triesLeft === 0 ? 'losses' : null;
  }

  get status(): string {
    const again = ' Press Enter or New round to play again.';
    const outcome = this.outcome;
    if (outcome === 'wins') return `You found every pair, with ${this.misses} ${this.misses === 1 ? 'miss' : 'misses'}!${again}`;
    if (outcome === 'losses') return `Out of tries.${again}`;
    if (this.turningBack) return this.revealMs === null ? 'No match. Pick any card to turn them back.' : 'No match.';
    return this._turned.length === 1 ? 'Find its pair.' : 'Find the pairs.';
  }

  nextTickIn(): number | null {
    return this._hideIn;
  }

  tick(dt: number): void {
    if (this._hideIn === null) return;
    this._hideIn -= dt;
    if (this._hideIn <= 0) this.turnBack();
  }

  select(index: number): void {
    if (this.outcome) return;
    // A mismatched pair still showing: any pick only turns it back.
    if (this.turningBack) {
      this.turnBack();
      return;
    }
    const card = this.cards[index];
    if (!card || card.state !== 'hidden') return;
    card.state = 'shown';
    this.cursor = index;
    this._turned.push(index);
    if (this._turned.length === 2) this.compare();
  }

  // Arrows move the cursor across the grid, Enter or Space turns its card.
  handleKey(code: string): boolean {
    if (code === 'Enter' || code === 'Space') {
      this.select(this.cursor);
      return true;
    }
    const row = Math.floor(this.cursor / this.columns);
    const column = this.cursor % this.columns;
    const rows = this.cards.length / this.columns;
    switch (code) {
      case 'ArrowLeft': this.cursor -= column > 0 ? 1 : 0; return true;
      case 'ArrowRight': this.cursor += column < this.columns - 1 ? 1 : 0; return true;
      case 'ArrowUp': this.cursor -= row > 0 ? this.columns : 0; return true;
      case 'ArrowDown': this.cursor += row < rows - 1 ? this.columns : 0; return true;
      default: return false;
    }
  }

  stats(): Stat[] {
    return [
      { key: 'pairs', label: 'Pairs', value: `${this.pairsFound}/${this.pairs}` },
      { key: 'misses', label: 'Misses', value: this.misses },
      ...(this.triesLeft === null ? [] : [{ key: 'tries', label: 'Tries left', value: this.triesLeft }]),
    ];
  }

  private compare(): void {
    const [a, b] = this._turned.map((index) => this.cards[index]!);
    if (a!.face === b!.face) {
      a!.state = 'found';
      b!.state = 'found';
      this.pairsFound++;
      this._turned = [];
      return;
    }
    this.misses++;
    if (this.outcome === 'losses') {
      // The last try: the pair stays up, and every other card shows where it was.
      this.cards.forEach((card) => card.state === 'hidden' && (card.state = 'revealed'));
      this._turned = [];
      return;
    }
    this._hideIn = this.revealMs;
  }

  private turnBack(): void {
    this._turned.forEach((index) => (this.cards[index]!.state = 'hidden'));
    this._turned = [];
    this._hideIn = null;
  }
}

// The results' key: one tally (and best) per deck size and tries.
const resultKey = (settings: Settings) => `${choiceOf(settings, CARDS_OPTION)}-${choiceOf(settings, TRIES_OPTION)}`;

export const matchingPairsGame: BonusGameDefinition<MatchingPairs, MatchingPairsBoardConfig> = {
  id: 'matching-pairs',
  options: MATCHING_PAIRS_OPTIONS,
  create: (settings: Settings, random: Random) => {
    const tries = choiceOf(settings, TRIES_OPTION);
    const reveal = choiceOf(settings, REVEAL_OPTION);
    return new MatchingPairs({
      cards: Number(choiceOf(settings, CARDS_OPTION)),
      tries: tries === 'unlimited' ? null : Number(tries),
      revealMs: reveal === 'click' ? null : Number(reveal),
      random,
    });
  },
  board: {
    create: (el, config, onSelect) => new MatchingPairsBoardComponent(el, config, onSelect),
    config: (game) => ({
      cards: game.cards.map(({ face, state }) => ({ face, state })),
      columns: game.columns,
      cursor: game.cursor,
      turningBack: game.turningBack,
      locked: game.outcome !== null,
    }),
  },
  results: { kind: 'tally', key: resultKey, draws: false, best: { label: 'Fewest misses', score: (game) => game.misses } },
};
