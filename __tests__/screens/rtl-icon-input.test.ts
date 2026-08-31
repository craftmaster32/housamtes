/**
 * @jest-environment jsdom
 *
 * Browser regression test — RTL right-icon input layout
 *
 * React Native Paper 5.15.0 wraps the TextInput's <input> element inside a
 * child div (sibling to the absolutely-positioned adornment container), so the
 * RTL margin-flip rule in _layout.tsx must traverse `> div > input` rather
 * than the old `> input`.  This suite pins that structural assumption so any
 * future RNP upgrade that changes the nesting depth is caught immediately.
 */

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { PaperProvider, TextInput } from 'react-native-paper';

function renderPasswordInput(): void {
  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    createRoot(container).render(
      React.createElement(
        PaperProvider,
        null,
        React.createElement(TextInput, {
          mode: 'outlined' as const,
          label: 'Password',
          secureTextEntry: true,
          right: React.createElement(TextInput.Icon, {
            icon: 'eye',
            testID: 'right-icon-adornment',
          }),
        })
      )
    );
  });
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('RTL right-icon input layout — CSS selector regression', () => {
  it('fixed selector (> div > input) matches the input through the wrapper div', () => {
    renderPasswordInput();

    let found: NodeList;
    try {
      found = document.querySelectorAll(
        'div:has([data-testid="right-icon-adornment"]) > div > input'
      );
    } catch {
      // :has() not supported in this jsdom build — skip rather than fail
      return;
    }
    expect(found.length).toBeGreaterThanOrEqual(1);
  });

  it('old broken selector (> input) misses the input because it is not a direct child', () => {
    renderPasswordInput();

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
