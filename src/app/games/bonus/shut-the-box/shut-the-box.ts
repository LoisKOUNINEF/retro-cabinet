import { ShutTheBoxBoardComponent, type ShutTheBoxBoardConfig } from '../../../components/shut-the-box-board/shut-the-box-board.component.js';
import type { Stat } from '../../../components/stats/stat/stat.component.js';
import type { TallyResult } from '../../../services/persistence/persistence.service.js';
import { choiceOf, isOn, onOff, type GameOption, type Random, type Settings } from '../../game.js';
import type { BonusGame, BonusGameDefinition } from '../bonus-game.js';
import { AI_DELAY_MS } from '../turns.js';
import { canComplete, combinations, matchChance, rollDie } from './dice.js';

export const TILES_OPTION: GameOption<'9' | '10' | '12'> = {
  key: 'tiles',
  label: 'Tiles',
  choices: [{ value: '9', label: '1 to 9' }, { value: '10', label: '1 to 10' }, { value: '12', label: '1 to 12' }],
};

export const PLAYERS_OPTION: GameOption<'solo' | 'ai'> = {
  key: 'players',
  label: 'Players',
  choices: [{ value: 'solo', label: 'Solo' }, { value: 'ai', label: 'Vs opponent' }],
};

// Once every tile from 7 up is shut, a single die may be rolled instead of two.
export const ONE_DIE_OPTION = onOff('oneDie', 'One die');

export const SHUT_THE_BOX_OPTIONS: GameOption[] = [TILES_OPTION, PLAYERS_OPTION, ONE_DIE_OPTION];

// The dice roll this long before they land.
export const ROLL_MS = 600;
// The player's turn is over: the opponent's starts after this long.
export const TURN_PAUSE_MS = 1200;

// The lowest tile that has to be shut before a single die may be rolled.
export const ONE_DIE_FROM = 7;

// roll: waiting for a roll; rolling: the dice are rolling; pick: tiles adding up to the dice to shut;
// over: both turns played (or the box shut).
export type Phase = 'roll' | 'rolling' | 'pick' | 'over';
export type Side = 'player' | 'ai';

export interface ShutTheBoxOptions {
  tiles: number;
  // Against the AI, each on its own box, rather than solo.
  vs: boolean;
  oneDie: boolean;
  random: Random;
}

const sum = (numbers: readonly number[]) => numbers.reduce((total, n) => total + n, 0);

// Of the sets adding up to the roll, the AI shuts the one with the highest tile (they're the
// hardest to shut later), then the one with the fewest tiles.
export function aiChoice(open: readonly number[], total: number): number[] | null {
  const ranked = combinations(open, total).sort((a, b) => Math.max(...b) - Math.max(...a) || a.length - b.length);
  return ranked[0] ?? null;
}

// A round of Shut the Box: roll two dice, shut open tiles adding up to their total, again and
// again until no open tiles add up to the roll. The tiles left open are the score, lower being
// better; shutting them all wins at once. Solo, a round is won only by shutting the box; against
// the AI, it then plays its own turn on its own box, and the lower score wins.
export class ShutTheBox implements BonusGame {
  readonly tiles: number;
  readonly vs: boolean;
  readonly oneDie: boolean;
  // Each side's tiles: shut[side][n - 1] for tile n.
  readonly shut: Record<Side, boolean[]>;
  turn: Side = 'player';
  phase: Phase = 'roll';
  // The last roll's dice, 0 for a die still rolling; empty before the first roll.
  dice: number[] = [];
  // The tiles picked towards the roll's total, not shut yet.
  selected: number[] = [];
  // The keyboard cursor's tile, as an index.
  cursor = 0;
  private readonly _random: Random;
  private _wait = 0;

  constructor({ tiles, vs, oneDie, random }: ShutTheBoxOptions) {
    this.tiles = tiles;
    this.vs = vs;
    this.oneDie = oneDie;
    this._random = random;
    this.shut = { player: Array<boolean>(tiles).fill(false), ai: Array<boolean>(tiles).fill(false) };
  }

  // The side's open tiles, lowest first.
  open(side: Side): number[] {
    return this.shut[side].flatMap((shut, i) => (shut ? [] : [i + 1]));
  }

