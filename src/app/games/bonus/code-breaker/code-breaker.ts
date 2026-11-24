import { CodeBreakerBoardComponent, type CodeBreakerBoardConfig } from '../../../components/code-breaker-board/code-breaker-board.component.js';
import type { Stat } from '../../../components/stats/stat/stat.component.js';
import type { TallyResult } from '../../../services/persistence/persistence.service.js';
import { choiceOf, pick, shuffle, type GameOption, type Random, type Settings } from '../../game.js';
import type { BonusGame, BonusGameDefinition } from '../bonus-game.js';
import { EMPTY, PEGS } from './pegs.js';

export const DIFFICULTY_OPTION: GameOption<'easy' | 'normal' | 'hard'> = {
  key: 'difficulty',
  label: 'Difficulty',
  choices: [
    { value: 'easy', label: 'Easy' },
    { value: 'normal', label: 'Normal' },
    { value: 'hard', label: 'Hard' },
  ],
  defaultValue: 'normal',
};

export const TRIES_OPTION: GameOption<'8' | '10' | '12'> = {
  key: 'tries',
  label: 'Tries',
  choices: [{ value: '8', label: '8' }, { value: '10', label: '10' }, { value: '12', label: '12' }],
  defaultValue: '10',
};

export const CODE_BREAKER_OPTIONS: GameOption[] = [DIFFICULTY_OPTION, TRIES_OPTION];

export type Difficulty = typeof DIFFICULTY_OPTION.choices[number]['value'];

export interface Rules {
  pegs: number;
  colours: number;
  repeats: boolean;
  // Empty holes are a colour of their own, in the code and in guesses.
  empty: boolean;
}

export const RULES: Record<Difficulty, Rules> = {
  easy: { pegs: 4, colours: 6, repeats: false, empty: false },
  normal: { pegs: 4, colours: 6, repeats: true, empty: false },
  hard: { pegs: 5, colours: 8, repeats: true, empty: true },
};

// The pegs a rule set plays with, as PEGS indices: its colours, then Empty if allowed.
export const palette = ({ colours, empty }: Rules): number[] => [...Array.from({ length: colours }, (_, i) => i), ...(empty ? [EMPTY] : [])];

export interface Feedback {
  // Right colour, right place.
  exact: number;
  // Right colour, wrong place.
  misplaced: number;
}

export interface Guess extends Feedback {
  pegs: readonly number[];
}

// Counted as usual: the pegs in place, then each colour's matches (the fewer of its counts in
// the code and the guess) not already in place.
export function score(code: readonly number[], guess: readonly number[]): Feedback {
  const exact = code.filter((peg, i) => guess[i] === peg).length;
  const counts = (pegs: readonly number[]) => pegs.reduce((map, peg) => map.set(peg, (map.get(peg) ?? 0) + 1), new Map<number, number>());
  const inGuess = counts(guess);
  const common = [...counts(code)].reduce((total, [peg, count]) => total + Math.min(count, inGuess.get(peg) ?? 0), 0);
  return { exact, misplaced: common - exact };
}

// "4 pegs, 6 colours, no repeats", under the board.
export const describeRules = ({ pegs, colours, repeats, empty }: Rules) =>
  `${pegs} pegs, ${colours} colours${empty ? ' and empty holes' : ''}, ${repeats ? 'repeats allowed' : 'no repeats'}`;

const pegNames = (pegs: readonly number[]) => pegs.map((peg) => PEGS[peg]?.name ?? '').join(', ');

export interface CodeBreakerOptions {
  rules: Rules;
  tries: number;
  random: Random;
}

// A round of Code Breaker: crack the AI's secret code within the tries, each guess being told how
// many of its pegs are the right colour in the right place, and how many the right colour elsewhere.
export class CodeBreaker implements BonusGame {
  readonly rules: Rules;
  readonly tries: number;
  readonly code: readonly number[];
  readonly guesses: Guess[] = [];
  // The row being played, a new array on each change; null for a hole not filled yet.
  current: (number | null)[];
  // The hole the next colour goes in.
  cursor = 0;
  // Check was pressed on a row with holes left.
  private _incomplete = false;

  constructor({ rules, tries, random }: CodeBreakerOptions) {
    this.rules = rules;
    this.tries = tries;
    const colours = palette(rules);
    this.code = rules.repeats
      ? Array.from({ length: rules.pegs }, () => pick(colours, random))
      : shuffle(colours, random).slice(0, rules.pegs);
    this.current = Array<number | null>(rules.pegs).fill(null);
  }

  get palette(): number[] {
    return palette(this.rules);
  }

  get outcome(): TallyResult | null {
    if (this.guesses.at(-1)?.exact === this.rules.pegs) return 'wins';
    return this.guesses.length >= this.tries ? 'losses' : null;
  }

  get isOver(): boolean {
    return this.outcome !== null;
  }

  get isFull(): boolean {
    return this.current.every((peg) => peg !== null);
  }

