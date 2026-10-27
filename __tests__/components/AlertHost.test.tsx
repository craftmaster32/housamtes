/**
 * Sticky-note pop-ups: tapping outside the note must never run a button that
 * deletes something, but still counts as Cancel / OK as before.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AlertHost } from '@components/shared/AlertHost';
import { Alert, getAlertSnapshot, finishAlert } from '@lib/alert';

jest.mock('react-i18next', () => ({
  useTranslation: (): { t: (key: string) => string } => ({ t: (key: string): string => key }),
}));
jest.mock('@hooks/useHeadingFont', () => ({ useHeadingFont: (): object => ({}) }));
jest.mock('@hooks/useHandFont', () => ({ useHandFont: (): object => ({}) }));
jest.mock('@hooks/useReduceMotion', () => ({ useReduceMotion: (): boolean => true }));

const tapOutside = (): void => {
  fireEvent.press(screen.getByLabelText('common.close', { includeHiddenElements: true }));
};

afterEach(() => {
  let current = getAlertSnapshot();
  while (current) {
    finishAlert(current.id);
    current = getAlertSnapshot();
  }
});

describe('AlertHost', () => {
  it('does not run a lone Delete button when tapping outside', () => {
    const onDelete = jest.fn();
    const onDismiss = jest.fn();
    render(<AlertHost />);
    act(() => {
      Alert.alert(
        'Delete photo?',
        undefined,
        [{ text: 'Delete', style: 'destructive', onPress: onDelete }],
        { onDismiss }
      );
    });
    tapOutside();
    expect(onDelete).not.toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('still counts tapping outside as pressing a lone OK button', () => {
    const onOk = jest.fn();
    render(<AlertHost />);
    act(() => {
      Alert.alert('Saved', undefined, [{ text: 'OK', onPress: onOk }]);
    });
    tapOutside();
    expect(onOk).toHaveBeenCalledTimes(1);
  });

  it('counts tapping outside as Cancel when there is one', () => {
    const onCancel = jest.fn();
    const onDelete = jest.fn();
    render(<AlertHost />);
    act(() => {
      Alert.alert('Delete?', undefined, [
        { text: 'Cancel', style: 'cancel', onPress: onCancel },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]);
    });
    tapOutside();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });
});
