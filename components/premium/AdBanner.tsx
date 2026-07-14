import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useEntitlementsStore } from '@stores/entitlementsStore';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';

// The single ad slot for the whole app. Renders a clearly-labelled placeholder
// for free users and nothing at all for premium users.
//
// MONETIZATION: when AdMob goes live, replace the placeholder <View> below with
// the real <BannerAd> from react-native-google-mobile-ads — the isPremium gate
// and the slot placement (above the bottom tab bar in app/_layout.tsx) stay
// exactly as they are. See MONETIZATION.md.
export const AdBanner = (): React.JSX.Element | null => {
  const { t } = useTranslation();
  const C = useThemedColors();
  const adFree = useEntitlementsStore((s) => s.isPremium);
  const isLoading = useEntitlementsStore((s) => s.isLoading);

  // Wait for entitlements to rehydrate — otherwise a premium user briefly
  // sees the free-tier ad slot before AsyncStorage confirms isPremium.
  if (isLoading || adFree) return null;

  return (
    <View
      testID="ad-banner-placeholder"
      style={[styles.slot, { backgroundColor: C.surface, borderColor: C.border }]}
      accessible
      accessibilityLabel={t('premium.ad_label')}
    >
      <Text style={[styles.badge, { color: C.textSecondary, borderColor: C.border }]}>
        {t('premium.ad_badge')}
      </Text>
      <Text style={[styles.text, { color: C.textSecondary }]}>{t('premium.ad_label')}</Text>
    </View>
  );
};

// 50pt matches the standard AdMob anchored banner height, so the layout will
// not shift when the real ad drops in.
const styles = StyleSheet.create({
  slot: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderTopWidth: 1,
  },
  badge: {
    fontSize: 10,
    ...font.bold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  text: { fontSize: 12, ...font.regular },
});
