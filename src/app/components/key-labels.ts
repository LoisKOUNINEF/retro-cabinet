import type { KeyHint } from '../games/game.js';

// What to show for a key code in the HUD. Games listen to physical keys (KeyboardEvent.code),
// so the label depends on the player's layout: 'KeyZ' reads Z on QWERTY but W on AZERTY.
// Without the layout (Firefox, Safari), the code's own letter is shown.

const ARROWS: Record<string, string> = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' };

// The Keyboard Map API (Chromium only) isn't in TypeScript's DOM types.
interface KeyboardLayoutApi {
  getLayoutMap(): Promise<Map<string, string>>;
}

let layoutMap: Promise<Map<string, string> | null> | null = null;

function readLayoutMap(): Promise<Map<string, string> | null> {
  layoutMap ??= (async () => {
    try {
      const keyboard = (navigator as Navigator & { keyboard?: KeyboardLayoutApi }).keyboard;
      return (await keyboard?.getLayoutMap()) ?? null;
    } catch {
      return null;
    }
  })();
  return layoutMap;
}

export async function keyLabel(code: string): Promise<string> {
  const arrow = ARROWS[code];
  if (arrow) return arrow;
  const key = (await readLayoutMap())?.get(code);
  if (key) return key.toUpperCase();
  return code.replace(/^Key|^Digit/, '');
}

// ["Move: ← →", "Fire: ↑, Z or W"], one line per key hint of a game.
export async function describeKeys(hints: KeyHint[]): Promise<string[]> {
  return Promise.all(hints.map(async (hint) => {
    if ('keys' in hint) return `${hint.action}: ${hint.keys}`;
    const { action, codes } = hint;
    const labels = await Promise.all(codes.map(keyLabel));
    if (codes.every((code) => code in ARROWS)) return `${action}: ${labels.join(' ')}`;
    return `${action}: ${alternatives(labels)}`;
  }));
}

// ['↑', 'Z', 'W'] → '↑, Z or W'.
function alternatives(labels: string[]): string {
  if (labels.length < 2) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]}`;
}

// Tests only: forget the cached layout.
export function resetKeyLabels(): void {
  layoutMap = null;
}
