import { ShutTheBoxBoardComponent } from '#root/dist/src/app/components/shut-the-box-board/shut-the-box-board.component.js';

const tiles = (count = 9, overrides = {}) => Array.from({ length: count }, (_, i) => ({ state: 'open', disabled: true, ...overrides[i + 1] }));
const config = (overrides = {}) => ({
  tiles: tiles(),
  opponent: null,
  turn: 'player',
  dice: [],
  total: null,
  selectedSum: 0,
  canRoll: true,
  canRollOne: null,
  cursor: 0,
  ...overrides,
});
const tile = (index) => $(`.shut-the-box__tile-button[data-index="${index}"]`);
const rollButtons = () => $$('.shut-the-box__roll');

describe('ShutTheBoxBoardComponent', () => {
  let host;
  let board;
  let picks;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    picks = [];
    board = new ShutTheBoxBoardComponent(host, config(), (index, action) => picks.push([index, action]));
    board.render();
  });

  afterEach(() => {
    board.destroy();
    host.remove();
  });

  it('shows the tiles, numbered, the dice not rolled yet, and Roll', () => {
    expect($$('.shut-the-box__tile-button').map((button) => button.textContent)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
    expect(tile(6).getAttribute('aria-label')).toBe('Tile 7: open');
    expect(tile(0).classList.contains('shut-the-box__tile--cursor')).toBeTruthy();
    expect($$('.shut-the-box__die--unknown').length).toBe(2);
    expect(rollButtons().length).toBe(1);
    expect($('.shut-the-box__box--opponent')).toBe(null);
    expect($('.shut-the-box').classList.contains('shut-the-box--tiles-9')).toBeTruthy();
  });

  it('rolls two dice, or one with the single-die rule', () => {
    rollButtons()[0].click();
    board.update(config({ canRollOne: true }));
    rollButtons()[1].click();
    expect(picks).toEqual([[2, 'roll'], [1, 'roll']]);

    board.update(config({ canRoll: false, canRollOne: false }));
    expect(rollButtons().every((button) => button.disabled)).toBeTruthy();
  });

  it('shakes the dice while they roll, then shows their faces and the total to shut', () => {
    board.update(config({ dice: [0, 0], canRoll: false }));
    expect($$('.shut-the-box__die--rolling').length).toBe(2);
    expect($('.shut-the-box__dice').getAttribute('aria-label')).toBe('Dice rolling');

    board.update(config({ dice: [3, 5], total: 8, selectedSum: 3, canRoll: false, tiles: tiles(9, { 3: { state: 'selected', disabled: false }, 5: { state: 'open', disabled: false } }) }));
    expect($$('.shut-the-box__die--rolling').length).toBe(0);
    expect($('.shut-the-box__dice').getAttribute('aria-label')).toBe('Dice: 3 and 5');
    expect($('.shut-the-box__total').textContent).toBe('3 / 8');
    expect(tile(2).getAttribute('aria-pressed')).toBe('true');
    expect(tile(2).getAttribute('aria-label')).toBe('Tile 3: picked');
    expect(tile(4).disabled).toBe(false);
    expect(tile(0).disabled).toBe(true);
    tile(4).click();
    expect(picks).toEqual([[4, 'tile']]);
  });

  it('only rebuilds the tiles that changed', () => {
    const untouched = tile(8);
    board.update(config({ tiles: tiles(9, { 1: { state: 'shut', disabled: true } }) }));
    expect(tile(8)).toBe(untouched);
    expect(tile(0).classList.contains('shut-the-box__tile--shut')).toBeTruthy();
    expect(tile(0).getAttribute('aria-label')).toBe('Tile 1: shut');
  });

  it('shows the opponent\'s box against the AI, its open tiles read as one label', () => {
    board.update(config({ opponent: [true, false, false, true, true, true, true, true, true], turn: 'ai', canRoll: false }));
    expect($('.shut-the-box__box--opponent').classList.contains('shut-the-box__box--playing')).toBeTruthy();
    expect($('.shut-the-box__box--opponent [role="img"]').getAttribute('aria-label')).toBe('Opponent\'s open tiles: 2, 3');
    expect($$('.shut-the-box__box--opponent .shut-the-box__tile--shut').length).toBe(7);
    expect($$('.shut-the-box__who').map((who) => who.textContent)).toEqual(['OpponentOpp.', 'You']);
    expect($('.shut-the-box__who-long').textContent).toBe('Opponent');
    expect($('.shut-the-box__who-short').textContent).toBe('Opp.');
  });

  it('moves the focus from Roll, once pressed, to the first tile to pick', () => {
    rollButtons()[0].focus();
    board.update(config({ dice: [0, 0], canRoll: false }));
    expect(document.activeElement).toBe(document.body);
    board.update(config({ dice: [1, 2], total: 3, canRoll: false, tiles: tiles(9, { 3: { state: 'open', disabled: false } }) }));
    tile(2).focus();
    board.update(config({ dice: [1, 2], canRoll: true, tiles: tiles(9, { 3: { state: 'shut', disabled: true } }) }));
    expect(document.activeElement).toBe(rollButtons()[0]);
  });
});
