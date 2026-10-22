import { useState } from 'react';
import {
  Platform,
  View,
  StyleSheet,
  TextInput,
  type KeyboardTypeOptions,
  type ReturnKeyTypeOptions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';

interface UnderlineInputProps {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  /** Small text after the input, e.g. "%". */
  suffix?: string;
  accessibilityLabel: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  returnKeyType?: ReturnKeyTypeOptions;
  /** Called when the keyboard's return / done key is pressed. */
  onSubmitEditing?: () => void;
}

/** A form field written on a line, like filling in a paper form. */
export function UnderlineInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline = false,
  suffix,
  accessibilityLabel,
  accessibilityHint,
  style,
  returnKeyType,
  onSubmitEditing,
}: UnderlineInputProps): React.JSX.Element {
  const c = useThemedColors();
  const [focused, setFocused] = useState(false);
  return (
    <View style={style}>
      {!!label && <Text style={[styles.label, { color: c.textSecondary }]}>{label}</Text>}
      <View
        style={[
          styles.line,
          { borderBottomColor: focused ? c.primary : c.border },
          focused && styles.lineFocused,
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.textTertiary}
          keyboardType={keyboardType}
          multiline={multiline}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          underlineColorAndroid="transparent"
          style={[styles.input, { color: c.textPrimary }]}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
        />
        {!!suffix && <Text style={[styles.suffix, { color: c.textSecondary }]}>{suffix}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: mf(13.5), ...font.bold, marginBottom: ms(2) },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    borderBottomWidth: 1.5,
  },
  lineFocused: { borderBottomWidth: 2 },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: mf(17),
    ...font.semibold,
    paddingVertical: ms(8),
    paddingHorizontal: 0,
    // The line is the focus cue (it turns blue); on web, drop the browser's own box.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  suffix: { fontSize: mf(16), ...font.semibold, marginStart: ms(4) },
});