  // The side's score: the sum of its open tiles.
  openSum(side: Side): number {
    return sum(this.open(side));
  }

  get playerScore(): number {
    return this.openSum('player');
  }

  get total(): number {
    return sum(this.dice);
  }

  get selectedSum(): number {
    return sum(this.selected);
  }

  // A single die may be rolled: the option is on, and the side's tiles from 7 up are shut.
  canRollOne(side: Side = this.turn): boolean {
    return this.oneDie && this.shut[side].every((shut, i) => shut || i + 1 < ONE_DIE_FROM);
  }

  // The player may roll now.
  get canRoll(): boolean {
    return this.turn === 'player' && this.phase === 'roll';
  }

  // Whether tile `n` can be picked (or unpicked) now.
  canToggle(n: number): boolean {
    if (this.turn !== 'player' || this.phase !== 'pick') return false;
    return this.selected.includes(n) || canComplete(this.open('player'), this.selected, n, this.total);
  }

  get isOver(): boolean {
    return this.phase === 'over';
  }

  get outcome(): TallyResult | null {
    if (!this.isOver) return null;
    const player = this.openSum('player');
    if (player === 0) return 'wins';
    if (!this.vs) return 'losses';
    const ai = this.openSum('ai');
    return player < ai ? 'wins' : player > ai ? 'losses' : 'draws';
  }

  get status(): string {
    if (this.isOver) return `${this.result()} Press Enter or New round to play again.`;
    if (this.turn === 'ai') return `You score ${this.openSum('player')}. Your opponent's turn…`;
    switch (this.phase) {
      case 'rolling': return 'Rolling…';
      case 'pick': {
        const picked = this.selected.length ? `: ${this.selectedSum} so far` : '';
        return `Shut tiles adding up to ${this.total}${picked}.`;
      }
      default: {
        const one = this.canRollOne() ? ', or a single die' : '';
        return `${this.dice.length ? 'Roll again' : 'Roll the dice'}${one}.`;
      }
    }
  }

  private result(): string {
    const player = this.openSum('player');
    if (player === 0) return 'You shut the box!';
    if (!this.vs) return `Nothing adds up to ${this.total}: you score ${player}.`;
    const ai = this.openSum('ai');
    if (ai === 0) return 'Your opponent shut the box.';
    const verdict = player < ai ? 'You win!' : player > ai ? 'Your opponent wins.' : 'A draw.';
    return `You score ${player}, your opponent ${ai}. ${verdict}`;
  }

  nextTickIn(): number | null {
    if (this.isOver) return null;
    return this.phase === 'rolling' || this.turn === 'ai' ? this._wait : null;
  }

  tick(dt: number): void {
    if (this.nextTickIn() === null) return;
    this._wait -= dt;
    if (this._wait > 0) return;
    if (this.phase === 'rolling') return this.land();
    if (this.phase === 'roll') return this.startRoll(this.aiDice());
    this.aiShut();
  }

  // tile: pick or unpick tile index + 1; roll: roll `index` dice (1 or 2).
  select(index: number, action = 'tile'): void {
    if (action === 'roll') return this.roll(index === 1 ? 1 : 2);
    this.toggle(index + 1);
  }

  // R (or Enter/Space when waiting for a roll) rolls two dice, O one die; 1–9 and 0 (for 10) pick
  // a tile, ←/→ move the cursor, Enter or Space pick the tile under it.
  handleKey(code: string): boolean {
    const digit = /^(?:Digit|Numpad)(\d)$/.exec(code);
    if (digit) {
      this.toggle(Number(digit[1]) || 10);
      return true;
    }
    switch (code) {
      case 'KeyR': this.roll(2); return true;
      case 'KeyO': this.roll(1); return true;
      case 'Enter':
      case 'Space':
        if (this.canRoll) this.roll(2);
        else this.toggle(this.cursor + 1);
        return true;
      case 'ArrowLeft': this.cursor = Math.max(this.cursor - 1, 0); return true;
      case 'ArrowRight': this.cursor = Math.min(this.cursor + 1, this.tiles - 1); return true;
      default: return false;
    }
  }

