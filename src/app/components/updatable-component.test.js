import { UpdatableComponent } from '#root/dist/src/app/components/updatable-component.js';
import { html } from '#root/dist/src/core/index.js';

// Counts its renders; two buttons to test where the focus goes.
class Counter extends UpdatableComponent {
  constructor(host, config) {
    super({
      mountTarget: host,
      config,
      templateFn: (c) => html`<div>
        <button data-focus-key="a">A</button>
        <button data-focus-key="b" ${c.disableB ? 'disabled' : ''}>B</button>
      </div>`,
    });
    this.renders = 0;
  }

  onAfterRender() {
    super.onAfterRender();
    this.renders += 1;
  }

  fallbackFocus() {
    return this.element.querySelector('[data-focus-key="a"]');
  }
}

describe('UpdatableComponent', () => {
  let host;
  let counter;
  const onSelect = () => {};
  const base = () => ({ cells: [{ id: 1, tags: ['x'] }], preview: { cells: [4, 5], fits: true }, onSelect });

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    counter = new Counter(host, base());
    counter.render();
  });

  afterEach(() => {
    counter.destroy();
    host.remove();
  });

  it('skips an equal config rebuilt from scratch, nested arrays and objects included', () => {
    counter.update(base());
    expect(counter.renders).toBe(1);
  });

  it('re-renders when a nested value changes, in an array or in an object', () => {
    counter.update({ ...base(), cells: [{ id: 1, tags: ['y'] }] });
    expect(counter.renders).toBe(2);
    counter.update({ ...base(), cells: [{ id: 1, tags: ['y'] }], preview: { cells: [4, 5], fits: false } });
    expect(counter.renders).toBe(3);
  });

  it('compares callbacks by reference', () => {
    counter.update({ ...base(), onSelect: () => {} });
    expect(counter.renders).toBe(2);
  });

  it('tells apart different keys with the same count, and an array from an object', () => {
    // The same nested references throughout: only the keys differ.
    const same = base();
    counter.update({ ...same, before: undefined });
    expect(counter.renders).toBe(2);
    counter.update({ ...same, after: undefined });
    expect(counter.renders).toBe(3);
    counter.update({ ...same, after: undefined, cells: { 0: same.cells[0] } });
    expect(counter.renders).toBe(4);
  });

  it('compares class instances by reference', () => {
    class Point { constructor(x) { this.x = x; } }
    const point = new Point(1);
    counter.update({ ...base(), point });
    counter.update({ ...base(), point });
    expect(counter.renders).toBe(2);
    counter.update({ ...base(), point: new Point(1) });
    expect(counter.renders).toBe(3);
  });

  it('keeps the focus on the same control across a re-render, or falls back', () => {
    $('[data-focus-key="b"]').focus();
    counter.update({ ...base(), preview: null });
    expect(document.activeElement).toBe($('[data-focus-key="b"]'));

    counter.update({ ...base(), preview: null, disableB: true });
    expect(document.activeElement).toBe($('[data-focus-key="a"]'));
  });
});
