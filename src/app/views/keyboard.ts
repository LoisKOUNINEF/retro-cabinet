export function isControlKey(event: KeyboardEvent): boolean {
  if (event.target instanceof Element && event.target.closest('[role="menu"]')) return true;
  if (event.target instanceof HTMLSelectElement) return true;
  const activates = event.code === 'Space' || event.code === 'Enter';
  return activates && event.target instanceof HTMLButtonElement;
}
