import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { mf, ms } from '@utils/responsive';
import { useRecurringPalette } from './palette';

interface SheetHeaderProps {
  eyebrow: string; // small line above, e.g. "Log payment"
  title: string; // large line, e.g. the bill name
  onClose: () => void;
}

/** Bottom-sheet header: small label, large title and a close (X) button. */
export function SheetHeader({ eyebrow, title, onClose }: SheetHeaderProps): React.JSX.Element {
  const { t } = useTranslation();
  const p = useRecurringPalette();
  const headingFont = useHeadingFont('semibold');
  return (
    <View>
      <View style={[styles.grab, { backgroundColor: p.border }]} />
      <View style={styles.header}>
        <View style={styles.text}>
          <Text style={[styles.eyebrow, { color: p.muted }]}>{eyebrow}</Text>
          <Text
            style={[styles.title, headingFont, { color: p.text }]}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {title}
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [
            styles.close,
            { backgroundColor: p.card },
            pressed && styles.pressed,
          ]}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <Ionicons name="close" size={22} color={p.muted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grab: {
    width: ms(40),
    height: ms(5),
    borderRadius: ms(3),
    alignSelf: 'center',
    marginTop: ms(10),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: ms(20),
    paddingTop: ms(12),
    gap: ms(8),
  },
  text: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: mf(13.5), ...font.bold },
  title: { fontSize: mf(26), letterSpacing: -0.5, marginTop: ms(2) },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
});
