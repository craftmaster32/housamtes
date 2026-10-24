import { useLanguageStore } from '@stores/languageStore';

/**
 * Returns the handwriting font family for the current language.
 *
 * Caveat (our handwriting face) covers Latin only, so Hebrew falls back to
 * Heebo — otherwise Hebrew notes would render in the system font at Caveat's
 * (small-looking) metrics.
 */
export function useHandFont(): { fontFamily: string } {
  const language = useLanguageStore((s) => s.language);
  return { fontFamily: language === 'he' ? 'Heebo_500Medium' : 'Caveat_700Bold' };
}
