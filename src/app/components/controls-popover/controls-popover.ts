import type { PopoverElement } from 'a11y-elements/overlays/popover/element';

// The Play section's controls list, opened by its Controls button.
// Built as DOM rather than a template: overlays move to <body>, out of reach of data-event.
// Appended to <body>: the caller removes it (e.g. in onBeforeDestroy).
export function createControlsPopover(id: string): PopoverElement {
  // Loaded on first use. Until it's defined, the element stays hidden (a11y.css).
  import('a11y-elements/overlays/popover').catch(() => {});
  const popover = document.createElement('a11y-popover') as PopoverElement;
  popover.id = id;
  popover.setAttribute('label', 'Controls');
  popover.setAttribute('placement', 'bottom-start');
  document.body.append(popover);
  return popover;
}

// One control per line, e.g. "Move: ← →", "Fire: ↑, Z or W".
export function setControlsLines(popover: PopoverElement, lines: string[]): void {
  const list = document.createElement('ul');
  list.className = 'controls-popover__list';
  list.append(...lines.map((line) => {
    const item = document.createElement('li');
    item.textContent = line;
    return item;
  }));
  popover.replaceChildren(list);
}
