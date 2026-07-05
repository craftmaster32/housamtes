import { Alert as RNAlert, Platform } from 'react-native';

type AlertTitle = Parameters<typeof RNAlert.alert>[0];
type AlertMessage = Parameters<typeof RNAlert.alert>[1];
type AlertButtons = Parameters<typeof RNAlert.alert>[2];
type AlertOptions = Parameters<typeof RNAlert.alert>[3];

function runWebAlert(
  title: AlertTitle,
  message: AlertMessage,
  buttons: AlertButtons,
  options?: AlertOptions
): void {
  if (typeof window === 'undefined') return;

  const text = [title, message].filter((part): part is string => !!part).join('\n\n');

  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }

  // window.confirm only yields OK/Cancel, so N buttons must collapse to that binary choice.
  const confirmed = window.confirm(text);
  if (confirmed) {
    const destructive = buttons.find((button) => button.style === 'destructive');
    const fallback = [...buttons].reverse().find((button) => button.style !== 'cancel');
    (destructive ?? fallback)?.onPress?.();
  } else {
    const cancelButton = buttons.find((button) => button.style === 'cancel');
    if (cancelButton) {
      cancelButton.onPress?.();
    } else {
      options?.onDismiss?.();
    }
  }
}

function alert(
  title: AlertTitle,
  message?: AlertMessage,
  buttons?: AlertButtons,
  options?: AlertOptions
): void {
  if (Platform.OS !== 'web') {
    RNAlert.alert(title, message, buttons, options);
    return;
  }
  runWebAlert(title, message, buttons, options);
}

export const Alert = { alert };
