import { useEffect, useCallback } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from 'react-native-paper';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSpendingStore } from '@stores/spendingStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { monthNameFromKey } from '@utils/dates';

interface Props {
  houseId: string;
  userName: string;
}

function fmt(n: number, sym: string): string {
  if (n >= 1000) return `${sym}${(n / 1000).toFixed(1)}k`;
  return `${sym}${n.toFixed(0)}`;
}

export function SpendingCard({ houseId, userName }: Props): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const c = useThemedColors();
  const language = useLanguageStore((s) => s.language);
  const rtl = isRTL(language);
  const months = useSpendingStore((s) => s.months);
  const isLoading = useSpendingStore((s) => s.isLoading);
  const insight = useSpendingStore((s) => s.insight);
  const insightError = useSpendingStore((s) => s.insightError);
  const insightLoading = useSpendingStore((s) => s.insightLoading);
  const load = useSpendingStore((s) => s.load);
  const fetchInsight = useSpendingStore((s) => s.fetchInsight);
  const currency = useSettingsStore((s) => s.currency);

  useEffect(() => {
    if (houseId && userName) load(houseId, userName);
  }, [houseId, userName, load]);

  useEffect(() => {
    if (months.length && houseId) fetchInsight(houseId, userName, currency);
  }, [months, houseId, userName, currency, fetchInsight]);

  const handleOpen = useCallback(() => {
    router.push('/(tabs)/profile/spending');
  }, []);

  const current = months[0];
  const monthName = current ? monthNameFromKey(current.month, i18n.language) : '';

  if (isLoading) {
    return (
      <View style={[styles.card, { shadowColor: c.spendShadow }]}>
        <LinearGradient
          colors={c.spendGradient}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.decoCircle} />
        <View style={styles.pad}>
          <Text style={styles.label}>
            {monthName
              ? t('spending.month_spending_header', { month: monthName })
              : t('spending.spending_label')}
          </Text>
          <ActivityIndicator color="#fff" size="small" style={styles.loadingIndicator} />
        </View>
      </View>
    );
  }

  const houseTotal = current?.houseTotal ?? 0;
  const myShare = current?.total ?? 0;
  const sharePct = houseTotal > 0 ? Math.round((myShare / houseTotal) * 100) : 0;

  return (
    <Pressable
      style={[styles.card, { shadowColor: c.spendShadow }]}
      onPress={handleOpen}
      accessible
      accessibilityRole="button"
      accessibilityLabel={t('spending.view_spending')}
    >
      <LinearGradient
        colors={c.spendGradient}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.decoCircle} />
      <View style={styles.decoCircleSm} />

      <View style={styles.pad}>
        {/* Header */}
        <Text style={styles.label}>
          {monthName
            ? t('spending.month_spending_header', { month: monthName })
            : t('spending.spending_label')}
        </Text>

        {/* House total */}
        <View style={styles.totalsRow}>
          <View style={styles.totalBlock}>
            <Text style={styles.totalAmt}>{fmt(houseTotal, currency)}</Text>
            <Text style={styles.totalSub}>{t('spending.house_total')}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.totalBlock}>
            <Text style={styles.totalAmt}>{fmt(myShare, currency)}</Text>
            <Text style={styles.totalSub}>
              {sharePct > 0
                ? t('spending.your_share_with_pct', { percent: sharePct })
                : t('spending.your_share')}
            </Text>
          </View>
        </View>

        {/* AI insight */}
        <View style={styles.insightRow}>
          {insightLoading ? (
            <ActivityIndicator color="rgba(255,255,255,0.7)" size="small" />
          ) : insight ? (
            <>
              <Text style={styles.insightIcon}>✨</Text>
              <Text style={styles.insightText} numberOfLines={2}>
                {insight}
              </Text>
            </>
          ) : insightError ? (
            <>
              <Ionicons name="warning-outline" size={14} color="rgba(255,255,255,0.74)" />
              <Text style={styles.insightText} numberOfLines={1}>
                {t('spending.ai_unavailable')}
              </Text>
            </>
          ) : null}
        </View>

        {/* CTA */}
        <View style={styles.ctaRow}>
          <Text style={styles.ctaText}>{t('spending.full_analysis')}</Text>
          <Ionicons
            name={rtl ? 'chevron-back' : 'chevron-forward'}
            size={14}
            color="rgba(255,255,255,0.80)"
          />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: sizes.borderRadiusXl,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 8,
  },
  decoCircle: {
    position: 'absolute',
    top: -36,
    end: -18,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  decoCircleSm: {
    position: 'absolute',
    bottom: -40,
    end: 22,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  pad: { padding: 22, gap: 16 },
  loadingIndicator: { marginTop: 8 },

  label: {
    fontSize: 11,
    ...font.extrabold,
    color: '#fff',
    letterSpacing: 1.1,
    opacity: 0.88,
  },

  totalsRow: { flexDirection: 'row', alignItems: 'center', gap: sizes.md },
  totalBlock: { flex: 1, gap: 2 },
  totalAmt: { fontSize: 28, ...font.extrabold, color: '#fff', letterSpacing: -0.8 },
  totalSub: { fontSize: 12, ...font.regular, color: 'rgba(255,255,255,0.72)' },
  divider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.20)' },

  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    minHeight: 34,
  },
  insightIcon: { fontSize: 14, marginTop: 1 },
  insightText: {
    flex: 1,
    fontSize: 13,
    ...font.regular,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 18,
  },

  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
  },
  ctaText: { fontSize: 13, ...font.semibold, color: 'rgba(255,255,255,0.80)' },
});
