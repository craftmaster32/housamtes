import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Monetization groundwork — single source of truth for premium entitlements.
// No payment SDK is wired up yet: everyone defaults to the free tier, and
// setPremium() is the one hook the future IAP layer (RevenueCat / StoreKit)
// will call after verifying a purchase or restore. See MONETIZATION.md for
// exactly what has to happen before this can go live.

export type PremiumFeature = 'ad_free' | 'unlimited_photos' | 'pdf_reports' | 'custom_themes';

export interface PremiumFeatureInfo {
  key: PremiumFeature;
  icon: string;
  titleKey: string;
  descriptionKey: string;
}

// What premium unlocks, per FEATURES.md (Phase 7) and IDEAS.md.
// The paywall screen renders this list; the titleKey/descriptionKey values
// resolve through i18n so all three languages stay in sync.
export const PREMIUM_FEATURES: PremiumFeatureInfo[] = [
  {
    key: 'ad_free',
    icon: '🚫',
    titleKey: 'premium.feature_ad_free',
    descriptionKey: 'premium.feature_ad_free_sub',
  },
  {
    key: 'unlimited_photos',
    icon: '📸',
    titleKey: 'premium.feature_unlimited_photos',
    descriptionKey: 'premium.feature_unlimited_photos_sub',
  },
  {
    key: 'pdf_reports',
    icon: '📄',
    titleKey: 'premium.feature_pdf_reports',
    descriptionKey: 'premium.feature_pdf_reports_sub',
  },
  {
    key: 'custom_themes',
    icon: '🎨',
    titleKey: 'premium.feature_custom_themes',
    descriptionKey: 'premium.feature_custom_themes_sub',
  },
];

// Free-tier ceiling for house photos. Premium removes the cap entirely.
export const FREE_PHOTO_LIMIT = 50;

interface EntitlementsStore {
  isPremium: boolean;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  // Future IAP layer calls this after a verified purchase/restore. Until then
  // it is only used by tests and the dev-build toggle on the premium screen.
  setPremium: (isPremium: boolean) => void;
  hasEntitlement: (feature: PremiumFeature) => boolean;
  // null means unlimited (premium); a number is the free-tier cap.
  photoLimit: () => number | null;
  canAddPhotos: (currentCount: number, adding: number) => boolean;
}

export const useEntitlementsStore = create<EntitlementsStore>()(
  devtools(
    persist(
      (set, get) => ({
        isPremium: false,
        isLoading: false,
        error: null,

        clearError: (): void => {
          set({ error: null });
        },

        setPremium: (isPremium: boolean): void => {
          set({ isPremium });
        },

        // Every known premium feature is unlocked by the single isPremium flag
        // for now. If tiered plans ever exist, this is the only place to change.
        hasEntitlement: (feature: PremiumFeature): boolean => {
          const isKnown = PREMIUM_FEATURES.some((f) => f.key === feature);
          return isKnown && get().isPremium;
        },

        photoLimit: (): number | null => {
          return get().hasEntitlement('unlimited_photos') ? null : FREE_PHOTO_LIMIT;
        },

        canAddPhotos: (currentCount: number, adding: number): boolean => {
          const limit = get().photoLimit();
          if (limit === null) return true;
          return currentCount + adding <= limit;
        },
      }),
      {
        name: 'housemates-entitlements',
        storage: createJSONStorage(() => AsyncStorage),
        version: 1,
        // Only the flag is persisted — helpers are recreated on rehydrate.
        partialize: (s) => ({ isPremium: s.isPremium }),
      }
    ),
    { name: 'entitlements-store' }
  )
);
