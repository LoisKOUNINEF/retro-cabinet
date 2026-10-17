import { ScoreTableComponent } from '#root/dist/src/app/components/score-table/score-table.component.js';
import { registerPipes } from '#root/dist/src/core/index.js';

const entry = (score, level) => ({ score, level, date: '2026-10-16T10:00:00.000Z' });

describe('ScoreTableComponent', () => {
  let host;
  let table;

  // Pipes may already be registered by another test file: that only warns.
  beforeAll(() => silenceConsole('warn', () => registerPipes()));

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
  });

  afterEach(() => {
    table.destroy();
    host.remove();
  });

  it('says when there are no scores yet', () => {
    table = new ScoreTableComponent(host, { entries: [], highlight: null });
    table.render();

    expect($('.score-table__empty').textContent).toBe('No scores yet');
    expect($$('.score-table__row').length).toBe(0);
  });

  it('lists each score with the level reached and the date', () => {
    table = new ScoreTableComponent(host, { entries: [entry(300, 4), entry(120, 2)], highlight: null });
    table.render();

    const rows = $$('.score-table__row');
    expect(rows.length).toBe(2);
    expect(rows[0].querySelector('.score-table__rank').textContent).toBe('1.');
    expect(rows[1].querySelector('.score-table__rank').textContent).toBe('2.');
    expect(rows[0].querySelector('.score-table__score').textContent).toBe('300');
    expect(rows[0].querySelector('.score-table__level').textContent).toBe('Lv 4');
    expect(rows[0].querySelector('.score-table__date').textContent).toBe('16/10/26');
    expect($('.score-table__row--new')).toBeFalsy();
  });

  it('highlights a new entry after an update', () => {
    table = new ScoreTableComponent(host, { entries: [entry(300, 4)], highlight: null });
    table.render();

    table.update({ entries: [entry(300, 4), entry(150, 1)], highlight: 1 });

    expect($$('.score-table__row').length).toBe(2);
    expect($('.score-table__row--new .score-table__score').textContent).toBe('150');
  });

  it('keeps the rows a new score leaves in place, and rebuilds the ones it moves', () => {
    table = new ScoreTableComponent(host, { entries: [entry(300, 4), entry(120, 2)], highlight: null });
    table.render();
    const [first, second] = $$('.score-table__row');

    table.update({ entries: [entry(300, 4), entry(200, 3), entry(120, 2)], highlight: 1 });

    const rows = $$('.score-table__row');
    expect(rows[0]).toBe(first);
    expect(rows[2]).not.toBe(second);
    expect(rows.map((row) => row.querySelector('.score-table__rank').textContent)).toEqual(['1.', '2.', '3.']);
  });
});
