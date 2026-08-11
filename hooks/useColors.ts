import { useThemedColors, type ColorPalette } from '@constants/colors';

export type { ColorPalette };

/**
 * Returns the active colour palette.
 *
 * Delegates to `useThemedColors()` so that every screen — whichever hook it
 * happens to use — follows a single source of truth: the user's saved
 * appearance choice (system / light / dark) in Settings.
 */
export function useColors(): ColorPalette {
  return useThemedColors();
}
