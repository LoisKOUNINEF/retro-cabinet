import { ICONS } from '../../icons.js';
import { CANNON, ALIEN_SPRITES, UFO } from '../../alien-attack/sprites.js';
import type { Sprite } from '../../sprites.js';

export interface Face {
  // Read out for a turned card.
  name: string;
  sprite: Sprite;
}

// The cards' pictures: the cabinet's pixel art, enough for the biggest deck's 12 pairs and then some.
export const FACES: readonly Face[] = [
  { name: 'Falling Blocks', sprite: ICONS['falling-blocks'] },
  { name: 'Maze Chase', sprite: ICONS['maze-chase'] },
  { name: 'Crab alien', sprite: ICONS['alien-attack'] },
  { name: 'Snake', sprite: ICONS.snake },
  { name: 'Brick Breaker', sprite: ICONS['brick-breaker'] },
  { name: 'Space Rocks', sprite: ICONS['space-rocks'] },
  { name: 'Jewel Drop', sprite: ICONS['jewel-drop'] },
  { name: 'Frog Crossing', sprite: ICONS['frog-crossing'] },
  { name: 'Table Tennis', sprite: ICONS['table-tennis'] },
  { name: 'Squid alien', sprite: ALIEN_SPRITES.squid[0] },
  { name: 'Octopus alien', sprite: ALIEN_SPRITES.octopus[0] },
  { name: 'UFO', sprite: UFO },
  { name: 'Laser cannon', sprite: CANNON },
];
