// Mate's little celebrations: a store action calls celebrate('bill') after
// something good happens on this phone, and <MateCelebration/> (mounted once
// at the root) pops Mate up for a moment with a line. Only one shows at a
// time; a second one while he's out just replaces the line.

export type CelebrationKind = 'bill' | 'tasks' | 'grocery' | 'vote';

export interface Celebration {
  id: number;
  kind: CelebrationKind;
}

let current: Celebration | null = null;
let nextId = 1;
let listeners: Array<() => void> = [];

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeCelebration(listener: () => void): () => void {
  listeners.push(listener);
  return (): void => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function getCelebration(): Celebration | null {
  return current;
}

export function celebrate(kind: CelebrationKind): void {
  current = { id: nextId++, kind };
  notify();
}

/** Mate has gone again. */
export function finishCelebration(id: number): void {
  if (current?.id !== id) return;
  current = null;
  notify();
}
