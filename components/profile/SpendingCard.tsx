import { useEffect, useCallback } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSpendingStore } from '@stores/spendingStore';
import { useSettingsStore } from '@stores/settingsStore';
import { colors } from '@constants/colors';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';

interface Props {
  houseId: string;
  userName: string;
}

function fmt(n: number, sym: string): string {
  if (n >= 1000) return `${sym}${(n / 1000).toFixed(1)}k`;
  return `${sym}${n.toFixed(0)}`;
}

export function SpendingCard({ houseId, userName }: Props): React.JSX.Element {
  const months         = useSpendingStore((s) => s.months);
  const isLoading      = useSpendingStore((s) => s.isLoading);
  const insight        = useSpendingStore((s) => s.insight);
  const insightError   = useSpendingStore((s) => s.insightError);
  const insightLoading = useSpendingStore((s) => s.insightLoading);
  const load           = useSpendingStore((s) => s.load);
  const fetchInsight   = useSpendingStore((s) => s.fetchInsight);
  const currency       = useSettingsStore((s) => s.currency);

  useEffect(() => {
    if (houseId && userName) load(houseId, userName);
  }, [houseId, userName, load]);

  useEffect(() => {
    if (months.length && houseId) fetchInsight(houseId, userName, currency);
  }, [months, houseId, userName, currency, fetchInsight]);

  const handleOpen = useCallback(() => {
    router.push('/(tabs)/profile/spending');
  }, []);

  const current  = months[0];
  const monthLabel = current?.label.split(' ')[0].toUpperCase() ?? 'THIS MONTH';

  if (isLoading) {
    return (
      <View style={styles.card}>
        <View style={styles.decoCircle} />
        <View style={styles.pad}>
          <Text style={styles.label}>{monthLabel} SPENDING</Text>
          <ActivityIndicator color={colors.white} size="small" style={{ marginTop: 8 }} />
        </View>
      </View>
    );
  }

  const houseTotal = current?.houseTotal ?? 0;
  const myShare    = current?.total ?? 0;
  const sharePct   = houseTotal > 0 ? Math.round((myShare / houseTotal) * 100) : 0;

  return (
    <Pressable
      style={styles.card}
      onPress={handleOpen}
      accessible
      accessibilityRole="button"
      accessibilityLabel="View full spending analysis"
    >
      <View style={styles.decoCircle} />
      <View style={styles.decoCircleSm} />

      <View style={styles.pad}>
        {/* Header */}
        <Text style={styles.label}>{monthLabel} SPENDING</Text>

        {/* House total */}
        <View style={styles.totalsRow}>
          <View style={styles.totalBlock}>
            <Text style={styles.totalAmt}>{fmt(houseTotal, currency)}</Text>
            <Text style={styles.totalSub}>House total</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.totalBlock}>
            <Text style={styles.totalAmt}>{fmt(myShare, currency)}</Text>
            <Text style={styles.totalSub}>Your share {sharePct > 0 ? `(${sharePct}%)` : ''}</Text>
          </View>
        </View>

        {/* AI insight */}
        <View style={styles.insightRow}>
          {insightLoading ? (
            <ActivityIndicator color="rgba(255,255,255,0.7)" size="small" />
          ) : insight ? (
            <>
              <Text style={styles.insightIcon}>✨</Text>
              <Text style={styles.insightText} numberOfLines={2}>{insight}</Text>
            </>
          ) : insightError ? (
            <>
              <Ionicons name="warning-outline" size={14} color="rgba(255,255,255,0.74)" />
              <Text style={styles.insightText} numberOfLines={1}>AI insight unavailable</Text>
            </>
          ) : null}
        </View>

        {/* CTA */}
        <View style={styles.ctaRow}>
          <Text style={styles.ctaText}>Full analysis</Text>
          <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.80)" />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primary,
    borderRadius: sizes.borderRadiusLg,
    overflow: 'hidden',
  },
  decoCircle: {
    position: 'absolute',
    top: -36,
    right: -18,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  decoCircleSm: {
    position: 'absolute',
    bottom: -40,
    right: 22,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  pad: { padding: 22, gap: 16 },

  label: {
    fontSize: 11,
    ...font.extrabold,
    color: colors.white,
    letterSpacing: 1.1,
    opacity: 0.88,
  },

  totalsRow: { flexDirection: 'row', alignItems: 'center', gap: sizes.md },
  totalBlock: { flex: 1, gap: 2 },
  totalAmt: { fontSize: 28, ...font.extrabold, color: colors.white, letterSpacing: -0.8 },
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
