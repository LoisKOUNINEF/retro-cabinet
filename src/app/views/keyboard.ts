// A key a focused control handles itself, which a view's own shortcuts must leave alone:
// any key on a select (choosing an option), or Space/Enter on a button (its click,
// e.g. the play/pause toggle: handling it here too would toggle twice).
export function isControlKey(event: KeyboardEvent): boolean {
  if (event.target instanceof HTMLSelectElement) return true;
  const activates = event.code === 'Space' || event.code === 'Enter';
  return activates && event.target instanceof HTMLButtonElement;
}
