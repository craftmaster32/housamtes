import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useHousematesStore } from '@stores/housematesStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { UserAvatar } from '@components/shared/UserAvatar';
import { mf, ms } from '@utils/responsive';

const MAX_FACES = 4;

export interface GroceryHeaderProps {
  /** Unticked items still waiting to be bought. */
  toGrabCount: number;
  /** Items added since midnight, by anyone. */
  addedTodayCount: number;
}

/** "Groceries" title, a one-line summary of the list, and the household's faces. */
export function GroceryHeader({
  toGrabCount,
  addedTodayCount,
}: GroceryHeaderProps): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const s = useMemo(() => makeStyles(C), [C]);
  const headingFont = useHeadingFont('bold');
  const housemates = useHousematesStore((st) => st.housemates);
  const faces = housemates.slice(0, MAX_FACES);

  const summary =
    toGrabCount === 0
      ? t('grocery.header_all_caught_up')
      : [
          t('grocery.header_to_grab', { count: toGrabCount }),
          addedTodayCount > 0 ? t('grocery.header_added_today', { count: addedTodayCount }) : null,
        ]
          .filter(Boolean)
          .join(' · ');

  return (
    <View style={s.row}>
      <View style={s.copy}>
        <Text style={[s.title, headingFont]} accessibilityRole="header">
          {t('grocery.header_title')}
        </Text>
        <Text style={s.summary}>{summary}</Text>
      </View>
      {faces.length > 0 && (
        <View
          style={s.faces}
          accessible
          accessibilityLabel={t('grocery.header_members', {
            names: housemates.map((h) => h.name).join(', '),
          })}
        >
          {faces.map((h, i) => (
            <View key={h.id} style={[s.face, i > 0 && s.faceOverlap]}>
              <UserAvatar userId={h.id} size={ms(30)} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function makeStyles(C: ColorTokens): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: ms(12),
      paddingTop: ms(6),
      paddingBottom: ms(14),
    },
    copy: { flex: 1, gap: ms(4) },
    title: { fontSize: mf(32), color: C.textPrimary, letterSpacing: -0.5, lineHeight: mf(38) },
    summary: { fontSize: mf(14), ...font.medium, color: C.textSecondary, lineHeight: mf(20) },
    faces: { flexDirection: 'row', alignItems: 'center' },
    face: { borderRadius: ms(18), borderWidth: 2, borderColor: C.background },
    faceOverlap: { marginStart: ms(-10) },
  });
}
