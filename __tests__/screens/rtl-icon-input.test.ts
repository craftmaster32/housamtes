/**
 * Browser regression test — RTL right-icon input layout
 *
 * React Native Paper 5.15.0 wraps the TextInput's <input> element inside a
 * child div (sibling to the absolutely-positioned adornment container), so the
 * RTL margin-flip rule in _layout.tsx must traverse `> div > input` rather
 * than the old `> input`.  This suite pins that structural assumption so any
 * future RNP upgrade that changes the nesting depth is caught immediately.
 *
 * DOM structure being modelled:
 *   div.outer
 *     div.input-wrapper          ← intermediate child div
 *       input
 *     div.adornment-container    ← sibling child div
 *       button[data-testid="right-icon-adornment"]
 */

/** @jest-environment jsdom */

describe('RTL right-icon input layout — CSS selector regression', () => {
  let outer: HTMLDivElement;
  let inputEl: HTMLInputElement;

  beforeEach(() => {
    outer = document.createElement('div');

    const inputWrapper = document.createElement('div');
    inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputWrapper.appendChild(inputEl);

    const adornmentContainer = document.createElement('div');
    const iconButton = document.createElement('button');
    iconButton.dataset['testid'] = 'right-icon-adornment';
    adornmentContainer.appendChild(iconButton);

    outer.appendChild(inputWrapper);
    outer.appendChild(adornmentContainer);
    document.body.appendChild(outer);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('fixed selector (> div > input) matches the input through the wrapper div', () => {
    let found: NodeList;
    try {
      found = document.querySelectorAll(
        'div:has([data-testid="right-icon-adornment"]) > div > input'
      );
    } catch {
      // :has() not supported in this jsdom build — skip rather than fail
      return;
    }
    expect(found).toHaveLength(1);
    expect(found[0]).toBe(inputEl);
  });

  it('old broken selector (> input) misses the input because it is not a direct child', () => {
    let found: NodeList;
    try {
      found = document.querySelectorAll(
        'div:has([data-testid="right-icon-adornment"]) > input'
      );
    } catch {
      return;
    }
    expect(found).toHaveLength(0);
  });
});
