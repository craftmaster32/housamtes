import { useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { PersonPicker } from '@components/bills/form/PersonPicker';
import { useHousematesStore } from '@stores/housematesStore';
import { mf, ms } from '@utils/responsive';

interface AssignPickerProps {
  /** Who the task is for, or null for nobody. */
  assignedTo: string | null;
  onChange: (userId: string | null) => void;
  myId: string;
}

/**
 * "Assign to": a dashed "Nobody" circle, then the housemates as avatar circles
 * (you shown as "Me"). The chosen one gets the blue ring.
 */
export function AssignPicker({ assignedTo, onChange, myId }: AssignPickerProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const housemates = useHousematesStore((s) => s.housemates);
  const people = useMemo(
    () =>
      housemates.map((h) => ({ id: h.id, name: h.id === myId ? t('tasks.assign_me') : h.name })),
    [housemates, myId, t]
  );
  const nobody = assignedTo === null;

  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      <Pressable
        style={({ pressed }) => [styles.person, pressed && styles.pressed]}
        onPress={() => onChange(null)}
        accessible
        accessibilityRole="radio"
        accessibilityLabel={t('tasks.assign_nobody')}
        accessibilityState={{ selected: nobody }}
      >
        <View style={[styles.ring, { borderColor: nobody ? c.primary : 'transparent' }]}>
          <View style={[styles.nobody, { borderColor: c.textTertiary }]}>
            <Ionicons name="remove" size={18} color={c.textSecondary} />
          </View>
        </View>
        <Text
          style={[styles.name, { color: nobody ? c.textPrimary : c.textSecondary }]}
          numberOfLines={1}
        >
          {t('tasks.assign_nobody')}
        </Text>
      </Pressable>
      <PersonPicker
        people={people}
        mode="single"
        selected={assignedTo ? [assignedTo] : []}
        onPress={(id) => onChange(id)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(6) },
  // Same box as a PersonPicker person, so "Nobody" lines up with the avatars.
  person: { alignItems: 'center', width: ms(78), gap: ms(4) },
  ring: { borderWidth: 2.5, borderRadius: ms(30), padding: ms(3) },
  nobody: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: mf(13), ...font.bold, maxWidth: ms(78) },
  pressed: { opacity: 0.7 },
});
