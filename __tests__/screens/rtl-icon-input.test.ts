/**
 * @jest-environment jsdom
 *
 * RTL right-icon input layout — CSS selector ↔ DOM structure regression.
 *
 * The Hebrew (RTL) login screen injects `RTL_WEB_FIX_CSS` (lib/rtlWebFix.ts) to
 * move the password "eye" off the right-anchored label. Two of those selectors
 * are coupled to react-native-paper's internal web DOM (verified against the
 * pinned react-native-paper 5.15.0 / react-native-web 0.21.2):
 *
 *   field(div, :has the icon testid)
 *     ├─ …label…
 *     ├─ inputWrap(div)        ← RNW wraps the <input> in a child div
 *     │    └─ <input>          ← reached via `> div > input`, NOT `> input`
 *     └─ iconContainer(div)    ← direct parent of the icon testid
 *          └─ …[data-testid="right-icon-adornment"]
 *
 * We cannot render the real component here: under jest-expo `react-native`
 * resolves to the native mocks (not react-native-web), so react-dom can't mount
 * Paper to the DOM; and jsdom 20 (bundled with jest-expo) can't parse `:has()`
 * in querySelectorAll at all. So this suite attaches a fixture mirroring the
 * verified structure and exercises the *runnable* part of the shipped
 * selectors — the combinator tail after `:has()` — which is exactly the part
 * that regressed before (`> input` vs `> div > input`, and a dropped `>` in the
 * container anchor). If Paper's nesting changes on upgrade, update the fixture
 * and the selectors in lib/rtlWebFix.ts together.
 */

import {
  RTL_RIGHT_ICON_CONTAINER_SELECTOR,
  RTL_RIGHT_ICON_INPUT_SELECTOR,
} from '@lib/rtlWebFix';

const ICON_TESTID = 'right-icon-adornment';

/** Attaches a field mirroring Paper 5.15.0's outlined-input-with-right-icon DOM. */
function mountFixture(): { field: HTMLElement; input: HTMLInputElement; iconContainer: HTMLElement } {
  const card = document.createElement('div');

  const field = document.createElement('div'); // labelContainer, :has the icon testid

  const labelWrap = document.createElement('div');
  const label = document.createElement('div');
  label.setAttribute('data-testid', 'password-label-inactive');
  labelWrap.appendChild(label);

  const inputWrap = document.createElement('div'); // the wrapper RNW adds around <input>
  const input = document.createElement('input');
  inputWrap.appendChild(input);

  const iconContainer = document.createElement('div'); // adornment container, direct parent of testid
  const iconButton = document.createElement('button');
  iconButton.setAttribute('data-testid', ICON_TESTID);
  iconContainer.appendChild(iconButton);

  field.append(labelWrap, inputWrap, iconContainer);
  card.appendChild(field);
  document.body.appendChild(card);

  return { field, input, iconContainer };
}

/** Everything after `<lead> div:has(<arg>)` in one comma-separated selector, e.g. `> div > input`. */
function combinatorTail(selector: string): string {
  const first = selector.split(',')[0];
  const closeParen = first.indexOf(')'); // the `:has(...)` close — the argument has no nested parens
  return first.slice(closeParen + 1).trim();
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('RTL right-icon input layout — CSS selector regression', () => {
  it('the shipped selectors still target the icon testid via :has()', () => {
    expect(RTL_RIGHT_ICON_INPUT_SELECTOR).toContain(`:has([data-testid="${ICON_TESTID}"])`);
    expect(RTL_RIGHT_ICON_CONTAINER_SELECTOR).toContain(`:has(> [data-testid="${ICON_TESTID}"])`);
  });

  it('input-margin selector reaches the input through the wrapper div (`> div > input`)', () => {
    const { field, input } = mountFixture();

    const tail = combinatorTail(RTL_RIGHT_ICON_INPUT_SELECTOR); // expected: `> div > input`
    expect(field.querySelector(`:scope ${tail}`)).toBe(input);

    // The old broken tail would miss it, because <input> is not a direct child.
    expect(field.querySelector(':scope > input')).toBeNull();
  });

  it('container selector uses the child combinator so only the icon container matches, not its ancestors', () => {
    const { iconContainer } = mountFixture();

    // The shipped container selector must anchor with `:has(> …)`. Without the
    // `>` it degrades to a descendant match and also selects the field/card/root.
    expect(RTL_RIGHT_ICON_CONTAINER_SELECTOR).toContain('div:has(> [data-testid=');

    const allDivs = Array.from(document.querySelectorAll('div'));
    const directParents = allDivs.filter((d) => d.querySelector(`:scope > [data-testid="${ICON_TESTID}"]`));
    const descendantAncestors = allDivs.filter((d) => d.querySelector(`[data-testid="${ICON_TESTID}"]`));

    expect(directParents).toEqual([iconContainer]); // child combinator → exactly one
    expect(descendantAncestors.length).toBeGreaterThan(1); // descendant → several (why `>` matters)
  });
});
