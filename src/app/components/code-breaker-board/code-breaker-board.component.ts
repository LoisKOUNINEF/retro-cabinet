import { html } from '../../../core/index.js';
import { PEGS } from '../../games/bonus/code-breaker/pegs.js';
import { ICONS } from '../../games/icons.js';
import { pixelArt } from '../pixel-art.js';
import { UpdatableComponent } from '../updatable-component.js';
import { CodeBreakerPegComponent, type CodeBreakerPeg } from './code-breaker-peg/code-breaker-peg.component.js';
import { CodeBreakerRowComponent, type CodeBreakerRow } from './code-breaker-row/code-breaker-row.component.js';
import { keyArt, pegArt } from './peg-art.js';

export interface CodeBreakerBoardConfig {
  // Holes per row.
  pegs: number;
  tries: number;
  // The rules in a line: "4 pegs, 6 colours, no repeats".
  rules: string;
  guesses: { pegs: readonly number[]; exact: number; misplaced: number }[];
  // The row being played; null for a hole not filled yet.
  current: readonly (number | null)[];
  // The hole the next colour goes in.
  cursor: number;
  palette: { peg: number; disabled: boolean }[];
  // The secret code, once the round is over.
  code: readonly number[] | null;
  // Every hole of the row is filled: it can be checked.
  full: boolean;
  // The round is over.
  locked: boolean;
}

const pegName = (peg: number | null) => (peg === null ? 'not filled' : PEGS[peg]?.name ?? '');
const names = (pegs: readonly number[]) => pegs.map(pegName).join(', ');

const feedback = (exact: number, misplaced: number) => `${exact} in place, ${misplaced} misplaced`;

// The secret code: question marks until the round is over.
function codeRow({ code, pegs }: CodeBreakerBoardConfig) {
  const label = code ? `The code: ${names(code)}` : 'The code: hidden';
  const holes = code
    ? code.map((peg) => html`<span class="code-breaker__hole">${pegArt(peg)}</span>`)
    : Array.from({ length: pegs }, () => html`<span class="code-breaker__hole">${pixelArt(ICONS.random, 'code-breaker__peg code-breaker__peg--secret')}</span>`);
  return html`<div class="code-breaker__row code-breaker__row--code" role="img" aria-label="${label}"><span class="code-breaker__number" aria-hidden="true"></span>${holes}<span class="code-breaker__keys"></span></div>`;
}

// The rows still to play after the current one, as empty holes.
function futureRows({ tries, guesses, pegs, locked }: CodeBreakerBoardConfig) {
  const left = locked ? 0 : tries - guesses.length - 1;
  return Array.from({ length: Math.max(left, 0) }, (_, i) => html`
    <div class="code-breaker__row code-breaker__row--future">
      <span class="code-breaker__number">${guesses.length + i + 2}</span>
      ${Array.from({ length: pegs }, () => html`<span class="code-breaker__hole">${pegArt(null)}</span>`)}
      <span class="code-breaker__keys">${keyArt(pegs, 0, 0)}</span>
    </div>`);
}

const templateFn = (config: CodeBreakerBoardConfig) => html`__TEMPLATE_PLACEHOLDER__`;

// The code (hidden until the end), the guesses played with their feedback, the row being played
// with its Check button, the rows left, and the colours. Rows, holes and colours are kept by index:
// putting a colour in only rebuilds that hole (and the colours it allows or forbids).
export class CodeBreakerBoardComponent extends UpdatableComponent<CodeBreakerBoardConfig> {
  constructor(
    mountTarget: HTMLElement,
    config: CodeBreakerBoardConfig,
    // Passed to every peg as is, so unchanged pegs stay equal and are kept.
    private readonly onSelect: (index: number, action?: string) => void,
  ) {
    super({ templateFn, mountTarget, config });
  }

  override registerChildren(): Nutin.ComponentConfig[] {
    const { guesses, current, cursor, palette, locked } = this.config;
    return [
      ...this.createCatalogComponents({
        items: guesses.map(({ pegs, exact, misplaced }, i): CodeBreakerRow => ({
          pegs,
          exact,
          misplaced,
          label: `Guess ${i + 1}: ${names(pegs)}: ${feedback(exact, misplaced)}`,
        })),
        selector: 'rows',
        elementName: 'code-breaker-row',
        elementTag: 'li',
        component: CodeBreakerRowComponent,
        keepBy: (_row: CodeBreakerRow, index: number) => index,
      }),
      ...this.createCatalogComponents({
        items: current.map((peg, i): CodeBreakerPeg => ({
          peg,
          action: 'slot',
          value: i,
          key: null,
          label: `Hole ${i + 1}: ${pegName(peg)}${i === cursor ? ', selected' : ''}`,
          cursor: i === cursor,
          disabled: locked,
          onSelect: this.onSelect,
        })),
        selector: 'holes',
        elementName: 'code-breaker-hole',
        component: CodeBreakerPegComponent,
        keepBy: (_peg: CodeBreakerPeg, index: number) => index,
      }),
      ...this.createCatalogComponents({
        items: palette.map(({ peg, disabled }, i): CodeBreakerPeg => ({
          peg,
          action: 'colour',
          value: peg,
          key: i + 1,
          label: `${pegName(peg)}, key ${i + 1}`,
          cursor: false,
          disabled: locked || disabled,
          onSelect: this.onSelect,
        })),
        selector: 'palette',
        elementName: 'code-breaker-colour',
        component: CodeBreakerPegComponent,
        keepBy: (_peg: CodeBreakerPeg, index: number) => index,
      }),
    ];
  }

  // Check gets disabled once pressed: the focus goes on to the first colour left.
  protected override fallbackFocus(): HTMLElement | null {
    return this.element.querySelector<HTMLElement>('.code-breaker__button--colour:not(:disabled)');
  }

  private _check(): void {
    this.onSelect(0, 'check');
  }
}
