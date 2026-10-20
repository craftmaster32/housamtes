import { useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { lightColors, useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { PaperTag } from '@components/bills/recurring/PaperTag';
import { useHandFont } from '@hooks/useHandFont';
import { useHousematesStore } from '@stores/housematesStore';
import { useLanguageStore } from '@stores/languageStore';
import type { Chore } from '@stores/choresStore';
import { freqLabel } from '@utils/choreLabels';
import { resolveName } from '@utils/housemates';
import { mf, ms } from '@utils/responsive';

// Pen colours on the pad (the pad stays light in dark mode).
const INK = '#22201D';
const PEN = lightColors.primary;

export interface ChoreLineProps {
  chore: Chore;
  myId: string;
  onToggle: (id: string) => void;
  onClaim: (id: string) => void;
  onUnclaim: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * One chore on the to-do pad: a square checkbox ticked in blue pen, the name
 * (struck through once done), how often it repeats in handwriting, and who has
 * taken it — or a "Take it" tag.
 */
export function ChoreLine({
  chore,
  myId,
  onToggle,
  onClaim,
  onUnclaim,
  onDelete,
}: ChoreLineProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const hand = useHandFont();
  const language = useLanguageStore((s) => s.language);
  const housemates = useHousematesStore((s) => s.housemates);
  const claimer = chore.claimedBy ? housemates.find((h) => h.id === chore.claimedBy) : null;
  const isMineClaimed = chore.claimedBy === myId;
  const freq = freqLabel(chore, t, language);
  const done = chore.isComplete;

  const handleToggle = useCallback(() => onToggle(chore.id), [onToggle, chore.id]);
  const handleClaim = useCallback(() => onClaim(chore.id), [onClaim, chore.id]);
  const handleUnclaim = useCallback(() => onUnclaim(chore.id), [onUnclaim, chore.id]);
  const handleDelete = useCallback(() => onDelete(chore.id), [onDelete, chore.id]);

  return (
    <View style={styles.line}>
      <Pressable
        style={styles.checkHit}
        onPress={handleToggle}
        accessible
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={chore.name}
      >
        <View style={styles.box}>
          {done && (
            <Svg width={ms(26)} height={ms(26)} viewBox="0 0 26 26" style={styles.tick}>
              <Path
                d="M4 13 L10.5 20 L23 3"
                stroke={PEN}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          )}
        </View>
      </Pressable>

      <View style={styles.body}>
        <Text
          style={[styles.name, { color: done ? c.receiptMuted : INK }, done && styles.struck]}
          numberOfLines={1}
        >
          {chore.name}
        </Text>
        {!!freq && <Text style={[styles.freq, hand, { color: PEN }]}>{freq}</Text>}

        {chore.claimedBy ? (
          <View style={styles.whoRow}>
            <View style={[styles.avatar, { backgroundColor: claimer?.color ?? c.receiptMuted }]}>
              <Text style={styles.initial}>{(claimer?.name ?? '?').charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={[styles.who, { color: c.receiptMuted }]}>
              {isMineClaimed ? t('common.you') : resolveName(chore.claimedBy, housemates)}
            </Text>
            {isMineClaimed && (
              <Pressable
                onPress={handleUnclaim}
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                accessible
                accessibilityRole="button"
              >
                <Text style={[styles.drop, { color: PEN }]}>{t('chores.drop')}</Text>
              </Pressable>
            )}
          </View>
        ) : (
          !done && (
            <View style={styles.tag}>
              <PaperTag label={t('chores.take')} onPress={handleClaim} />
            </View>
          )
        )}
      </View>

      {(!chore.claimedBy || isMineClaimed) && (
        <Pressable
          onPress={handleDelete}
          style={styles.deleteHit}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`${t('common.delete')} ${chore.name}`}
        >
          <Ionicons name="close" size={17} color={c.receiptMuted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: ms(8),
    paddingStart: ms(4),
    paddingEnd: ms(4),
  },
  checkHit: { width: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
  // A square drawn in ink, a little crooked, like on a paper to-do list.
  box: {
    width: ms(24),
    height: ms(24),
    borderWidth: 2.2,
    borderColor: INK,
    borderRadius: ms(4),
    transform: [{ rotate: '-2deg' }],
  },
  tick: { position: 'absolute', left: ms(1), top: -ms(7) },
  body: { flex: 1, minWidth: 0, paddingTop: ms(10) },
  name: { fontSize: mf(16), ...font.bold },
  struck: { textDecorationLine: 'line-through', textDecorationColor: PEN },
  freq: { fontSize: mf(18), lineHeight: mf(21), marginTop: ms(1) },
  whoRow: { flexDirection: 'row', alignItems: 'center', gap: ms(8), marginTop: ms(4) },
  avatar: {
    width: ms(22),
    height: ms(22),
    borderRadius: ms(11),
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { color: '#FFFFFF', fontSize: mf(11), ...font.extrabold },
  who: { fontSize: mf(13.5), ...font.semibold },
  drop: { fontSize: mf(13.5), ...font.bold },
  tag: { alignSelf: 'flex-start', marginTop: ms(8), marginBottom: ms(4) },
  deleteHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