  get status(): string {
    const again = ' Press Enter or New round to play again.';
    const count = this.guesses.length;
    switch (this.outcome) {
      case 'wins': return `Cracked in ${count} ${count === 1 ? 'guess' : 'guesses'}!${again}`;
      case 'losses': return `Out of tries: the code was ${pegNames(this.code)}.${again}`;
      default: {
        const last = this.guesses.at(-1);
        const told = last ? `${last.exact} in place, ${last.misplaced} misplaced. ` : '';
        if (this._incomplete) return `${told}Fill every hole, then Check.`;
        return `${told}Guess ${count + 1} of ${this.tries}: ${this.rules.repeats ? 'colours may repeat' : 'no colour repeats'}.`;
      }
    }
  }

  // Whether the peg can go under the cursor: on Easy, a colour already elsewhere in the row can't.
  canPlace(peg: number): boolean {
    if (this.isOver || !this.palette.includes(peg)) return false;
    return this.rules.repeats || this.current.every((placed, i) => placed !== peg || i === this.cursor);
  }

  nextTickIn(): number | null {
    return null;
  }

  tick(): void {}

  // colour: put that peg in the cursor's hole; slot: aim at that hole, or empty it if already aimed at;
  // check: score the row, once it's full.
  select(index: number, action = 'colour'): void {
    if (this.isOver) return;
    if (action === 'check') return this.check();
    if (action === 'slot') return this.selectSlot(index);
    this.place(index);
  }

  // 1–9 put the palette's pegs, ←/→ aim, Backspace and Delete empty a hole, Enter checks.
  handleKey(code: string): boolean {
    const digit = /^(?:Digit|Numpad)([1-9])$/.exec(code);
    if (digit) {
      const peg = this.palette[Number(digit[1]) - 1];
      if (peg !== undefined) this.select(peg);
      return true;
    }
    switch (code) {
      case 'ArrowLeft': this.cursor = Math.max(this.cursor - 1, 0); return true;
      case 'ArrowRight': this.cursor = Math.min(this.cursor + 1, this.rules.pegs - 1); return true;
      case 'Enter': this.check(); return true;
      case 'Delete': this.clear(this.cursor); return true;
      case 'Backspace':
        // An empty hole: the one before it, as when typing.
        if (this.current[this.cursor] === null && this.cursor > 0) this.cursor--;
        this.clear(this.cursor);
        return true;
      default: return false;
    }
  }

  stats(): Stat[] {
    return [{ key: 'guesses', label: 'Guesses', value: `${this.guesses.length}/${this.tries}` }];
  }

  private place(peg: number): void {
    if (!this.canPlace(peg)) return;
    this.current = this.current.map((placed, i) => (i === this.cursor ? peg : placed));
    this._incomplete = false;
    // On to the next hole left, after the cursor first.
    const { pegs } = this.rules;
    const next = Array.from({ length: pegs - 1 }, (_, step) => (this.cursor + step + 1) % pegs).find((i) => this.current[i] === null);
    if (next !== undefined) this.cursor = next;
  }

  private selectSlot(index: number): void {
    if (index < 0 || index >= this.rules.pegs) return;
    if (index === this.cursor) this.clear(index);
    this.cursor = index;
  }

  private clear(index: number): void {
    if (this.current[index] === null) return;
    this.current = this.current.map((placed, i) => (i === index ? null : placed));
  }

  private check(): void {
    if (this.isOver) return;
    if (!this.isFull) {
      this._incomplete = true;
      return;
    }
    const pegs = this.current as number[];
    this.guesses.push({ pegs, ...score(this.code, pegs) });
    this.current = Array<number | null>(this.rules.pegs).fill(null);
    this.cursor = 0;
    this._incomplete = false;
  }
}

export const codeBreakerGame: BonusGameDefinition<CodeBreaker, CodeBreakerBoardConfig> = {
  id: 'code-breaker',
  options: CODE_BREAKER_OPTIONS,
  create: (settings: Settings, random: Random) => new CodeBreaker({
    rules: RULES[choiceOf(settings, DIFFICULTY_OPTION)],
    tries: Number(choiceOf(settings, TRIES_OPTION)),
    random,
  }),
  board: {
    create: (el, config, onSelect) => new CodeBreakerBoardComponent(el, config, onSelect),
    config: (game) => ({
      pegs: game.rules.pegs,
      rules: describeRules(game.rules),
      tries: game.tries,
      guesses: game.guesses.map(({ pegs, exact, misplaced }) => ({ pegs, exact, misplaced })),
      current: game.current,
      cursor: game.cursor,
      palette: game.palette.map((peg) => ({ peg, disabled: !game.canPlace(peg) })),
      // Shown once the round is over.
      code: game.isOver ? game.code : null,
      full: game.isFull,
      locked: game.isOver,
    }),
  },
  // A tally (and the fewest guesses) per difficulty and tries.
  results: {
    kind: 'tally',
    key: (settings) => `${choiceOf(settings, DIFFICULTY_OPTION)}-${choiceOf(settings, TRIES_OPTION)}`,
    draws: false,
    best: { label: 'Fewest guesses', score: (game) => game.guesses.length },
  },
};
