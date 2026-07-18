import type { Housemate, FormerMember } from '@stores/housematesStore';

/** Resolve a user UUID to a display name. Falls back to the provided string if not found. */
export function resolveName(userId: string, housemates: Housemate[], fallback = 'Unknown'): string {
  return housemates.find((h) => h.id === userId)?.name ?? fallback;
}

interface ResolveMemberNameOptions {
  /** Shown when the id belongs to nobody we know — e.g. a deleted (erased)
   *  account, whose reference is blanked. Defaults to 'Unknown'. */
  fallback?: string;
  /** Suffix label for someone who left / was removed, e.g. 'left' -> "Alex (left)". */
  leftLabel?: string;
}

/**
 * Resolve a user UUID to a display name, including people who have left the
 * house. Current members show their name; departed members show
 * "Name (leftLabel)"; anyone else (a deleted/erased account) shows the
 * fallback. Prefer this over resolveName wherever historical records
 * (bills, messages, settlements) can outlive the person who created them.
 */
export function resolveMemberName(
  userId: string,
  housemates: Housemate[],
  formerMembers: FormerMember[],
  options: ResolveMemberNameOptions = {}
): string {
  const { fallback = 'Unknown', leftLabel = 'left' } = options;
  const current = housemates.find((h) => h.id === userId);
  if (current) return current.name;
  const former = formerMembers.find((f) => f.id === userId);
  if (former) return `${former.name} (${leftLabel})`;
  return fallback;
}
