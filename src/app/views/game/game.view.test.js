import { GameView } from '#root/dist/src/app/views/game/game.view.js';
import { Snake } from '#root/dist/src/app/games/snake/snake.js';
import { Tetris } from '#root/dist/src/app/games/tetris/tetris.js';
import { pacmanGame } from '#root/dist/src/app/games/pacman/pacman.js';
import { froggerGame } from '#root/dist/src/app/games/frogger/frogger.js';
import { Arkanoid, arkanoidGame } from '#root/dist/src/app/games/arkanoid/arkanoid.js';
import { Invaders } from '#root/dist/src/app/games/invaders/invaders.js';
import { pongGame } from '#root/dist/src/app/games/pong/pong.js';
import { Navigation, registerPipes } from '#root/dist/src/core/index.js';
import { resetKeyLabels } from '#root/dist/src/app/components/key-labels.js';

// A definition that always hands back the given game instance.
const definitionOf = (game) => ({ id: game.id, create: () => game });
// A definition building a fresh, predictable Snake each time (a restored save needs a new game).
const snakeDefinition = { id: 'snake', create: () => new Snake(() => 0) };
const SNAKE_SAVE = 'retro-cabinet:save:snake';

const press = (code) => document.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true }));
const release = (code) => document.dispatchEvent(new KeyboardEvent('keyup', { code }));

// Touch: jsdom lays nothing out, so clientX/Y are offsets from the stick's centre.
const touch = (selector) => (type, { x = 0, y = 0, id = 1 } = {}) =>
  $(selector).dispatchEvent(new window.PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true }));
const stickPush = touch('.touch-controls__stick');
const crossPush = (direction) => touch(`.touch-controls__cross-button--${direction}`);
const actionPush = (type) => touch('.touch-controls__action')(type, { id: 2 });

// A 2D context that only counts what gets drawn (jsdom has no canvas).
const fakeCanvasContext = () => {
  const ctx = { drawn: 0 };
  ['clearRect', 'fillRect', 'beginPath', 'arc', 'fill', 'fillText'].forEach((name) => {
    ctx[name] = () => { ctx.drawn += 1; };
  });
  return ctx;
};

// Snake is 21 wide: (x, y) is cell y * 21 + x.
const snakeCell = (x, y) => $$('.game-board__cell')[y * 21 + x];

