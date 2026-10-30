import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useThemedColors } from '@constants/colors';
import { UserAvatar } from '@components/shared/UserAvatar';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';

interface PersonPickerProps {
  people: { id: string; name: string }[];
  /** "single": who paid (a blue ring). "multi": who shares it (a tick badge). */
  mode: 'single' | 'multi';
  selected: string[];
  onPress: (id: string) => void;
  /** Appended to the current user's name, e.g. " (Me)". */
  meId?: string;
  meSuffix?: string;
}

/** Housemates as avatar circles with their names underneath. */
export function PersonPicker({
  people,
  mode,
  selected,
  onPress,
  meId,
  meSuffix = '',
}: PersonPickerProps): React.JSX.Element {
  const c = useThemedColors();
  return (
    <View style={styles.row} accessibilityRole={mode === 'single' ? 'radiogroup' : undefined}>
      {people.map((p) => {
        const on = selected.includes(p.id);
        const name = `${p.name.split(' ')[0]}${p.id === meId ? meSuffix : ''}`;
        return (
          <Pressable
            key={p.id}
            style={({ pressed }) => [styles.person, pressed && styles.pressed]}
            onPress={() => onPress(p.id)}
            accessible
            accessibilityRole={mode === 'single' ? 'radio' : 'checkbox'}
            accessibilityLabel={`${p.name}${p.id === meId ? meSuffix : ''}`}
            accessibilityState={mode === 'single' ? { selected: on } : { checked: on }}
          >
            <View
              style={[
                styles.ring,
                { borderColor: mode === 'single' && on ? c.primary : 'transparent' },
                mode === 'multi' && !on && styles.off,
              ]}
            >
              <UserAvatar userId={p.id} size={ms(44)} />
              {mode === 'multi' && on && (
                <View
                  style={[styles.tick, { backgroundColor: c.primary, borderColor: c.background }]}
                >
                  <Ionicons name="checkmark" size={12} color="#fff" />
                </View>
              )}
            </View>
            <Text
              style={[styles.name, { color: on ? c.textPrimary : c.textSecondary }]}
              numberOfLines={1}
            >
              {name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(6) },
  person: { alignItems: 'center', width: ms(78), gap: ms(4) },
  ring: { borderWidth: 2.5, borderRadius: ms(30), padding: ms(3) },
  off: { opacity: 0.4 },
  tick: {
    position: 'absolute',
    end: -ms(2),
    bottom: -ms(2),
    width: ms(20),
    height: ms(20),
    borderRadius: ms(10),
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: mf(13), ...font.bold, maxWidth: ms(78) },
  pressed: { opacity: 0.7 },
});
