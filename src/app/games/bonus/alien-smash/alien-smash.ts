import { AlienSmashBoardComponent, type AlienSmashBoardConfig } from '../../../components/alien-smash-board/alien-smash-board.component.js';
import type { Stat } from '../../../components/stats/stat/stat.component.js';
import { ARROW_DIRECTIONS, choiceOf, levelSpeed, pick, type GameOption, type Random, type Settings, ARROW_CODES, type KeyHint } from '../../game.js';
import type { AlienType } from '../../alien-attack/sprites.js';
import { clickHint, type BonusGame, type BonusGameDefinition } from '../bonus-game.js';

export const TIME_OPTION: GameOption<'15' | '30' | '60'> = {
  key: 'time',
  label: 'Time',
  choices: [{ value: '15', label: '15 s' }, { value: '30', label: '30 s' }, { value: '60', label: '60 s' }],
  defaultValue: '30',
};

export const SPEED_OPTION: GameOption<'slow' | 'normal' | 'fast'> = {
  key: 'speed',
  label: 'Speed',
  choices: [{ value: 'slow', label: 'Slow' }, { value: 'normal', label: 'Normal' }, { value: 'fast', label: 'Fast' }],
  defaultValue: 'normal',
};

export const ALIEN_SMASH_OPTIONS: GameOption[] = [TIME_OPTION, SPEED_OPTION];

export type Speed = typeof SPEED_OPTION.choices[number]['value'];
export type Target = AlienType | 'ufo';

// How long an alien stays up at level 1, per speed; each level is shorter (levelSpeed).
export const STAY_MS: Record<Speed, number> = { slow: 1600, normal: 1150, fast: 800 };
// The next alien pops up after this share of the stay time (give or take), so several can be up at once.
const GAP_SHARE = 0.6;
// The UFO is rarer, worth more, and quicker to leave.
export const UFO_CHANCE = 0.05;
const UFO_POINTS = [50, 100, 150];
const UFO_STAY_SHARE = 0.7;
// As in Alien Attack.
export const POINTS: Record<AlienType, number> = { squid: 30, crab: 20, octopus: 10 };
// The commoner aliens are worth less: octopus 45%, crab 35%, squid 20%.
const ALIEN_ODDS: [AlienType, number][] = [['octopus', 0.45], ['crab', 0.35], ['squid', 0.2]];
// A level every this many hits.
export const HITS_PER_LEVEL = 10;
// A hit alien shows its explosion this long.
export const HIT_MS = 300;
// A missed alien takes this long to sink back into its hole: it can't be hit any more,
// and the player sees it was missed rather than vanishing.
export const LEAVE_MS = 250;
// The first alien comes up shortly after the start.
const FIRST_POP_MS = 300;
// The clock's step while running.
export const TICK_MS = 50;
const HOLES = 9;
const COLUMNS = 3;

// up: smashable; hit: shows its explosion; leaving: missed, sinking back. Then the hole empties.
export type HoleState = 'up' | 'hit' | 'leaving';

export interface Hole {
  target: Target | null;
  state: HoleState;
  points: number;
  // Time left in its state.
  timeLeft: number;
}

export interface AlienSmashOptions {
  seconds: number;
  speed: Speed;
  random: Random;
}

const emptyHole = (): Hole => ({ target: null, state: 'up', points: 0, timeLeft: 0 });

// The number key for each hole, laid out as on a numpad: 7 8 9 on the top row.
export const HOLE_KEYS = [7, 8, 9, 4, 5, 6, 1, 2, 3];

// A round of Alien Smash: aliens pop out of 9 holes, smash as many as you can
// before the time runs out. Every HITS_PER_LEVEL hits, a level: they stay up for less time.
export class AlienSmash implements BonusGame {
  readonly clickHints = clickHint('an alien.');
  get rules(): string[] {
    return [
      `Goal: smash as many aliens as you can in ${this.options.seconds} seconds.`,
      'Aliens score 10 to 30, the UFO up to 150.',
      'Every 10 hits the level rises: aliens hide sooner.',
    ];
  }

  // The digits follow a numeric keypad: 7 8 9 on the top row.
  readonly keyHints: KeyHint[] = [{ action: 'Aim', codes: ARROW_CODES }, { action: 'Smash', codes: ['Enter'] }, { action: 'Smash a hole', keys: '1 to 9' }];
  readonly holes: Hole[] = Array.from({ length: HOLES }, emptyHole);
  score = 0;
  hits = 0;
  level = 1;
  timeLeft: number;
  cursor = 4;
  private _nextPop = FIRST_POP_MS;

  constructor(private readonly options: AlienSmashOptions) {
    this.timeLeft = options.seconds * 1000;
  }

  get isOver(): boolean {
    return this.timeLeft <= 0;
  }

