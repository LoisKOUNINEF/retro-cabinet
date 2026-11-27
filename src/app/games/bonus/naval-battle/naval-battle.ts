import { NavalBattleBoardComponent, type NavalBattleBoardConfig } from '../../../components/naval-battle-board/naval-battle-board.component.js';
import type { Stat } from '../../../components/stats/stat/stat.component.js';
import type { TallyResult } from '../../../services/persistence/persistence.service.js';
import { ARROW_DIRECTIONS, choiceOf, type GameOption, type Random, type Settings, ARROW_CODES, PICK_CODES, type KeyHint } from '../../game.js';
import type { BonusGame, BonusGameDefinition } from '../bonus-game.js';
import { AI_DELAY_MS, DIFFICULTY_OPTION, FIRST_OPTION, type Difficulty } from '../turns.js';
import { chooseShot } from './ai.js';
import { FLEET, GRID, Waters, fit, randomFleet, shipCells, shipType, type Ship, type ShipType, type ShotResult } from './fleet.js';

export const TURNS_OPTION: GameOption<'one' | 'again'> = {
  key: 'turns',
  label: 'Turns',
  choices: [{ value: 'one', label: 'One shot each' }, { value: 'again', label: 'Hit = shoot again' }],
};

export const SHIPS_OPTION: GameOption<'touch' | 'apart'> = {
  key: 'ships',
  label: 'Ships',
  choices: [{ value: 'touch', label: 'May touch' }, { value: 'apart', label: "Can't touch" }],
};

export const NAVAL_BATTLE_OPTIONS: GameOption[] = [DIFFICULTY_OPTION, { ...FIRST_OPTION, label: 'First shot', choices: [{ value: 'you', label: 'You' }, { value: 'ai', label: 'Enemy' }] }, TURNS_OPTION, SHIPS_OPTION];

// Between the AI's shots when a hit lets it shoot again.
export const CHAIN_DELAY_MS = 300;

export type Phase = 'placing' | 'battle';
export type Side = 'player' | 'ai';

export interface NavalBattleOptions {
  difficulty: Difficulty;
  aiFirst: boolean;
  // A hit gives another shot.
  hitAgain: boolean;
  // Ships may touch, sides and corners; off, as on paper, an empty cell around each.
  touching: boolean;
  random: Random;
}

const MIDDLE = (GRID / 2 - 1) * GRID + GRID / 2 - 1;

// A round against the AI: place your fleet, then shoot in turns at the AI's waters while it
// shoots at yours. Sink all five of its ships first.
export class NavalBattle implements BonusGame {
  readonly keyHints: KeyHint[] = [
    { action: 'Move', codes: ARROW_CODES },
    { action: 'Place a ship, fire', codes: PICK_CODES },
    { action: 'Turn a ship', codes: ['KeyR'] },
  ];
  phase: Phase = 'placing';
  // The player's ships while placing them.
  placed: Ship[] = [];
  horizontal = true;
  // On the player's grid while placing, on the AI's during the battle.
  cursor = MIDDLE;
  turn: Side = 'player';
  // The AI's fleet, and the player's once the battle starts.
  readonly enemy: Waters;
  player: Waters | null = null;
  // The last shot of each side, for the board and the status line.
  lastShot: { side: Side; cell: number; result: ShotResult } | null = null;
  private _aiWait: number | null = null;

  constructor(private readonly options: NavalBattleOptions) {
    this.enemy = new Waters(randomFleet(options.random, options.touching));
  }

  get touching(): boolean {
    return this.options.touching;
  }

  // The next ship to place, if any.
  get nextShip(): ShipType | null {
    return FLEET.find(({ id }) => !this.placed.some((ship) => ship.id === id)) ?? null;
  }

  // The next ship's cells under the cursor while placing (cut short at the grid's edge), and whether it fits.
  get preview(): { cells: number[]; fits: boolean } | null {
    const next = this.nextShip;
    if (this.phase !== 'placing' || !next) return null;
    const placement = { start: this.cursor, horizontal: this.horizontal };
    const cells = shipCells(next.size, placement) ?? this.clipped(next.size);
    return { cells, fits: fit(this.placed, next.size, placement, this.touching) !== null };
  }

