import { StatsComponent } from '#root/dist/src/app/components/stats/stats.component.js';

const stats = (score, level = 1) => ({
  items: [{ key: 'score', label: 'Score', value: score }, { key: 'level', label: 'Level', value: level }],
});

describe('StatsComponent', () => {
  let host;
  let component;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    component = new StatsComponent(host, stats(0));
    component.render();
  });

  afterEach(() => {
    component.destroy();
    host.remove();
  });

  it('shows each label with its value', () => {
    expect($$('.game__stat-label').map((label) => label.textContent)).toEqual(['Score', 'Level']);
    expect($('[data-stat="score"]').textContent).toBe('0');
    expect($('[data-stat="level"]').textContent).toBe('1');
  });

  it('rebuilds only the values that changed', () => {
    const list = $('.game__stats');
    const level = $('[data-stat="level"]');

    component.update(stats(40));

    expect($('[data-stat="score"]').textContent).toBe('40');
    expect($('[data-stat="level"]')).toBe(level);
    expect($('.game__stats')).not.toBe(list);
  });

  it('leaves its DOM alone when nothing changed', () => {
    const list = $('.game__stats');

    component.update(stats(0));

    expect($('.game__stats')).toBe(list);
  });
});
