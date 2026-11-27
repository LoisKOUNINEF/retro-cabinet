import type { PopoverElement } from 'a11y-elements/overlays/popover/element';

// A list of lines (a game's rules, its controls) in a popover that a button opens and closes.
// Built as DOM rather than a template: overlays move to <body>, out of reach of data-event.
// The popover is appended to <body>: the owner calls remove() (e.g. in onBeforeDestroy).
export class ListPopover {
  private readonly _popover: PopoverElement;
  private _lines: string[] = [];

  // button: the current render's button, which the popover is anchored to and keeps up to date.
  constructor(id: string, label: string, private readonly button: () => HTMLElement | null) {
    // Loaded on first use. Until it's defined, the element stays hidden (a11y.css).
    import('a11y-elements/overlays/popover').catch(() => {});
    this._popover = document.createElement('a11y-popover') as PopoverElement;
    this._popover.id = id;
    this._popover.setAttribute('label', label);
    this._popover.setAttribute('placement', 'bottom-start');
    // Escape or a click outside closes it too: the button follows.
    this._popover.addEventListener('a11y-overlay-open', this.syncButton);
    this._popover.addEventListener('a11y-overlay-close', this.syncButton);
    document.body.append(this._popover);
  }

  get id(): string {
    return this._popover.id;
  }

  get open(): boolean {
    return this._popover.open;
  }

  get lines(): string[] {
    return this._lines;
  }

  // One <li> per line.
  set lines(lines: string[]) {
    this._lines = lines;
    const list = document.createElement('ul');
    list.className = 'list-popover__list';
    list.append(...lines.map((line) => {
      const item = document.createElement('li');
      item.textContent = line;
      return item;
    }));
    this._popover.replaceChildren(list);
  }

  toggle(): void {
    this.setOpen(!this.open);
  }

  close(): void {
    if (this.open) this.setOpen(false);
  }

  // After each render: the button is a new element.
  anchor(): void {
    this._popover.anchorElement = this.button();
  }

  remove(): void {
    this._popover.remove();
  }

  private setOpen(open: boolean): void {
    this._popover.open = open;
    this.syncButton();
  }

  private readonly syncButton = (): void => {
    this.button()?.setAttribute('aria-expanded', String(this.open));
  };
}
