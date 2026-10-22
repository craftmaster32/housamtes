import { useState } from 'react';
import { View, StyleSheet, Pressable, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { isRTL } from '@lib/i18n';
import { useLanguageStore } from '@stores/languageStore';
import { mf, ms } from '@utils/responsive';

interface MessageBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
}

/**
 * The message box at the bottom: a soft filled box with a fine border (blue
 * while you type) and a round blue send button beside it.
 */
export function MessageBar({ value, onChangeText, onSend }: MessageBarProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const rtl = isRTL(useLanguageStore((s) => s.language));
  const [focused, setFocused] = useState(false);
  const canSend = !!value.trim();

  return (
    <View style={[styles.bar, { backgroundColor: c.background, borderTopColor: c.border }]}>
      <View
        style={[
          styles.box,
          { backgroundColor: c.surface, borderColor: focused ? c.primary : c.border },
          focused && styles.boxFocused,
        ]}
      >
        <TextInput
          style={[styles.input, { color: c.textPrimary }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={t('chat.message_placeholder')}
          placeholderTextColor={c.textTertiary}
          returnKeyType="send"
          onSubmitEditing={onSend}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          underlineColorAndroid="transparent"
          accessibilityLabel={t('chat.message_placeholder')}
        />
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.send,
          { backgroundColor: c.primary },
          (!canSend || pressed) && styles.dimmed,
        ]}
        onPress={onSend}
        disabled={!canSend}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('chat.send')}
        accessibilityState={{ disabled: !canSend }}
      >
        <Ionicons name={rtl ? 'arrow-back' : 'arrow-up'} size={20} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(10),
    paddingHorizontal: ms(14),
    paddingTop: ms(10),
    paddingBottom: ms(14),
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  box: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: ms(24),
    paddingHorizontal: ms(18),
  },
  boxFocused: { borderWidth: 2 },
  input: {
    minHeight: 44,
    fontSize: mf(16.5),
    ...font.medium,
    paddingVertical: ms(8),
    paddingHorizontal: 0,
    // The box is the focus cue (its border turns blue); drop the browser's own outline.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  send: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: { opacity: 0.4 },
});
