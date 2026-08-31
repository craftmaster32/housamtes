import React, { forwardRef, useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, type TextInput as RNTextInput } from 'react-native';
import { TextInput } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';

type PaperTextInputProps = React.ComponentProps<typeof TextInput>;

// A password field with a show/hide toggle. We render the eye ourselves rather
// than via Paper's `right`/`left` adornment: on web in RTL, Paper's adornment
// mispositions the floating label (it indents the label to clear the icon and
// then can't place it correctly), leaving a gap or clipping. A plain overlaid
// button keeps Paper's label behaviour identical to a field with no icon, and
// we position the button on the physical side ourselves.
export type PasswordInputProps = Omit<
  PaperTextInputProps,
  'secureTextEntry' | 'left' | 'right'
>;

export const PasswordInput = forwardRef<RNTextInput, PasswordInputProps>(
  ({ contentStyle, ...props }, ref) => {
    const [show, setShow] = useState(false);
    const { t } = useTranslation();
    const C = useThemedColors();
    const language = useLanguageStore((s) => s.language);
    const rtl = isRTL(language);

    const toggle = useCallback(() => setShow((v) => !v), []);

    return (
      <View style={styles.wrap}>
        <TextInput
          {...props}
          ref={ref}
          secureTextEntry={!show}
          contentStyle={[contentStyle, rtl ? styles.contentRTL : styles.contentLTR]}
        />
        <Pressable
          onPress={toggle}
          style={[styles.button, rtl ? styles.left : styles.right]}
          hitSlop={8}
          accessible
          accessibilityRole="button"
          accessibilityState={{ expanded: show }}
          accessibilityLabel={show ? t('auth.hide_password') : t('auth.show_password')}
        >
          <Ionicons name={show ? 'eye-off' : 'eye'} size={22} color={C.textSecondary} />
        </Pressable>
      </View>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';

const EYE_SLOT = 44;

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  // Reserve room so the typed text never slides under the eye.
  contentLTR: {
    paddingRight: EYE_SLOT,
  },
  contentRTL: {
    paddingLeft: EYE_SLOT,
  },
  button: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: EYE_SLOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  right: {
    right: 4,
  },
  left: {
    left: 4,
  },
});
