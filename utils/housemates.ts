import type { Housemate } from '@stores/housematesStore';

/** Resolve a user UUID to a display name. Falls back to the provided string if not found. */
export function resolveName(userId: string, housemates: Housemate[], fallback = 'Unknown'): string {
  return housemates.find((h) => h.id === userId)?.name ?? fallback;
}
