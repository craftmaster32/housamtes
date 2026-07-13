import { useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';

interface PremiumUpsellProps {
  // Override the default pitch, e.g. "You've reached the free photo limit".
  title?: string;
  body?: string;
}

// Reusable "unlock with Premium" card. Drop it anywhere a free-tier user hits
// a premium boundary (photo limit, PDF export, custom themes) — it routes to
// the upgrade screen, which owns all the plan details.
export const PremiumUpsell: React.FC<PremiumUpsellProps> = ({ title, body }) => {
  const { t } = useTranslation();
  const C = useThemedColors();

  const handlePress = useCallback((): void => {
    router.push('/(tabs)/settings/premium');
  }, []);

  return (
    <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.primary + '55' }]}>
      <View style={[styles.iconWrap, { backgroundColor: C.primary + '18' }]}>
        <Ionicons name="sparkles" size={22} color={C.primary} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.title, { color: C.textPrimary }]}>
          {title ?? t('premium.upsell_title')}
        </Text>
        <Text style={[styles.body, { color: C.textSecondary }]}>
          {body ?? t('premium.upsell_body')}
        </Text>
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: C.primary, opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={handlePress}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('premium.see_premium')}
      >
        <Text style={styles.buttonText}>{t('premium.see_premium')}</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sizes.md,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: sizes.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  title: { fontSize: 15, ...font.semibold },
  body: { fontSize: 13, ...font.regular, marginTop: 2 },
  button: {
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 14, ...font.semibold, color: '#fff' },
});
