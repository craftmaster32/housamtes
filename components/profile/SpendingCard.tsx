import { useEffect, useCallback } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSpendingStore } from '@stores/spendingStore';
import { useSettingsStore } from '@stores/settingsStore';
import { lightColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { NotebookPaper } from '@components/shared/NotebookPaper';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { monthNameFromKey } from '@utils/dates';
import { CountUpText } from '@components/shared/CountUpText';

import { mf, ms } from '@utils/responsive';
interface Props {
  houseId: string;
  userName: string;
}

// The notebook page keeps its light inks in both themes.
const P = lightColors;

function fmt(n: number, sym: string): string {
  if (n >= 1000) return `${sym}${(n / 1000).toFixed(1)}k`;
  return `${sym}${n.toFixed(0)}`;
}

export function SpendingCard({ houseId, userName }: Props): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const heading = useHeadingFont('semibold');
  const hand = useHandFont();
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
  const header = monthName
    ? t('spending.month_spending_header', { month: monthName })
    : t('spending.spending_label');
  const houseTotal = current?.houseTotal ?? 0;
  const myShare = current?.total ?? 0;
  const sharePct = houseTotal > 0 ? Math.round((myShare / houseTotal) * 100) : 0;

  return (
    <Pressable
      onPress={handleOpen}
      disabled={isLoading}
      accessibilityRole="button"
      accessibilityLabel={t('spending.view_spending')}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <NotebookPaper contentStyle={styles.pad}>
        <Text style={[styles.label, hand]}>{header}</Text>
        {isLoading ? (
          <ActivityIndicator color={P.paperMuted} size="small" style={styles.loading} />
        ) : (
          <>
            <View style={styles.totalsRow}>
              <View style={styles.totalBlock}>
                <CountUpText
                  style={[styles.totalAmt, heading]}
                  value={houseTotal}
                  format={(n) => fmt(n, currency)}
                />
                <Text style={styles.totalSub}>{t('spending.house_total')}</Text>
              </View>
              <View style={styles.totalBlock}>
                <CountUpText
                  style={[styles.totalAmt, heading, styles.mine]}
                  value={myShare}
                  format={(n) => fmt(n, currency)}
                />
                <Text style={styles.totalSub}>
                  {sharePct > 0
                    ? t('spending.your_share_with_pct', { percent: sharePct })
                    : t('spending.your_share')}
                </Text>
              </View>
            </View>

            {/* The AI note, written in the margin in pencil. */}
            {insightLoading ? (
              <ActivityIndicator color={P.paperMuted} size="small" style={styles.loading} />
            ) : insight ? (
              <Text style={[styles.insight, hand]} numberOfLines={3}>
                {insight}
              </Text>
            ) : insightError ? (
              <Text style={[styles.insightMuted, hand]} numberOfLines={1}>
                {t('spending.ai_unavailable')}
              </Text>
            ) : null}

            <View style={styles.ctaRow}>
              <Text style={styles.ctaText}>{t('spending.full_analysis')}</Text>
              <Ionicons
                name={rtl ? 'chevron-back' : 'chevron-forward'}
                size={14}
                color={P.primary}
              />
            </View>
          </>
        )}
      </NotebookPaper>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  pad: { gap: ms(10) },
  loading: { alignSelf: 'flex-start', marginVertical: ms(6) },
  label: { fontSize: mf(20), lineHeight: mf(24), color: P.paperMuted },
  totalsRow: { flexDirection: 'row', gap: ms(16) },
  totalBlock: { flex: 1, gap: ms(1) },
  totalAmt: { fontSize: mf(30), lineHeight: mf(38), color: P.paperInk, letterSpacing: -0.6 },
  mine: { color: P.primary },
  totalSub: { fontSize: mf(12.5), ...font.medium, color: P.paperMuted },
  insight: { fontSize: mf(18), lineHeight: mf(22), color: P.paperInk },
  insightMuted: { fontSize: mf(17), color: P.paperMuted },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: ms(4), alignSelf: 'flex-end' },
  ctaText: { fontSize: mf(13.5), ...font.semibold, color: P.primary },
});
