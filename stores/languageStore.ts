import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { I18nManager } from 'react-native';
import i18n, { type AppLanguage, isRTL, persistLanguage } from '@lib/i18n';

interface LanguageStore {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => Promise<void>;
}

export const useLanguageStore = create<LanguageStore>()(
  devtools(
    (set, get) => ({
      language: (i18n.language as AppLanguage) ?? 'en',

      setLanguage: async (lang): Promise<void> => {
        if (lang === get().language) return;

        const prevRTL = isRTL(get().language);
        const nextRTL = isRTL(lang);

        await persistLanguage(lang);
        await i18n.changeLanguage(lang);
        set({ language: lang });

        // Best-effort: update native RTL flag for native text inputs etc.
        // Layout direction is handled reactively via the 'direction' style prop
        // on the root View, so no restart is needed.
        if (prevRTL !== nextRTL) {
          I18nManager.forceRTL(nextRTL);
          I18nManager.allowRTL(nextRTL);
        }

        // Update browser document direction immediately on language switch (web only)
        if (typeof document !== 'undefined') {
          document.documentElement.dir = nextRTL ? 'rtl' : 'ltr';
          document.documentElement.lang = lang;
        }
      },
    }),
    { name: 'language-store' }
  )
);
