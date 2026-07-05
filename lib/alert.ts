import { Alert as RNAlert, Platform } from 'react-native';

type AlertTitle = Parameters<typeof RNAlert.alert>[0];
type AlertMessage = Parameters<typeof RNAlert.alert>[1];
type AlertButtons = Parameters<typeof RNAlert.alert>[2];
type AlertOptions = Parameters<typeof RNAlert.alert>[3];
export type AlertButton = NonNullable<AlertButtons>[number];

export interface WebAlertRequest {
  title: string;
  message?: string;
  buttons: AlertButton[];
  onDismiss?: () => void;
}

// window.confirm only yields OK/Cancel, which can't represent 3+ buttons
// without silently dropping one — so 3+ button alerts are routed through
// this tiny external store instead, which <WebAlertHost/> (mounted once at
// the app root) renders as a proper picker with every option preserved.
let pendingWebAlert: WebAlertRequest | null = null;
let listeners: Array<() => void> = [];

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeWebAlert(listener: () => void): () => void {
  listeners.push(listener);
  return (): void => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function getWebAlertSnapshot(): WebAlertRequest | null {
  return pendingWebAlert;
}

export function clearWebAlert(): void {
  pendingWebAlert = null;
  notify();
}

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

  if (buttons.length > 2) {
    pendingWebAlert = {
      title: title ?? '',
      message: message ?? undefined,
      buttons,
      onDismiss: options?.onDismiss,
    };
    notify();
    return;
  }

  // Exactly 2 buttons maps cleanly onto OK/Cancel.
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