describe('GameView', () => {
  let view;

  // The score table's date pipe; another test file may have registered them already.
  beforeAll(() => silenceConsole('warn', () => registerPipes()));

  beforeEach(() => {
    localStorage.clear();
    useFakeTimers();
  });

  afterEach(() => {
    view.onExit();
    view.destroy();
    useRealTimers();
  });

  it('renders the board, HUD and start prompt', () => {
    view = new GameView(definitionOf(new Snake(() => 0)));
    view.render();

    expect($('h1').textContent).toBe('Snake');
    expect(view.documentTitle()).toBe('Snake');
    expect($$('.game-board__cell').length).toBe(21 * 21);
    expect(snakeCell(10, 10).className).toContain('game-board__cell--snake-head-right');
    expect($('[data-stat="score"]').textContent).toBe('0');
    expect($('.game__status').textContent).toBe('Press Space to start');
  });

  it('starts with Space, ticks the game and repaints the board', () => {
    view = new GameView(definitionOf(new Snake(() => 0)));
    view.render();
    view.onEnter();

    press('Space');
    expect($('.game__status').textContent).toBe('Playing - press Space to pause');

    advanceTimersByTime(250);
    expect(snakeCell(11, 10).className).toContain('snake-head-right');
    expect(snakeCell(10, 10).className).toBe('game-board__cell');
  });

  it('forwards keys to the game only while running', () => {
    const game = new Snake(() => 0);
    view = new GameView(definitionOf(game));
    view.render();
    view.onEnter();

    press('ArrowUp');
    expect(game.direction).toEqual({ x: 1, y: 0 });

    press('Space');
    press('ArrowUp');
    expect(game.direction).toEqual({ x: 0, y: -1 });
    // The head only turns once the snake moves that way, on the next tick.
    expect(snakeCell(10, 10).className).toContain('snake-head-right');
  });

  it('pauses on Space and when the window loses focus', () => {
    view = new GameView(definitionOf(new Snake(() => 0)));
    view.render();
    view.onEnter();

    press('Space');
    press('Space');
    expect($('.game__status').textContent).toContain('Paused');

    press('Space');
    window.dispatchEvent(new window.Event('blur'));
    advanceTimersByTime(1000);
    expect(snakeCell(10, 10).className).toContain('snake-head-right');

    press('Space');
    document.dispatchEvent(new window.Event('visibilitychange'));
    expect($('.game__status').textContent).toContain('Paused');
  });

  it('restarts a finished game with Space', () => {
    const game = new Snake(() => 0);
    view = new GameView(definitionOf(game));
    view.render();
    view.onEnter();
    game.body = [{ x: 20, y: 10 }];

    press('Space');
    advanceTimersByTime(250);
    expect($('.game__status').textContent).toContain('Game over');
    expect($('.game__status').classList.contains('game__status--over')).toBeTruthy();
    // Play again does the same: no need for New game.
    expect($('.game__new').hidden).toBeTruthy();

    press('Space');
    expect(game.isOver).toBeFalsy();
    expect(game.head).toEqual({ x: 10, y: 10 });
    expect($('.game__status').classList.contains('game__status--over')).toBeFalsy();
  });

  it('stops listening to the keyboard on exit', () => {
    const game = new Snake(() => 0);
    view = new GameView(definitionOf(game));
    view.render();
    view.onEnter();
    view.onExit();

    press('Space');
    advanceTimersByTime(1000);
    expect(game.head).toEqual({ x: 10, y: 10 });
  });

  it('shows game options, locked while playing', () => {
    view = new GameView(pacmanGame);
    view.render();
    view.onEnter();
    const select = $('select[data-option="maze"]');
    // The box is rebuilt when it locks; its selects are kept.
    const box = () => $('fieldset.game__options');

    expect(select.value).toBe('compact');
    expect(box().querySelector('legend').textContent).toBe('⚙ Options');
    expect(box().disabled).toBeFalsy();
    expect($('[data-stat="lives"]').textContent).toBe('3');

    // The whole box locks while playing, which disables every select in it.
    press('Space');
    expect(box().disabled).toBeTruthy();
    expect($('select[data-option="maze"]')).toBe(select);
    expect(select.matches(':disabled')).toBeTruthy();
    press('Space');
    expect(box().disabled).toBeFalsy();
  });

  it('builds a new game and board when an option changes', () => {
    view = new GameView(pacmanGame);
    view.render();
    view.onEnter();
    expect($$('.game-board__cell').length).toBe(19 * 21);

    const select = $('select[data-option="maze"]');
    select.value = 'arcade';
    select.dispatchEvent(new window.Event('change', { bubbles: true }));

    expect($$('.game-board__cell').length).toBe(28 * 31);
    expect($('select[data-option="maze"]').value).toBe('arcade');
    expect($('.game__status').textContent).toBe('Press Space to start');
  });

  it('adds a stat when an option turns it on', () => {
    view = new GameView(froggerGame);
    view.render();

    expect($$('select[data-option]').length).toBe(3);
    expect($('[data-stat="time"]')).toBeFalsy();

    const select = $('select[data-option="time"]');
    select.value = 'on';
    select.dispatchEvent(new window.Event('change', { bubbles: true }));

    expect($('[data-stat="time"]').textContent).toBe('60');
    expect($('select[data-option="time"]').value).toBe('on');
  });

  it('shows the Tetris preview and lines stat', () => {
    view = new GameView(definitionOf(new Tetris(() => 3 / 7)));
    view.render();

    expect($$('.game__preview .game-board__cell').length).toBe(16);
    // O sits in the middle of the 4×4 preview: row 2, column 2 is cell 5.
    const cells = $$('.game__preview .game-board__cell');
    expect(cells[0].className).not.toContain('tetris-O');
    expect(cells[5].className).toContain('tetris-O');
    expect($('[data-stat="lines"]').textContent).toBe('0');
  });

  it('draws canvas games on a canvas instead of cells', () => {
    const ctx = fakeCanvasContext();
    const getContext = spyOn(window.HTMLCanvasElement.prototype, 'getContext').andReturn(ctx);
    view = new GameView(arkanoidGame);
    view.render();

    expect($('canvas.game-canvas')).toBeTruthy();
    expect($$('.game-board__cell').length).toBe(0);
    expect(ctx.drawn).toBeGreaterThan(0);
    getContext.restore();
  });

  it('leaves the level out of the stats and scores for games without levels', () => {
    const getContext = spyOn(window.HTMLCanvasElement.prototype, 'getContext').andReturn(fakeCanvasContext());
    localStorage.setItem('retro-cabinet:scores:pong', JSON.stringify([{ score: 900, level: 2, date: '2026-10-16T10:00:00.000Z' }]));
    view = new GameView(pongGame);
    view.render();

    expect($('[data-stat="score"]')).toBeTruthy();
    expect($('[data-stat="level"]')).toBeFalsy();
    expect($('.score-table__row .score-table__score').textContent).toBe('900');
    expect($('.score-table__level')).toBeFalsy();
    localStorage.removeItem('retro-cabinet:scores:pong');
    getContext.restore();
  });

  it('forwards held keys to the game and releases them on pause', () => {
    const getContext = spyOn(window.HTMLCanvasElement.prototype, 'getContext').andReturn(fakeCanvasContext());
    const game = new Arkanoid();
    view = new GameView(definitionOf(game));
    view.render();
    view.onEnter();

    press('Space');
    press('ArrowRight');
    advanceTimersByTime(96);
    const moved = game.paddle.x;
    expect(moved).toBeGreaterThan(88);

    release('ArrowRight');
    advanceTimersByTime(96);
    expect(game.paddle.x).toBe(moved);

    // Held while pausing: the key is released, the paddle stays put on resume.
    press('ArrowLeft');
    press('Space');
    press('Space');
    advanceTimersByTime(96);
    expect(game.paddle.x).toBe(moved);
    getContext.restore();
  });

  it('remembers the chosen options for the next visit', () => {
    view = new GameView(pacmanGame);
    view.render();
    const select = $('select[data-option="maze"]');
    select.value = 'arcade';
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
    view.destroy();

    view = new GameView(pacmanGame);
    view.render();

    expect($('select[data-option="maze"]').value).toBe('arcade');
    expect($$('.game-board__cell').length).toBe(28 * 31);
  });

  it('saves on pause and brings the game back paused on the next visit', () => {
    view = new GameView(snakeDefinition);
    view.render();
    view.onEnter();
    press('Space');
    advanceTimersByTime(250);
    press('Space');
    expect(localStorage.getItem(SNAKE_SAVE)).toBeTruthy();
    view.onExit();
    view.destroy();

    view = new GameView(snakeDefinition);
    view.render();
    view.onEnter();

    expect($('.game__status').textContent).toBe('press Space to resume');
    expect($('.game__new').hidden).toBeFalsy();
    expect(snakeCell(11, 10).className).toContain('snake-head-right');

    press('Space');
    expect($('.game__status').textContent).toBe('Playing - press Space to pause');
    advanceTimersByTime(250);
    expect(snakeCell(12, 10).className).toContain('snake-head-right');
  });

  it('saves when the page is left or hidden, but not before the game started', () => {
    view = new GameView(snakeDefinition);
    view.render();
    view.onEnter();

    window.dispatchEvent(new window.Event('blur'));
    expect(localStorage.getItem(SNAKE_SAVE)).toBe(null);

    press('Space');
    window.dispatchEvent(new window.Event('pagehide'));
    expect(localStorage.getItem(SNAKE_SAVE)).toBeTruthy();
  });

  it('records the score on game over and drops the save', () => {
    const game = new Snake(() => 0);
    view = new GameView(definitionOf(game));
    view.render();
    view.onEnter();
    expect($('.score-table__empty')).toBeTruthy();

    press('Space');
    press('Space');
    expect(localStorage.getItem(SNAKE_SAVE)).toBeTruthy();
    game.score = 50;
    game.body = [{ x: 20, y: 10 }];
    press('Space');
    advanceTimersByTime(250);

    expect($('.game__status').textContent).toBe('Game over - New high score!');
    expect($('.score-table__row--new .score-table__score').textContent).toBe('50');
    expect(localStorage.getItem(SNAKE_SAVE)).toBe(null);
  });

  it('starts over with New game, dropping the save', () => {
    view = new GameView(snakeDefinition);
    view.render();
    view.onEnter();
    // Nothing to drop before the first start.
    expect($('.game__new').hidden).toBeTruthy();
    press('Space');
    advanceTimersByTime(250);
    press('Space');
    expect($('.game__new').hidden).toBeFalsy();

    $('.game__new').click();

    expect(localStorage.getItem(SNAKE_SAVE)).toBe(null);
    expect($('.game__status').textContent).toBe('Press Space to start');
    expect($('.game__new').hidden).toBeTruthy();
    expect(snakeCell(10, 10).className).toContain('snake-head-right');
  });

  it('starts a fresh game when the save is corrupt', () => {
    localStorage.setItem(SNAKE_SAVE, JSON.stringify({ version: 1, settings: {}, state: { nope: true }, savedAt: '' }));

    view = new GameView(snakeDefinition);
    view.render();

    expect($('.game__status').textContent).toBe('Press Space to start');
    expect(localStorage.getItem(SNAKE_SAVE)).toBe(null);
  });

  it('plays Snake with the touch stick', () => {
    const game = new Snake(() => 0);
    view = new GameView(definitionOf(game));
    view.render();
    view.onEnter();

    $('.touch-controls__pause').click();
    stickPush('pointerdown', { y: -40 });

    expect(game.direction).toEqual({ x: 0, y: -1 });
  });

  it('holds Arkanoid moves on the D-pad and launches with the action button', () => {
    const getContext = spyOn(window.HTMLCanvasElement.prototype, 'getContext').andReturn(fakeCanvasContext());
    const game = new Arkanoid();
    view = new GameView(definitionOf(game));
    view.render();
    view.onEnter();
    expect($('.touch-controls__action').textContent).toBe('Launch');

    press('Space');
    crossPush('right')('pointerdown');
    advanceTimersByTime(96);
    const moved = game.paddle.x;
    expect(moved).toBeGreaterThan(88);

    crossPush('right')('pointerup');
    advanceTimersByTime(96);
    expect(game.paddle.x).toBe(moved);

    actionPush('pointerdown');
    expect(game.balls[0].stuck).toBeFalsy();
    getContext.restore();
  });

  it('keeps firing in Space Invaders while the action button is held', () => {
    const getContext = spyOn(window.HTMLCanvasElement.prototype, 'getContext').andReturn(fakeCanvasContext());
    const game = new Invaders({ random: () => 0 });
    view = new GameView(definitionOf(game));
    view.render();
    view.onEnter();
    press('Space');

    actionPush('pointerdown');
    expect(game.shotsFired).toBe(1);
    game.shot = null;
    advanceTimersByTime(32);
    expect(game.shotsFired).toBe(2);

    actionPush('pointerup');
    game.shot = null;
    advanceTimersByTime(32);
    expect(game.shotsFired).toBe(2);
    getContext.restore();
  });

  it('lets go of the D-pad when the game pauses', () => {
    const getContext = spyOn(window.HTMLCanvasElement.prototype, 'getContext').andReturn(fakeCanvasContext());
    const game = new Arkanoid();
    view = new GameView(definitionOf(game));
    view.render();
    view.onEnter();

    press('Space');
    crossPush('right')('pointerdown');
    press('Space');
    press('Space');
    const x = game.paddle.x;
    advanceTimersByTime(96);

    expect(game.paddle.x).toBe(x);
    getContext.restore();
  });

  it('keeps sliding a Tetris piece while a D-pad button is held', () => {
    const game = new Tetris(() => 3 / 7);
    view = new GameView(definitionOf(game));
    view.render();
    view.onEnter();
    expect($('.touch-controls__stick')).toBeFalsy();

    $('.touch-controls__pause').click();
    const start = game.piece.x;
    crossPush('left')('pointerdown');
    advanceTimersByTime(240);

    expect(game.piece.x).toBe(start - 3);
  });

  it('ignores clicks on the board', () => {
    view = new GameView(definitionOf(new Snake(() => 0)));
    view.render();
    view.onEnter();

    $('.game__stage').click();
    expect($('.game__status').textContent).toBe('Press Space to start');
    expect($('.game__toggle').textContent).toBe('▶ Start');
  });

  it('talks about tapping on touch devices', () => {
    document.documentElement.classList.add('touch');
    view = new GameView(definitionOf(new Snake(() => 0)));
    view.render();
    view.onEnter();

    expect($('.game__status').textContent).toBe('Tap to start');
    $('.touch-controls__pause').click();
    $('.touch-controls__pause').click();
    expect($('.game__status').textContent).toBe('Paused - tap to resume');
    document.documentElement.classList.remove('touch');
  });

  it('hops once per tap on Frogger\'s D-pad', () => {
    const game = froggerGame.create({});
    view = new GameView(definitionOf(game));
    view.render();
    view.onEnter();
    expect($('.touch-controls__stick')).toBeFalsy();

    $('.touch-controls__pause').click();
    const up = $('.touch-controls__cross-button--up');
    [1, 2].forEach((id) => {
      up.dispatchEvent(new window.PointerEvent('pointerdown', { pointerId: id, bubbles: true }));
      up.dispatchEvent(new window.PointerEvent('pointerup', { pointerId: id, bubbles: true }));
      // Let the hop land: taps during a hop are ignored.
      game.tick(200);
    });

    expect(game.frog.row).toBe(10);
  });

  it('shows the game\'s keys, named by the player\'s keyboard layout', async () => {
    const getContext = spyOn(window.HTMLCanvasElement.prototype, 'getContext').andReturn(fakeCanvasContext());
    resetKeyLabels();
    Object.defineProperty(navigator, 'keyboard', {
      configurable: true,
      value: { getLayoutMap: async () => new Map([['KeyZ', 'w'], ['KeyW', 'z']]) },
    });
    view = new GameView(definitionOf(new Arkanoid()));
    view.render();
    await flushPromises();

    expect($('.game__keys').textContent).toBe('Move: ← → · Launch: ↑, W or Z');
    delete navigator.keyboard;
    resetKeyLabels();
    getContext.restore();
  });

  it('shows no key line for games without key hints', () => {
    view = new GameView(definitionOf(new Snake(() => 0)));
    view.render();
    expect($('.game__keys')).toBeFalsy();
  });

  it('lowers the Tetris curtain before announcing the game over', () => {
    const game = new Tetris(() => 3 / 7);
    view = new GameView(definitionOf(game));
    view.render();
    view.onEnter();
    game.score = 120;
    game.board[2] = game.board[2].map(() => 'tetris-Z');

    press('Space');
    // The O piece can't fall: the curtain starts…
    advanceTimersByTime(1000);
    advanceTimersByTime(40 * 5);
    const curtain = $$('.game__stage .game-board__cell--tetris-curtain').length;
    expect(curtain).toBeGreaterThan(0);
    expect($('.game__status').textContent).toBe('Playing - press Space to pause');

    // …and only once the well is full does the game end.
    advanceTimersByTime(40 * 20);
    expect($$('.game__stage .game-board__cell--tetris-curtain').length).toBe(10 * 18);
    expect($('.game__status').textContent).toContain('Game over');
    expect($('.score-table__row--new .score-table__score').textContent).toBe('120');
  });

  it('has a play/pause button that follows the game, like Space', () => {
    const game = new Snake(() => 0);
    view = new GameView(definitionOf(game));
    view.render();
    view.onEnter();
    // The button is rebuilt when its label changes: look it up each time.
    const toggle = () => $('.game__toggle');
    expect(toggle().textContent).toBe('▶ Start');

    toggle().click();
    expect(toggle().textContent).toBe('⏸ Pause');
    expect($('.game__status').textContent).toBe('Playing - press Space to pause');

    toggle().click();
    expect(toggle().textContent).toBe('▶ Resume');
    expect($('.game__status').textContent).toContain('Paused');

    toggle().click();
    game.body = [{ x: 20, y: 10 }];
    advanceTimersByTime(250);
    expect(toggle().textContent).toBe('↻ Play again');

    toggle().click();
    expect(game.isOver).toBeFalsy();
    expect(toggle().textContent).toBe('⏸ Pause');
  });

  it('leaves Space on a focused button to the button, so it toggles once', () => {
    view = new GameView(definitionOf(new Snake(() => 0)));
    view.render();
    view.onEnter();
    const toggle = () => $('.game__toggle');
    toggle().focus();

    toggle().dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true }));
    // The browser turns it into a click on the button; the view itself didn't toggle.
    expect(toggle().textContent).toBe('▶ Start');
    toggle().click();
    expect(toggle().textContent).toBe('⏸ Pause');
    // Still focused after the rebuild: Space keeps going to the button.
    expect(document.activeElement).toBe(toggle());
  });

  it('shows no Options box for games without options', () => {
    const game = new Snake(() => 0);
    view = new GameView({ id: 'snake', create: () => game });
    view.render();
    expect($('.game__options')).toBeFalsy();
  });

  it('goes back to the games from the header', () => {
    view = new GameView(definitionOf(new Snake(() => 0)));
    view.render();
    const paths = [];
    const stop = Navigation.onNavigate(({ path }) => paths.push(path));

    $('.game__header .game__back').click();

    expect(paths).toEqual(['/']);
    stop();
  });
});
