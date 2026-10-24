import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { mf, ms } from '@utils/responsive';

interface SelectionBarProps {
  count: number;
  label: string;
  busy: boolean;
  onCancel: () => void;
  onSave: () => void;
}

/** Bottom bar while picking prints to save: Cancel · "3 selected" · Save to Phone. */
export function SelectionBar({
  count,
  label,
  busy,
  onCancel,
  onSave,
}: SelectionBarProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const heading = useHeadingFont('semibold');
  const insets = useSafeAreaInsets();
  const off = count === 0 || busy;
  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: c.background, borderTopColor: c.border },
        { paddingBottom: Math.max(insets.bottom, ms(14)) },
      ]}
    >
      <Pressable
        onPress={onCancel}
        style={styles.cancel}
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel')}
      >
        <Text style={[styles.cancelText, { color: c.primary }]}>{t('common.cancel')}</Text>
      </Pressable>
      <Text style={[styles.label, heading, { color: c.textPrimary }]}>{label}</Text>
      <Pressable
        onPress={onSave}
        disabled={off}
        style={({ pressed }) => [
          styles.save,
          { backgroundColor: c.primary },
          (off || pressed) && styles.dim,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('photos.download_photo')}
        accessibilityState={{ busy, disabled: off }}
      >
        {busy ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.saveText}>{t('photos.download_photo')}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ms(20),
    paddingTop: ms(12),
    borderTopWidth: 1,
  },
  cancel: { minHeight: 44, justifyContent: 'center', paddingEnd: ms(8) },
  cancelText: { fontSize: mf(15), ...font.semibold },
  label: { fontSize: mf(18) },
  save: {
    minHeight: 44,
    minWidth: ms(110),
    paddingHorizontal: ms(16),
    borderRadius: ms(15),
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { fontSize: mf(14.5), ...font.semibold, color: '#FFFFFF' },
  dim: { opacity: 0.5 },
});
