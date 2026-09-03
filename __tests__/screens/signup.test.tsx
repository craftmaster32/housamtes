/**
 * QA — Signup consent gate (18+ and Terms/Privacy)
 *
 * A single clickwrap checkbox on the signup form confirms the user is 18 or
 * older AND agrees to the Terms of Service and Privacy Policy. Our privacy
 * policy promises registration is blocked for anyone under 18, so the gate has
 * to be enforced on the form itself:
 *   • the create-account button stays disabled until the box is ticked
 *   • submitting without ticking never calls signUp
 *   • ticking the box enables submission
 */

import { render, screen, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { setupI18n } from '@lib/i18n';
import SignupScreen from '../../app/(auth)/signup';

// signUp is the action the gate must protect. Mocking the store also avoids
// importing lib/supabase (which throws without env vars) through the real store.
// The screen transitively imports lib/supabase (via languageStore →
// notifications); stub it so module load doesn't throw on missing env vars.
jest.mock('@lib/supabase', () => ({ supabase: {} }));

const mockSignUp = jest.fn(() => Promise.resolve({ needsVerification: true }));
jest.mock('@stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown): unknown =>
    selector({ signUp: mockSignUp, isLoading: false }),
}));

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}));

jest.mock('@utils/tour', () => ({
  markTourPending: jest.fn(() => Promise.resolve()),
}));

function renderSignup(): void {
  const initialMetrics = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
  };
  render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <PaperProvider>
        <SignupScreen />
      </PaperProvider>
    </SafeAreaProvider>
  );
}

describe('Signup age gate', () => {
  beforeAll(() => setupI18n('en'));
  beforeEach(() => mockSignUp.mockClear());

  it('starts with the 18+ confirmation unchecked and the submit disabled', () => {
    renderSignup();
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox.props.accessibilityState?.checked).toBeFalsy();
    const submit = screen.getByTestId('signup-submit');
    expect(submit.props.accessibilityState?.disabled).toBe(true);
  });

  it('does not call signUp while the 18+ box is unconfirmed', () => {
    renderSignup();
    // The submit is disabled until confirmed, so pressing it is a no-op — the
    // account-creation path can never run for an unconfirmed user.
    fireEvent.press(screen.getByTestId('signup-submit'));
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('checks the box and enables the submit once confirmed', () => {
    renderSignup();
    fireEvent.press(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox').props.accessibilityState?.checked).toBe(true);
    expect(screen.getByTestId('signup-submit').props.accessibilityState?.disabled).toBe(false);
  });
});

describe('Signup — email typo suggestion', () => {
  beforeAll(() => setupI18n('en'));

  it("offers a fix for a typo'd domain once the field is blurred, and applies it on tap", () => {
    renderSignup();
    const emailInput = screen.getByLabelText('Email');
    fireEvent.changeText(emailInput, 'alice@gmial.com');
    fireEvent(emailInput, 'blur');

    expect(screen.getByText('Did you mean alice@gmail.com?')).toBeTruthy();

    fireEvent.press(screen.getByText('Use it'));

    expect(screen.getByLabelText('Email').props.value).toBe('alice@gmail.com');
  });

  it('does not suggest anything for an already-valid domain', () => {
    renderSignup();
    const emailInput = screen.getByLabelText('Email');
    fireEvent.changeText(emailInput, 'alice@gmail.com');
    fireEvent(emailInput, 'blur');

    expect(screen.queryByText(/Did you mean/)).toBeNull();
  });
});

describe('Signup — points at the field that needs fixing', () => {
  beforeAll(() => setupI18n('en'));
  beforeEach(() => mockSignUp.mockClear());

  function fillValidFormExcept(overrides: { password?: string; confirm?: string } = {}): void {
    fireEvent.changeText(screen.getByLabelText('Your name'), 'Alice');
    fireEvent.changeText(screen.getByLabelText('Email'), 'alice@example.com');
    fireEvent.changeText(screen.getByLabelText('Password'), overrides.password ?? 'Password1');
    fireEvent.changeText(
      screen.getByLabelText('Confirm password'),
      overrides.confirm ?? overrides.password ?? 'Password1'
    );
    fireEvent.press(screen.getByRole('checkbox'));
  }

  it('blocks submission and surfaces the mismatch message when passwords differ', () => {
    renderSignup();
    fillValidFormExcept({ password: 'Password1', confirm: 'Password2' });

    fireEvent.press(screen.getByTestId('signup-submit'));

    expect(mockSignUp).not.toHaveBeenCalled();
    expect(screen.getByText('Passwords do not match')).toBeTruthy();
  });
});
