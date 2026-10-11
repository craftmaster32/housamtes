import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { useMemberName } from '@hooks/useMemberName';
import { formatItemAge, isItemStale } from '@utils/groceryAge';
import { mf, ms } from '@utils/responsive';

export interface ItemAgeMetaProps {
  addedBy: string;
  createdAt: string;
  myId: string;
  /** Private items are always yours, so the name is left out. */
  showName: boolean;
  /** Ticked items are already handled — no "waiting a while" warning. */
  isChecked: boolean;
}

/**
 * One quiet line under a grocery item: "Dana · 2d ago". Once an item has been
 * waiting 3+ days the age sits in a soft amber pill with a small clock, so
 * stale items stand out without adding extra rows.
 */
export function ItemAgeMeta({
  addedBy,
  createdAt,
  myId,
  showName,
  isChecked,
}: ItemAgeMetaProps): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const s = useMemo(() => makeStyles(C), [C]);
  const memberName = useMemberName();

  const age = formatItemAge(createdAt, t);
  const stale = !isChecked && isItemStale(createdAt);
  const name = addedBy === myId ? t('common.you') : memberName(addedBy);

  return (
    <View style={s.row}>
      {showName && (
        <Text style={s.text} numberOfLines={1}>
          {name}
          <Text style={s.dot}>{'  ·  '}</Text>
        </Text>
      )}
      {stale ? (
        <View style={s.stalePill}>
          <Ionicons name="time-outline" size={12} color={C.warning} />
          <Text style={s.staleText} numberOfLines={1}>
            {age}
          </Text>
        </View>
      ) : (
        <Text style={s.text} numberOfLines={1}>
          {age}
        </Text>
      )}
    </View>
  );
}

function makeStyles(C: ColorTokens): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: ms(3), minWidth: 0 },
    text: { fontSize: mf(12), ...font.medium, color: C.textSecondary, flexShrink: 1 },
    dot: { color: C.border },
    stalePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(3),
      paddingHorizontal: ms(6),
      paddingVertical: ms(1),
      borderRadius: ms(8),
      backgroundColor: C.warningTint,
      flexShrink: 0,
    },
    // Dark text on the tint keeps 4.5:1 contrast; the amber lives in the icon.
    staleText: { fontSize: mf(12), ...font.semibold, color: C.textPrimary },
  });
}
