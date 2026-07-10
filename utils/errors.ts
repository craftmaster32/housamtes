/**
 * Extract a user-showable message from an unknown thrown value.
 * Replaces the `err instanceof Error ? err.message : fallback` pattern
 * that was repeated across screens and stores.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}
