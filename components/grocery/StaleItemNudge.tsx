import { useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors, darkColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';

export interface StaleItemNudgeProps {
  itemName: string;
  /** Whole days the item has been waiting. */
  days: number;
  onKeep: () => void;
  onRemove: () => void;
}

/** "Coriander has been here 48 days. Still need it?" with Keep / Take it off. */
export function StaleItemNudge({
  itemName,
  days,
  onKeep,
  onRemove,
}: StaleItemNudgeProps): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const isDark = C.background === darkColors.background;
  const s = useMemo(() => makeStyles(C, isDark), [C, isDark]);

  return (
    <View style={s.card} accessibilityRole="alert">
      <View style={s.textRow}>
        <Ionicons name="time-outline" size={18} color={s.ink.color} />
        <Text style={[s.text, s.ink]}>
          <Text style={s.bold}>{itemName}</Text> {t('grocery.stale_nudge_body', { count: days })}
        </Text>
      </View>
      <View style={s.actions}>
        <Pressable
          style={({ pressed }) => [s.btn, s.btnKeep, pressed && s.pressed]}
          onPress={onKeep}
          accessibilityRole="button"
          accessibilityLabel={t('grocery.stale_keep_a11y', { name: itemName })}
        >
          <Text style={[s.btnText, s.ink]}>{t('grocery.stale_keep')}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [s.btn, s.btnRemove, pressed && s.pressed]}
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={t('grocery.stale_remove_a11y', { name: itemName })}
        >
          <Text style={[s.btnText, s.btnRemoveText]}>{t('grocery.stale_remove')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(C: ColorTokens, isDark: boolean) {
  const ink = isDark ? '#F1D49A' : '#5E3F08';
  return StyleSheet.create({
    card: {
      backgroundColor: isDark ? 'rgba(224,178,77,0.12)' : '#FFF6E5',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(224,178,77,0.35)' : '#F0DDB4',
      borderRadius: ms(20),
      paddingVertical: ms(14),
      paddingHorizontal: ms(16),
      gap: ms(10),
      marginBottom: ms(18),
    },
    textRow: { flexDirection: 'row', alignItems: 'center', gap: ms(10) },
    text: { flex: 1, fontSize: mf(14), ...font.regular, lineHeight: mf(20) },
    ink: { color: ink },
    bold: { ...font.bold },
    actions: { flexDirection: 'row', gap: ms(8), paddingStart: ms(28) },
    btn: {
      minHeight: ms(40),
      paddingHorizontal: ms(16),
      borderRadius: ms(20),
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnKeep: {
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(224,178,77,0.4)' : '#E2C88F',
    },
    btnRemove: { backgroundColor: isDark ? '#B68528' : '#8A5A0B' },
    btnText: { fontSize: mf(13), ...font.semibold },
    btnRemoveText: { color: '#FFFFFF' },
    pressed: { opacity: 0.8 },
  });
}