  stats(): Stat[] {
    if (this.vs) {
      return [
        { key: 'you', label: 'You', value: this.openSum('player') },
        { key: 'ai', label: 'Opponent', value: this.openSum('ai') },
      ];
    }
    return [
      { key: 'score', label: 'Score', value: this.openSum('player') },
      { key: 'shut', label: 'Tiles shut', value: `${this.tiles - this.open('player').length}/${this.tiles}` },
    ];
  }

  private roll(dice: 1 | 2): void {
    if (!this.canRoll || (dice === 1 && !this.canRollOne())) return;
    this.startRoll(dice);
  }

  private startRoll(dice: 1 | 2): void {
    this.dice = Array<number>(dice).fill(0);
    this.selected = [];
    this.phase = 'rolling';
    this._wait = ROLL_MS;
  }

  // The dice land: tiles to shut, or the end of the turn if none add up to them.
  private land(): void {
    this.dice = this.dice.map(() => rollDie(this._random));
    if (!combinations(this.open(this.turn), this.total).length) return this.endTurn();
    this.phase = 'pick';
    this._wait = AI_DELAY_MS;
  }

  private toggle(n: number): void {
    if (!this.canToggle(n)) return;
    this.cursor = n - 1;
    this.selected = this.selected.includes(n) ? this.selected.filter((tile) => tile !== n) : [...this.selected, n];
    if (this.selectedSum === this.total) this.shutTiles(this.selected);
  }

  private shutTiles(tiles: readonly number[]): void {
    tiles.forEach((n) => (this.shut[this.turn][n - 1] = true));
    this.selected = [];
    if (this.openSum(this.turn) === 0) return this.endTurn();
    this.phase = 'roll';
    this._wait = AI_DELAY_MS;
  }

  // Solo, or once the player shut the box, the round is over; otherwise the AI plays its turn.
  private endTurn(): void {
    if (this.turn === 'player' && this.vs && this.openSum('player') > 0) {
      this.turn = 'ai';
      this.phase = 'roll';
      this._wait = TURN_PAUSE_MS;
      return;
    }
    this.phase = 'over';
  }

  // The AI rolls one die when it may, and when that's likelier to give a total it can shut.
  private aiDice(): 1 | 2 {
    const open = this.open('ai');
    return this.canRollOne('ai') && matchChance(open, 1) > matchChance(open, 2) ? 1 : 2;
  }

  private aiShut(): void {
    const choice = aiChoice(this.open('ai'), this.total);
    if (choice) this.shutTiles(choice);
  }
}

export const shutTheBoxGame: BonusGameDefinition<ShutTheBox, ShutTheBoxBoardConfig> = {
  id: 'shut-the-box',
  options: SHUT_THE_BOX_OPTIONS,
  create: (settings: Settings, random: Random) => new ShutTheBox({
    tiles: Number(choiceOf(settings, TILES_OPTION)),
    vs: choiceOf(settings, PLAYERS_OPTION) === 'ai',
    oneDie: isOn(settings, ONE_DIE_OPTION),
    random,
  }),
  board: {
    create: (el, config, onSelect) => new ShutTheBoxBoardComponent(el, config, onSelect),
    config: (game) => ({
      tiles: game.shut.player.map((shut, i) => ({
        state: shut ? 'shut' as const : game.selected.includes(i + 1) ? 'selected' as const : 'open' as const,
        disabled: !game.canToggle(i + 1),
      })),
      opponent: game.vs ? [...game.shut.ai] : null,
      turn: game.turn,
      dice: [...game.dice],
      total: game.phase === 'pick' ? game.total : null,
      selectedSum: game.selectedSum,
      canRoll: game.canRoll,
      // null: the option is off, no single-die button.
      canRollOne: game.oneDie ? game.canRoll && game.canRollOne() : null,
      cursor: game.cursor,
    }),
  },
  // A tally, and the lowest score of any round, per tile count, players and dice rule.
  results: {
    kind: 'tally',
    key: (settings) => `${choiceOf(settings, TILES_OPTION)}-${choiceOf(settings, PLAYERS_OPTION)}-${choiceOf(settings, ONE_DIE_OPTION)}`,
    // Solo rounds are won or lost.
    draws: (settings) => choiceOf(settings, PLAYERS_OPTION) === 'ai',
    best: { label: 'Lowest score', score: (game) => game.playerScore, everyRound: true },
  },
};
