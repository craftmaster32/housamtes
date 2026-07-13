/**
 * QA — entitlementsStore
 *
 * Locks in the monetization-groundwork gating rules: everyone defaults to the
 * free tier, flipping isPremium unlocks every premium feature, and the photo
 * limit maths can't silently drift (it's what blocks uploads on the free plan).
 */

import {
  useEntitlementsStore,
  PREMIUM_FEATURES,
  FREE_PHOTO_LIMIT,
} from '../../stores/entitlementsStore';

beforeEach(() => {
  useEntitlementsStore.setState({ isPremium: false, isLoading: false, error: null });
});

describe('entitlementsStore — free tier defaults', () => {
  it('defaults everyone to free', () => {
    expect(useEntitlementsStore.getState().isPremium).toBe(false);
  });

  it('locks every premium feature on the free tier', () => {
    const { hasEntitlement } = useEntitlementsStore.getState();
    for (const feature of PREMIUM_FEATURES) {
      expect(hasEntitlement(feature.key)).toBe(false);
    }
  });

  it('caps photos at the free limit', () => {
    expect(useEntitlementsStore.getState().photoLimit()).toBe(FREE_PHOTO_LIMIT);
  });
});

describe('entitlementsStore — flipping isPremium unlocks everything', () => {
  it('unlocks every premium feature', () => {
    useEntitlementsStore.getState().setPremium(true);

    const { hasEntitlement } = useEntitlementsStore.getState();
    for (const feature of PREMIUM_FEATURES) {
      expect(hasEntitlement(feature.key)).toBe(true);
    }
  });

  it('removes the photo limit', () => {
    useEntitlementsStore.getState().setPremium(true);

    expect(useEntitlementsStore.getState().photoLimit()).toBeNull();
  });

  it('re-locks everything when premium is turned off again', () => {
    useEntitlementsStore.getState().setPremium(true);
    useEntitlementsStore.getState().setPremium(false);

    const s = useEntitlementsStore.getState();
    expect(s.hasEntitlement('ad_free')).toBe(false);
    expect(s.photoLimit()).toBe(FREE_PHOTO_LIMIT);
  });
});

describe('entitlementsStore — canAddPhotos', () => {
  it('allows uploads under the free limit', () => {
    const { canAddPhotos } = useEntitlementsStore.getState();
    expect(canAddPhotos(0, 1)).toBe(true);
    expect(canAddPhotos(FREE_PHOTO_LIMIT - 1, 1)).toBe(true);
  });

  it('allows exactly reaching the free limit but not passing it', () => {
    const { canAddPhotos } = useEntitlementsStore.getState();
    expect(canAddPhotos(FREE_PHOTO_LIMIT - 3, 3)).toBe(true);
    expect(canAddPhotos(FREE_PHOTO_LIMIT - 3, 4)).toBe(false);
  });

  it('blocks any upload at or over the free limit', () => {
    const { canAddPhotos } = useEntitlementsStore.getState();
    expect(canAddPhotos(FREE_PHOTO_LIMIT, 1)).toBe(false);
    expect(canAddPhotos(FREE_PHOTO_LIMIT + 5, 1)).toBe(false);
  });

  it('never blocks premium users', () => {
    useEntitlementsStore.getState().setPremium(true);

    const { canAddPhotos } = useEntitlementsStore.getState();
    expect(canAddPhotos(FREE_PHOTO_LIMIT + 500, 100)).toBe(true);
  });
});

describe('entitlementsStore — paywall feature list', () => {
  it('advertises exactly the four planned premium features', () => {
    expect(PREMIUM_FEATURES.map((f) => f.key)).toEqual([
      'ad_free',
      'unlimited_photos',
      'pdf_reports',
      'custom_themes',
    ]);
  });
});
