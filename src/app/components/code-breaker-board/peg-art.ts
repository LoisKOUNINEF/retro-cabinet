import { HOLE, KEY_EXACT, KEY_MISPLACED, KEY_NONE, PEGS } from '../../games/bonus/code-breaker/pegs.js';
import { pixelArt } from '../pixel-art.js';

// A peg in its colour (code-breaker__peg--<id>), or an unfilled hole.
export const pegArt = (peg: number | null) => {
  const found = peg === null ? undefined : PEGS[peg];
  return found
    ? pixelArt(found.sprite, `code-breaker__peg code-breaker__peg--${found.id}`)
    : pixelArt(HOLE, 'code-breaker__peg code-breaker__peg--hole');
};

// A guess's feedback, as small pegs: filled ones first (in place), then hollow ones (misplaced), then dots.
export const keyArt = (pegs: number, exact: number, misplaced: number) => Array.from({ length: pegs }, (_, i) => {
  if (i < exact) return pixelArt(KEY_EXACT, 'code-breaker__key-peg code-breaker__key-peg--exact');
  if (i < exact + misplaced) return pixelArt(KEY_MISPLACED, 'code-breaker__key-peg code-breaker__key-peg--misplaced');
  return pixelArt(KEY_NONE, 'code-breaker__key-peg');
});
