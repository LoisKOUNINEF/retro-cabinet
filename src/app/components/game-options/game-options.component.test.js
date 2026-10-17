import { GameOptionsComponent } from '#root/dist/src/app/components/game-options/game-options.component.js';

const OPTIONS = [
  { key: 'speed', label: 'Speed', choices: [{ value: 'slow', label: 'Slow' }, { value: 'fast', label: 'Fast' }] },
  { key: 'walls', label: 'Walls', choices: [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }] },
];

describe('GameOptionsComponent', () => {
  let host;
  let component;
  let changes;
  const onChange = (key, value) => changes.push([key, value]);
  const config = (settings, locked = false) => ({ options: OPTIONS, settings, locked, onChange });

  beforeEach(() => {
    changes = [];
    host = document.createElement('div');
    document.body.append(host);
    component = new GameOptionsComponent(host, config({ speed: 'fast', walls: 'on' }));
    component.render();
  });

  afterEach(() => {
    component.destroy();
    host.remove();
  });

  it('shows one select per option, on its chosen value, in a box titled by its legend', () => {
    expect($('fieldset.game__options > legend').textContent).toBe('⚙ Options');
    expect($('select[data-option="speed"]').value).toBe('fast');
    expect($('select[data-option="walls"]').value).toBe('on');
  });

  it('reports a change with its option key', () => {
    const select = $('select[data-option="walls"]');
    select.value = 'off';
    select.dispatchEvent(new window.Event('change', { bubbles: true }));

    expect(changes).toEqual([['walls', 'off']]);
  });

  it('locks the whole box, keeping its selects', () => {
    const select = $('select[data-option="speed"]');

    component.update(config({ speed: 'fast', walls: 'on' }, true));

    expect($('fieldset.game__options').disabled).toBeTruthy();
    expect($('select[data-option="speed"]')).toBe(select);
  });

  it('rebuilds only the select whose value changed, keeping the focus on it', () => {
    const walls = $('select[data-option="walls"]');
    $('select[data-option="speed"]').focus();

    component.update(config({ speed: 'slow', walls: 'on' }));

    expect($('select[data-option="speed"]').value).toBe('slow');
    expect($('select[data-option="walls"]')).toBe(walls);
    expect(document.activeElement).toBe($('select[data-option="speed"]'));
  });
});
