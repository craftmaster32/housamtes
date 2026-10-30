import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@stores/settingsStore';
import { useLanguageStore } from '@stores/languageStore';
import { useMemberName } from '@hooks/useMemberName';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { isRTL } from '@lib/i18n';
import { useThemedColors } from '@constants/colors';
import { formatFull } from '@constants/currencies';
import { font, heading } from '@constants/typography';
import { Money } from '@components/shared/Money';
import { NotebookPaper } from '@components/shared/NotebookPaper';
import { mf, ms } from '@utils/responsive';

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

interface BalancePaperProps {
  settled: boolean;
  isOwed: boolean;
  net: number;
  peopleCount: number;
  settlements: Settlement[];
  myId: string;
  avatarById: Map<string, string | undefined>;
  showSettle: boolean;
  onToggleSettle: () => void;
}

function Avatar({
  name,
  uri,
  color,
}: {
  name: string;
  uri?: string;
  color: string;
}): React.JSX.Element {
  return (
    <View style={[styles.av, { backgroundColor: color }]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.avImg}
          contentFit="cover"
          accessible
          accessibilityLabel={name}
        />
      ) : (
        <Text style={styles.avText}>{name[0]?.toUpperCase() ?? '?'}</Text>
      )}
    </View>
  );
}

// "You're owed ₪142.50", written on the same notebook page as the home card.
// The settle-up plan is jotted underneath in handwriting.
export function BalancePaper({
  settled,
  isOwed,
  net,
  peopleCount,
  settlements,
  myId,
  avatarById,
  showSettle,
  onToggleSettle,
}: BalancePaperProps): React.JSX.Element {
  const c = useThemedColors();
  const { t } = useTranslation();
  const headingFont = useHeadingFont('semibold');
  const handFont = useHandFont();
  const rtl = isRTL(useLanguageStore((s) => s.language));
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const memberName = useMemberName();

  return (
    <NotebookPaper>
      {settled ? (
        <View style={styles.settledRow}>
          <View style={styles.flex1}>
            <Text style={[styles.settledTitle, headingFont, { color: c.paperInk }]}>
              {t('bills.all_settled_tag')}
            </Text>
            <Text style={[styles.sub, { color: c.paperMuted }]}>{t('bills.everyone_settled')}</Text>
          </View>
          <View style={[styles.round, { backgroundColor: c.success }]}>
            <Ionicons name="checkmark" size={22} color="#fff" />
          </View>
        </View>
      ) : (
        <>
          <View style={styles.topRow}>
            <Text style={[styles.label, { color: c.paperMuted }]}>
              {isOwed ? t('bills.you_are_owed') : t('bills.you_owe')}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.round, styles.chart, pressed && styles.pressed]}
              onPress={() => router.push('/(tabs)/profile/spending')}
              accessibilityRole="button"
              accessibilityLabel={t('spending.view_spending')}
            >
              <Ionicons name="stats-chart-outline" size={18} color={c.paperMuted} />
            </Pressable>
          </View>
          <Money
            amount={Math.abs(net)}
            currencyCode={currencyCode}
            size={ms(56)}
            color={c.paperInk}
            mutedColor={c.paperMuted}
            wholeFamily={heading.semibold.fontFamily}
            style={styles.amount}
          />
          <Text style={[styles.sub, { color: c.paperMuted }]}>
            {peopleCount === 1
              ? t('bills.net_across', { count: peopleCount })
              : t('bills.net_across_plural', { count: peopleCount })}
          </Text>
        </>
      )}

      {settlements.length > 0 && (
        <View style={styles.settle}>
          <Pressable
            style={({ pressed }) => [styles.settleHead, pressed && styles.pressed]}
            onPress={onToggleSettle}
            accessibilityRole="button"
            accessibilityLabel={t('bills.toggle_settle')}
            accessibilityState={{ expanded: showSettle }}
          >
            <Text style={[styles.settleTitle, handFont, { color: c.paperInk }]}>
              {t('bills.settle_up')}
            </Text>
            <Text style={[styles.settleSub, { color: c.paperMuted }]} numberOfLines={1}>
              {showSettle
                ? t('bills.min_transfers')
                : settlements.length === 1
                  ? t('bills.n_transfers', { count: settlements.length })
                  : t('bills.n_transfers_plural', { count: settlements.length })}
            </Text>
            <Ionicons
              name={showSettle ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={c.paperMuted}
            />
          </Pressable>

          {showSettle &&
            settlements.map((s, idx) => {
              const fromIsMe = s.from === myId;
              const toIsMe = s.to === myId;
              const fromName = fromIsMe ? t('bills.you_label') : memberName(s.from).split(' ')[0];
              const toName = toIsMe ? t('bills.you_label') : memberName(s.to).split(' ')[0];
              const amtColor = toIsMe ? c.success : fromIsMe ? c.danger : c.paperInk;
              return (
                <View key={idx} style={styles.xfer}>
                  <Avatar name={fromName} uri={avatarById.get(s.from)} color={c.primary} />
                  <Text
                    style={[styles.xferName, handFont, { color: c.paperInk }]}
                    numberOfLines={1}
                  >
                    {fromName}
                  </Text>
                  <Ionicons
                    name={rtl ? 'arrow-back' : 'arrow-forward'}
                    size={16}
                    color={c.paperMuted}
                  />
                  <Text
                    style={[styles.xferName, handFont, { color: c.paperInk }]}
                    numberOfLines={1}
                  >
                    {toName}
                  </Text>
                  <Text style={[styles.xferAmt, headingFont, { color: amtColor }]}>
                    {formatFull(s.amount, currencyCode)}
                  </Text>
                </View>
              );
            })}
        </View>
      )}
    </NotebookPaper>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: mf(16), ...font.bold },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chart: { backgroundColor: 'rgba(34,32,29,0.06)' },
  // Isolate money to LTR so digits/symbol don't bidi-reorder under Hebrew/RTL.
  amount: { marginTop: ms(2), writingDirection: 'ltr' },
  sub: { fontSize: mf(15), ...font.medium, lineHeight: mf(21), marginTop: ms(6) },
  settledRow: { flexDirection: 'row', alignItems: 'center', gap: ms(12) },
  settledTitle: { fontSize: mf(24), letterSpacing: -0.4 },
  settle: { marginTop: ms(10) },
  settleHead: { flexDirection: 'row', alignItems: 'center', gap: ms(8), minHeight: 44 },
  settleTitle: { fontSize: mf(25) },
  settleSub: { flex: 1, fontSize: mf(13.5), ...font.semibold },
  xfer: { flexDirection: 'row', alignItems: 'center', gap: ms(8), minHeight: ms(36) },
  xferName: { fontSize: mf(23), maxWidth: ms(90) },
  xferAmt: { marginStart: 'auto', fontSize: mf(17), writingDirection: 'ltr' },
  av: {
    width: ms(22),
    height: ms(22),
    borderRadius: ms(11),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avImg: { width: ms(22), height: ms(22) },
  avText: { fontSize: mf(11), ...font.extrabold, color: '#fff' },
  pressed: { opacity: 0.75 },
});
