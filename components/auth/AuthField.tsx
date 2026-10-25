import { forwardRef, useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';

type FocusHandler = NonNullable<TextInputProps['onFocus']>;
type BlurHandler = NonNullable<TextInputProps['onBlur']>;

export interface AuthFieldProps extends Omit<TextInputProps, 'style' | 'secureTextEntry'> {
  label: string;
  accessibilityLabel: string;
  /** The line turns red when the field is the one that needs fixing. */
  error?: boolean;
  /** A password: hidden, with a show / hide eye at the end of the line. */
  password?: boolean;
  /** Bigger, spaced-out writing — for codes. */
  code?: boolean;
}

/**
 * A sign-in field written on a line, like filling in a paper form: small bold
 * label above, the typed text on the line, the line turns blue while writing
 * and red when it's the one to fix.
 */
export const AuthField = forwardRef<TextInput, AuthFieldProps>(function AuthField(
  { label, error = false, password = false, code = false, onFocus, onBlur, editable, ...props },
  ref
) {
  const c = useThemedColors();
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const [shown, setShown] = useState(false);

  const handleFocus = useCallback<FocusHandler>(
    (e): void => {
      setFocused(true);
      onFocus?.(e);
    },
    [onFocus]
  );
  const handleBlur = useCallback<BlurHandler>(
    (e): void => {
      setFocused(false);
      onBlur?.(e);
    },
    [onBlur]
  );
  const toggleShown = useCallback((): void => setShown((v) => !v), []);

  const lineColor = error ? c.danger : focused ? c.primary : c.textTertiary;
  const disabled = editable === false;

  return (
    <View style={disabled && styles.disabled}>
      <Text style={[styles.label, { color: error ? c.danger : c.textSecondary }]}>{label}</Text>
      <View
        style={[styles.line, { borderBottomColor: lineColor }, (focused || error) && styles.thick]}
      >
        <TextInput
          {...props}
          ref={ref}
          editable={editable}
          secureTextEntry={password && !shown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderTextColor={c.textTertiary}
          underlineColorAndroid="transparent"
          style={[styles.input, code && styles.code, { color: c.textPrimary }]}
        />
        {password && (
          <Pressable
            onPress={toggleShown}
            hitSlop={8}
            style={styles.eye}
            accessibilityRole="button"
            accessibilityState={{ expanded: shown }}
            accessibilityLabel={shown ? t('auth.hide_password') : t('auth.show_password')}
          >
            <Ionicons name={shown ? 'eye-off' : 'eye'} size={21} color={c.textSecondary} />
          </Pressable>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  label: { fontSize: mf(13.5), ...font.bold, marginBottom: ms(2) },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 46,
    borderBottomWidth: 1.5,
  },
  thick: { borderBottomWidth: 2 },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: mf(17),
    ...font.semibold,
    paddingVertical: ms(9),
    paddingHorizontal: 0,
    // The line is the focus cue; on web, drop the browser's own box.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  code: { fontSize: mf(26), letterSpacing: ms(8), writingDirection: 'ltr' },
  eye: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
});