  get status(): string {
    if (this.isOver) return `Time's up! ${this.score} points.`;
    return 'Smash the aliens! Keys 1 to 9 hit the holes, as on a numpad.';
  }

  // How long an alien stays up at the current level.
  get stay(): number {
    return levelSpeed(STAY_MS[this.options.speed], this.level);
  }

  nextTickIn(): number | null {
    return this.isOver ? null : TICK_MS;
  }

  tick(dt: number): void {
    if (this.isOver) return;
    this.timeLeft = Math.max(this.timeLeft - dt, 0);
    if (this.isOver) {
      // Time's up: everyone goes back down.
      this.holes.forEach((_, i) => (this.holes[i] = emptyHole()));
      return;
    }
    this.holes.forEach((hole, i) => {
      if (!hole.target) return;
      hole.timeLeft -= dt;
      if (hole.timeLeft > 0) return;
      // Missed: it sinks back first; smashed or sunk: the hole empties.
      if (hole.state === 'up') this.holes[i] = { ...hole, state: 'leaving', timeLeft: LEAVE_MS };
      else this.holes[i] = emptyHole();
    });
    this._nextPop -= dt;
    if (this._nextPop <= 0) {
      this.pop();
      // Between 0.6 and 1.4 times the gap: not a steady beat.
      this._nextPop = this.stay * GAP_SHARE * (0.6 + 0.8 * this.options.random());
    }
  }

  select(index: number): void {
    const hole = this.holes[index];
    if (this.isOver || !hole) return;
    this.cursor = index;
    if (!hole.target || hole.state !== 'up') return;
    this.score += hole.points;
    this.hits++;
    if (this.hits % HITS_PER_LEVEL === 0) this.level++;
    this.holes[index] = { ...hole, state: 'hit', timeLeft: HIT_MS };
  }

  // 1–9 smash their hole (numpad layout), arrows aim, Enter smashes the aimed hole.
  handleKey(code: string): boolean {
    const digit = /^(?:Digit|Numpad)([1-9])$/.exec(code);
    if (digit) {
      this.select(HOLE_KEYS.indexOf(Number(digit[1])));
      return true;
    }
    if (code === 'Enter') {
      this.select(this.cursor);
      return true;
    }
    const direction = ARROW_DIRECTIONS[code];
    if (!direction) return false;
    const column = Math.min(Math.max((this.cursor % COLUMNS) + direction.x, 0), COLUMNS - 1);
    const row = Math.min(Math.max(Math.floor(this.cursor / COLUMNS) + direction.y, 0), HOLES / COLUMNS - 1);
    this.cursor = row * COLUMNS + column;
    return true;
  }

  stats(): Stat[] {
    return [
      { key: 'score', label: 'Score', value: this.score },
      { key: 'level', label: 'Level', value: this.level },
      { key: 'time', label: 'Time', value: Math.ceil(this.timeLeft / 1000) },
    ];
  }

  // An alien (or the odd UFO) comes up in an empty hole, if there is one.
  private pop(): void {
    const empty = this.holes.flatMap((hole, i) => (hole.target ? [] : [i]));
    if (!empty.length) return;
    const { random } = this.options;
    const index = pick(empty, random);
    if (random() < UFO_CHANCE) {
      this.holes[index] = { target: 'ufo', state: 'up', points: pick(UFO_POINTS, random), timeLeft: this.stay * UFO_STAY_SHARE };
      return;
    }
    const target = this.alien(random());
    this.holes[index] = { target, state: 'up', points: POINTS[target], timeLeft: this.stay };
  }

  // The alien for a roll in [0, 1), by ALIEN_ODDS.
  private alien(roll: number): AlienType {
    let total = 0;
    for (const [type, odds] of ALIEN_ODDS) {
      total += odds;
      if (roll < total) return type;
    }
    return 'squid';
  }
}

export const alienSmashGame: BonusGameDefinition<AlienSmash, AlienSmashBoardConfig> = {
  id: 'alien-smash',
  options: ALIEN_SMASH_OPTIONS,
  create: (settings: Settings, random: Random) => new AlienSmash({
    seconds: Number(choiceOf(settings, TIME_OPTION)),
    speed: choiceOf(settings, SPEED_OPTION),
    random,
  }),
  board: {
    create: (el, config, onSelect) => new AlienSmashBoardComponent(el, config, onSelect),
    config: (game, active) => ({
      holes: game.holes.map(({ target, state, points }) => ({ target, state, points })),
      cursor: game.cursor,
      active,
    }),
  },
  // A score table per time and speed.
  results: { kind: 'scores', key: (settings) => `${choiceOf(settings, TIME_OPTION)}-${choiceOf(settings, SPEED_OPTION)}` },
  realtime: true,
};
