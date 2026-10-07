import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { font } from '@constants/typography';
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
  return (
    <View style={styles.header}>
      <View style={styles.text}>
        <Text style={[styles.eyebrow, { color: p.muted }]}>{eyebrow}</Text>
        <Text
          style={[styles.title, { color: p.text }]}
          numberOfLines={1}
          accessibilityRole="header"
        >
          {title}
        </Text>
      </View>
      <Pressable
        onPress={onClose}
        style={styles.close}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
      >
        <Ionicons name="close" size={22} color={p.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: ms(20),
    paddingTop: ms(18),
    gap: ms(8),
  },
  text: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: mf(13), ...font.medium },
  title: { fontSize: mf(22), ...font.bold, marginTop: ms(2) },
  close: {
    width: ms(44),
    height: ms(44),
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: ms(-10),
    marginTop: ms(-6),
  },
});
