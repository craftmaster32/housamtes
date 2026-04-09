import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';

import en from '@locales/en.json';
import he from '@locales/he.json';
import es from '@locales/es.json';

export type AppLanguage = 'en' | 'he' | 'es';
export const SUPPORTED_LANGUAGES: AppLanguage[] = ['en', 'he', 'es'];
const LANGUAGE_STORAGE_KEY = 'nestiq_language';

/** Reads the persisted language choice; falls back to device locale then 'en'. */
export async function getInitialLanguage(): Promise<AppLanguage> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.includes(stored as AppLanguage)) {
      return stored as AppLanguage;
    }
  } catch { /* ignore read errors */ }

  const deviceLang = getLocales()[0]?.languageCode ?? 'en';
  // 'iw' is the legacy ISO 639-1 code for Hebrew still used by some Android devices
  if (deviceLang === 'he' || deviceLang === 'iw') return 'he';
  if (deviceLang === 'es') return 'es';
  return 'en';
}

/** Persists the chosen language to AsyncStorage. */
export async function persistLanguage(lang: AppLanguage): Promise<void> {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch { /* ignore write errors */ }
}

export const RTL_LANGUAGES: AppLanguage[] = ['he'];
export function isRTL(lang: AppLanguage): boolean {
  return RTL_LANGUAGES.includes(lang);
}

/**
 * Initialises i18next.
 * Call this once, before rendering the app (pass the resolved initial language).
 */
export function setupI18n(initialLanguage: AppLanguage): void {
  // Apply RTL flag synchronously so React Native uses it from the first render
  const rtl = isRTL(initialLanguage);
  if (I18nManager.isRTL !== rtl) {
    I18nManager.forceRTL(rtl);
    I18nManager.allowRTL(rtl);
  }

  i18n
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        he: { translation: he },
        es: { translation: es },
      },
      lng: initialLanguage,
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false, // React Native handles XSS
      },
      compatibilityJSON: 'v3', // Required for Android
    });
}

export default i18n;
