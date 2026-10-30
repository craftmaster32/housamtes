import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { mf, ms } from '@utils/responsive';

interface ViewerTopBarProps {
  /** "Today", "Yesterday" or the date the photo was added. */
  title: string;
  /** Who added it and when, e.g. "Maya · 14:48". */
  subtitle: string;
  topInset: number;
  onClose: () => void;
}

/** Close button with the photo's day as a serif title and who added it beneath. */
export function ViewerTopBar({
  title,
  subtitle,
  topInset,
  onClose,
}: ViewerTopBarProps): React.JSX.Element {
  const { t } = useTranslation();
  const heading = useHeadingFont('semibold');
  return (
    <View style={[styles.bar, { paddingTop: topInset }]} pointerEvents="box-none">
      <Pressable
        style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        hitSlop={8}
      >
        <Ionicons name="chevron-down" size={24} color="#FFFFFF" />
      </Pressable>
      <View style={styles.titles} pointerEvents="none">
        <Text style={[styles.title, heading]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {/* Balances the close button so the title sits in the true middle. */}
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(14),
    paddingBottom: ms(28),
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: 'rgba(255,255,255,0.28)' },
  titles: { flex: 1, alignItems: 'center', paddingHorizontal: ms(8) },
  title: { color: '#FFFFFF', fontSize: mf(19), lineHeight: mf(25) },
  subtitle: { color: 'rgba(255,255,255,0.72)', fontSize: mf(13), ...font.medium, marginTop: 1 },
  spacer: { width: 44 },
});
