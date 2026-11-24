import type { GameOption } from '../game.js';

// Options shared by the bonus games played in turns against an AI.
export type Difficulty = 'easy' | 'medium' | 'hard';

// Hard plays its best, except this share of its moves: then it slips.
export const MISTAKE_CHANCE = 0.1;

export const DIFFICULTY_OPTION: GameOption<Difficulty> = {
  key: 'difficulty',
  label: 'Difficulty',
  choices: [{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }],
  defaultValue: 'medium',
};

export const FIRST_OPTION: GameOption<'you' | 'ai'> = {
  key: 'first',
  label: 'First move',
  choices: [{ value: 'you', label: 'You' }, { value: 'ai', label: 'Opponent' }],
};

// The AI "thinks" this long before playing, so its move doesn't feel instant.
export const AI_DELAY_MS = 400;
