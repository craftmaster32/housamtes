/**
 * QA — entitlementsStore
 *
 * Locks in the monetization-groundwork gating rules: everyone defaults to the
 * free tier, flipping isPremium unlocks every premium feature, and the photo
 * limit maths can't silently drift (it's what blocks uploads on the free plan).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useEntitlementsStore,
  PREMIUM_FEATURES,
  FREE_PHOTO_LIMIT,
} from '@stores/entitlementsStore';

beforeEach((): void => {
  useEntitlementsStore.setState({ isPremium: false, isLoading: false, error: null });
});

describe('entitlementsStore — free tier defaults', (): void => {
  it('defaults everyone to free', (): void => {
    expect(useEntitlementsStore.getState().isPremium).toBe(false);
  });

  it('locks every premium feature on the free tier', (): void => {
    const { hasEntitlement } = useEntitlementsStore.getState();
    for (const feature of PREMIUM_FEATURES) {
      expect(hasEntitlement(feature.key)).toBe(false);
    }
  });

  it('caps photos at the free limit', (): void => {
    expect(useEntitlementsStore.getState().photoLimit()).toBe(FREE_PHOTO_LIMIT);
  });
});

describe('entitlementsStore — flipping isPremium unlocks everything', (): void => {
  it('unlocks every premium feature', (): void => {
    useEntitlementsStore.getState().setPremium(true);

    const { hasEntitlement } = useEntitlementsStore.getState();
    for (const feature of PREMIUM_FEATURES) {
      expect(hasEntitlement(feature.key)).toBe(true);
    }
  });

  it('removes the photo limit', (): void => {
    useEntitlementsStore.getState().setPremium(true);

    expect(useEntitlementsStore.getState().photoLimit()).toBeNull();
  });

  it('re-locks everything when premium is turned off again', (): void => {
    useEntitlementsStore.getState().setPremium(true);
    useEntitlementsStore.getState().setPremium(false);

    const s = useEntitlementsStore.getState();
    expect(s.hasEntitlement('ad_free')).toBe(false);
    expect(s.photoLimit()).toBe(FREE_PHOTO_LIMIT);
  });
});

describe('entitlementsStore — canAddPhotos', (): void => {
  it('allows uploads under the free limit', (): void => {
    const { canAddPhotos } = useEntitlementsStore.getState();
    expect(canAddPhotos(0, 1)).toBe(true);
    expect(canAddPhotos(FREE_PHOTO_LIMIT - 1, 1)).toBe(true);
  });

  it('allows exactly reaching the free limit but not passing it', (): void => {
    const { canAddPhotos } = useEntitlementsStore.getState();
    expect(canAddPhotos(FREE_PHOTO_LIMIT - 3, 3)).toBe(true);
    expect(canAddPhotos(FREE_PHOTO_LIMIT - 3, 4)).toBe(false);
  });

  it('blocks any upload at or over the free limit', (): void => {
    const { canAddPhotos } = useEntitlementsStore.getState();
    expect(canAddPhotos(FREE_PHOTO_LIMIT, 1)).toBe(false);
    expect(canAddPhotos(FREE_PHOTO_LIMIT + 5, 1)).toBe(false);
  });

  it('never blocks premium users', (): void => {
    useEntitlementsStore.getState().setPremium(true);

    const { canAddPhotos } = useEntitlementsStore.getState();
    expect(canAddPhotos(FREE_PHOTO_LIMIT + 500, 100)).toBe(true);
  });
});

describe('entitlementsStore — paywall feature list', (): void => {
  it('advertises exactly the four planned premium features', (): void => {
    expect(PREMIUM_FEATURES.map((f) => f.key)).toEqual([
      'ad_free',
      'unlimited_photos',
      'pdf_reports',
      'custom_themes',
    ]);
  });
});

describe('entitlementsStore — rehydration', (): void => {
  it('clears isLoading and error once AsyncStorage has been read', async (): Promise<void> => {
    useEntitlementsStore.setState({ isLoading: true, error: null });

    await useEntitlementsStore.persist.rehydrate();

    const s = useEntitlementsStore.getState();
    expect(s.isLoading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('surfaces an error and still clears isLoading when rehydration fails', async (): Promise<void> => {
    useEntitlementsStore.setState({ isLoading: true, error: null });
    const getItemSpy = jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('boom'));

    await useEntitlementsStore.persist.rehydrate();

    const s = useEntitlementsStore.getState();
    expect(s.isLoading).toBe(false);
    expect(s.error).toBe('Could not load your entitlements. Please try again.');

    getItemSpy.mockRestore();
  });
});
