import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { ListCardsArt } from '@components/grocery/art/ListCardsArt';
import { mf, ms } from '@utils/responsive';

interface SavedListsTileProps {
  count: number;
  onPress: () => void;
}

/** Glanceable tile: "Saved Lists", how many, and a stack of index cards. Opens the lists. */
export function SavedListsTile({ count, onPress }: SavedListsTileProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const heading = useHeadingFont('semibold');
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: c.surface },
        pressed && styles.pressed,
      ]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={t('grocery.saved_lists_count', { count })}
    >
      <Text style={[styles.label, { color: c.textSecondary }]}>{t('grocery.saved_lists')}</Text>
      <Text style={[styles.big, heading, { color: c.textPrimary }]}>{count}</Text>
      <View style={styles.art} pointerEvents="none">
        <ListCardsArt size={ms(58)} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: ms(150),
    borderRadius: ms(22),
    paddingTop: ms(13),
    paddingHorizontal: ms(14),
    overflow: 'hidden',
  },
  label: { fontSize: mf(13), ...font.bold },
  big: { fontSize: mf(40), lineHeight: mf(48), marginTop: ms(4) },
  art: { position: 'absolute', end: ms(10), bottom: ms(10) },
  pressed: { opacity: 0.75 },
});
