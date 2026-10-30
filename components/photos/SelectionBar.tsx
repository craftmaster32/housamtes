import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { mf, ms } from '@utils/responsive';

interface SelectionBarProps {
  count: number;
  label: string;
  saving: boolean;
  deleting: boolean;
  onSave: () => void;
  onDelete: () => void;
}

interface BarActionProps {
  icon: 'download-outline' | 'trash-outline';
  label: string;
  a11yLabel: string;
  color: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}

function BarAction({
  icon,
  label,
  a11yLabel,
  color,
  busy,
  disabled,
  onPress,
}: BarActionProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.action, (disabled || pressed) && styles.dim]}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ busy, disabled }}
    >
      {busy ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Ionicons name={icon} size={25} color={color} />
      )}
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * The toolbar a phone gallery shows while picking photos: Save on one side,
 * "3 selected" in the middle, Delete on the other. Cancel lives in the header.
 */
export function SelectionBar({
  count,
  label,
  saving,
  deleting,
  onSave,
  onDelete,
}: SelectionBarProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const heading = useHeadingFont('semibold');
  const busy = saving || deleting;
  return (
    <View style={[styles.bar, { backgroundColor: c.background, borderTopColor: c.border }]}>
      <BarAction
        icon="download-outline"
        label={t('common.save')}
        a11yLabel={t('photos.download_photo')}
        color={c.primary}
        busy={saving}
        disabled={count === 0 || busy}
        onPress={onSave}
      />
      <Text
        style={[styles.label, heading, { color: c.textPrimary }]}
        accessibilityLiveRegion="polite"
      >
        {label}
      </Text>
      <BarAction
        icon="trash-outline"
        label={t('common.delete')}
        a11yLabel={t('photos.delete_selected')}
        color={c.danger}
        busy={deleting}
        disabled={count === 0 || busy}
        onPress={onDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ms(14),
    paddingVertical: ms(6),
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  action: {
    minWidth: ms(64),
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(2),
  },
  actionText: { fontSize: mf(12), ...font.semibold },
  label: { fontSize: mf(18) },
  dim: { opacity: 0.4 },
});
