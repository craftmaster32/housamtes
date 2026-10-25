import type { Alert as RNAlert } from 'react-native';

type AlertTitle = Parameters<typeof RNAlert.alert>[0];
type AlertMessage = Parameters<typeof RNAlert.alert>[1];
type AlertButtons = Parameters<typeof RNAlert.alert>[2];
export type AlertButton = NonNullable<AlertButtons>[number];

export interface AlertOptions {
  onDismiss?: () => void;
  /** A short value to show big on its own line and let people copy, e.g. an invite code. */
  code?: string;
}

export interface AlertRequest {
  id: number;
  title: string;
  message?: string;
  /** Empty means a single "OK" — the host fills in the label in the app's language. */
  buttons: AlertButton[];
  code?: string;
  onDismiss?: () => void;
}

// Every Alert.alert in the app is drawn by <AlertHost/> (mounted once at the
// root) as the app's own sticky-note pop-up, on the web and on phones alike.
// The phone's grey box (and the browser's alert/confirm, which word their
// buttons in the phone's language) are never used. Alerts that arrive while
// one is showing wait in line and appear one after another.
let queue: AlertRequest[] = [];
let nextId = 1;
let listeners: Array<() => void> = [];

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeAlert(listener: () => void): () => void {
  listeners.push(listener);
  return (): void => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

/** The pop-up showing right now, if any. */
export function getAlertSnapshot(): AlertRequest | null {
  return queue[0] ?? null;
}

/** Take the current pop-up away (the next one in line, if any, shows). */
export function finishAlert(id: number): void {
  const before = queue.length;
  queue = queue.filter((request) => request.id !== id);
  if (queue.length !== before) notify();
}

function alert(
  title: AlertTitle,
  message?: AlertMessage,
  buttons?: AlertButtons,
  options?: AlertOptions
): void {
  queue = [
    ...queue,
    {
      id: nextId++,
      title: title ?? '',
      message: message ?? undefined,
      buttons: buttons ?? [],
      code: options?.code,
      onDismiss: options?.onDismiss,
    },
  ];
  notify();
}

export const Alert = { alert };