  get isOver(): boolean {
    return this.outcome !== null;
  }

  get outcome(): TallyResult | null {
    if (this.enemy.allSunk) return 'wins';
    return this.player?.allSunk ? 'losses' : null;
  }

  // Whether the player can't act on the board: the AI's turn, or the round over.
  get locked(): boolean {
    return this.isOver || (this.phase === 'battle' && this.turn !== 'player');
  }

  get playerShots(): number {
    return this.enemy.shotCount;
  }

  get status(): string {
    const again = ' Press Enter or New round to play again.';
    if (this.outcome === 'wins') return `You sank their fleet in ${this.playerShots} shots!${again}`;
    if (this.outcome === 'losses') return `The enemy sank your fleet.${again}`;
    if (this.phase === 'placing') {
      const next = this.nextShip;
      if (!next) return 'Fleet ready: press Start (or Enter).';
      return `Place your ${next.name} (${next.size}): click a cell, R or the mouse wheel to rotate.`;
    }
    const last = this.lastShot;
    const told = last ? `${this.describe(last.side, last.result)} ` : '';
    return `${told}${this.turn === 'player' ? 'Your shot.' : 'Thinking…'}`;
  }

  nextTickIn(): number | null {
    return this._aiWait;
  }

  tick(dt: number): void {
    if (this._aiWait === null) return;
    this._aiWait -= dt;
    if (this._aiWait > 0) return;
    this._aiWait = null;
    this.aiShoots();
  }

  // place: lay the next ship there, or pick up the ship there; aim: move the cursor;
  // rotate, random, clear, start: the fleet panel's buttons; fire: shoot at the AI's waters.
  select(index: number, action = 'fire'): void {
    if (this.isOver) return;
    if (this.phase === 'placing') {
      switch (action) {
        case 'place': return this.place(index);
        case 'aim': return void (this.cursor = index);
        case 'rotate': return void (this.horizontal = !this.horizontal);
        case 'random': return this.randomize();
        case 'clear': return void (this.placed = []);
        case 'start': return this.start();
        default: return;
      }
    }
    if (action === 'aim') this.cursor = index;
    if (action === 'fire') this.fire(index);
  }

  // Arrows move the cursor; Enter or Space places (or starts, with the fleet ready) and fires; R rotates.
  handleKey(code: string): boolean {
    if (code === 'Enter' || code === 'Space') {
      if (this.phase === 'battle') this.fire(this.cursor);
      else if (this.nextShip) this.place(this.cursor);
      else this.start();
      return true;
    }
    if (code === 'KeyR' && this.phase === 'placing') {
      this.horizontal = !this.horizontal;
      return true;
    }
    const direction = ARROW_DIRECTIONS[code];
    if (!direction) return false;
    const row = Math.min(Math.max(Math.floor(this.cursor / GRID) + direction.y, 0), GRID - 1);
    const column = Math.min(Math.max((this.cursor % GRID) + direction.x, 0), GRID - 1);
    this.cursor = row * GRID + column;
    return true;
  }

  stats(): Stat[] {
    return [
      { key: 'yours', label: 'Your ships', value: this.player?.shipsLeft ?? FLEET.length },
      { key: 'theirs', label: 'Enemy ships', value: this.enemy.shipsLeft },
      { key: 'shots', label: 'Shots', value: this.playerShots },
    ];
  }

  private describe(side: Side, { result, ship }: ShotResult): string {
    if (result === 'miss') return side === 'player' ? 'Miss.' : 'The enemy missed.';
    if (result === 'hit') return side === 'player' ? 'Hit!' : 'The enemy hit your ship!';
    const name = shipType(ship!.id).name;
    return side === 'player' ? `You sank their ${name}!` : `The enemy sank your ${name}.`;
  }

  // A ship running off the grid, for the preview: the cells inside it.
  private clipped(size: number): number[] {
    const step = this.horizontal ? 1 : GRID;
    const row = Math.floor(this.cursor / GRID);
    return Array.from({ length: size }, (_, i) => this.cursor + i * step)
      .filter((cell) => cell < GRID * GRID && (!this.horizontal || Math.floor(cell / GRID) === row));
  }

