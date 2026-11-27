import { html, nutinFor } from '../../core/index.js';
import type { Sprite } from '../games/sprites.js';

// Each lit pixel as a 1×1 square of the sprite's grid.
export function iconPixels(icon: Sprite): { x: number; y: number }[] {
  return icon.flatMap((row, y) => [...row].flatMap((pixel, x) => (pixel === '#' ? [{ x, y }] : [])));
}

// Pixel art as an inline SVG, one square per lit pixel, filled with the text colour (CSS `fill`).
// Decorative: the element carrying it gives the name.
export const pixelArt = (icon: Sprite, className: string) => html`
  <svg class="${className}" viewBox="0 0 ${icon[0]?.length ?? 0} ${icon.length}" aria-hidden="true" shape-rendering="crispEdges">
    ${nutinFor(iconPixels(icon), ({ x, y }) => html`<rect x="${x}" y="${y}" width="1" height="1"></rect>`)}
  </svg>`;
