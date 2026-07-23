import { useLanguageStore } from '@stores/languageStore';

/**
 * Returns the display-heading font family for the current language.
 *
 * Fraunces (our serif display face) covers Latin only, so Hebrew headings fall
 * back to Heebo — otherwise Hebrew titles would render as tofu. Spread the
 * result onto a title's Text style:
 *
 *   const headingFont = useHeadingFont();
 *   <Text style={[styles.title, headingFont]}>…</Text>
 */
export function useHeadingFont(weight: 'semibold' | 'bold' = 'bold'): { fontFamily: string } {
  const language = useLanguageStore((s) => s.language);
  if (language === 'he') {
    return { fontFamily: weight === 'semibold' ? 'Heebo_700Bold' : 'Heebo_800ExtraBold' };
  }
  return { fontFamily: weight === 'semibold' ? 'Fraunces_600SemiBold' : 'Fraunces_700Bold' };
}
