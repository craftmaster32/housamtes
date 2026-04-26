import type { Housemate } from '@stores/housematesStore';

/** Resolve a user UUID to a display name. Falls back to 'Unknown' if not found. */
export function resolveName(userId: string, housemates: Housemate[]): string {
  return housemates.find((h) => h.id === userId)?.name ?? 'Unknown';
}