  private place(index: number): void {
    this.cursor = index;
    const taken = this.placed.find((ship) => ship.cells.includes(index));
    if (taken) {
      // Picked up: it's the next one to place, the way it lay.
      this.placed = this.placed.filter((ship) => ship !== taken);
      this.horizontal = taken.cells.length < 2 || taken.cells[1]! - taken.cells[0]! === 1;
      return;
    }
    const next = this.nextShip;
    if (!next) return;
    const cells = fit(this.placed, next.size, { start: index, horizontal: this.horizontal }, this.touching);
    if (cells) this.placed = [...this.placed, { id: next.id, cells }];
  }

  // Lays the ships left at random; with the fleet already complete, a whole new layout.
  private randomize(): void {
    const { random } = this.options;
    this.placed = this.nextShip ? randomFleet(random, this.touching, this.placed) : randomFleet(random, this.touching);
  }

  private start(): void {
    if (this.nextShip) return;
    this.phase = 'battle';
    this.player = new Waters(this.placed);
    this.cursor = MIDDLE;
    if (this.options.aiFirst) {
      this.turn = 'ai';
      this._aiWait = AI_DELAY_MS;
    }
  }

  private fire(index: number): void {
    if (this.phase !== 'battle' || this.locked) return;
    this.cursor = index;
    const result = this.enemy.fire(index);
    if (!result) return;
    this.lastShot = { side: 'player', cell: index, result };
    if (this.isOver || (this.options.hitAgain && result.result !== 'miss')) return;
    this.turn = 'ai';
    this._aiWait = AI_DELAY_MS;
  }

  private aiShoots(): void {
    const player = this.player!;
    const sight = {
      shots: player.shots,
      sunk: player.sunk,
      afloat: player.ships.filter((ship) => !player.isSunk(ship)).map(({ id }) => shipType(id).size),
      touching: this.touching,
    };
    const cell = chooseShot(sight, this.options.difficulty, this.options.random);
    const result = player.fire(cell)!;
    this.lastShot = { side: 'ai', cell, result };
    if (this.isOver) return;
    if (this.options.hitAgain && result.result !== 'miss') {
      this._aiWait = CHAIN_DELAY_MS;
      return;
    }
    this.turn = 'player';
  }
}

export const navalBattleGame: BonusGameDefinition<NavalBattle, NavalBattleBoardConfig> = {
  id: 'naval-battle',
  options: NAVAL_BATTLE_OPTIONS,
  create: (settings: Settings, random: Random) => new NavalBattle({
    difficulty: choiceOf(settings, DIFFICULTY_OPTION),
    aiFirst: choiceOf(settings, FIRST_OPTION) === 'ai',
    hitAgain: choiceOf(settings, TURNS_OPTION) === 'again',
    touching: choiceOf(settings, SHIPS_OPTION) === 'touch',
    random,
  }),
  board: {
    create: (el, config, onSelect) => new NavalBattleBoardComponent(el, config, onSelect),
    config: (game) => ({
      phase: game.phase,
      ownShips: game.player?.ships ?? game.placed,
      // Copies: the board compares them with the last ones shown.
      ownShots: [...(game.player?.shots ?? [])],
      // The AI's ships the player may see: sunk ones, and all of them once the round is lost.
      enemyShips: game.outcome === 'losses' ? game.enemy.ships : game.enemy.sunk,
      enemyShots: [...game.enemy.shots],
      preview: game.preview,
      lastShot: game.lastShot ? { side: game.lastShot.side, cell: game.lastShot.cell } : null,
      cursor: game.cursor,
      locked: game.locked,
    }),
  },
  // A tally (and the fewest shots) per difficulty and turn rule.
  results: {
    kind: 'tally',
    key: (settings) => `${choiceOf(settings, DIFFICULTY_OPTION)}-${choiceOf(settings, TURNS_OPTION)}`,
    draws: false,
    best: { label: 'Fewest shots', score: (game) => game.playerShots },
  },
};
