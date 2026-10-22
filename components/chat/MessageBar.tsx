import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { UnderlineInput } from '@components/bills/form/UnderlineInput';
import { isRTL } from '@lib/i18n';
import { useLanguageStore } from '@stores/languageStore';
import { ms } from '@utils/responsive';

interface MessageBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
}

/** The message is written on a line at the bottom, with a round blue send button. */
export function MessageBar({ value, onChangeText, onSend }: MessageBarProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const rtl = isRTL(useLanguageStore((s) => s.language));
  const canSend = !!value.trim();

  return (
    <View style={[styles.bar, { backgroundColor: c.background, borderTopColor: c.border }]}>
      <UnderlineInput
        style={styles.field}
        value={value}
        onChangeText={onChangeText}
        placeholder={t('chat.message_placeholder')}
        returnKeyType="send"
        onSubmitEditing={onSend}
        accessibilityLabel={t('chat.message_placeholder')}
      />
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
    alignItems: 'flex-end',
    gap: ms(10),
    paddingHorizontal: ms(16),
    paddingTop: ms(8),
    paddingBottom: ms(12),
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  field: { flex: 1, minWidth: 0 },
  send: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: ms(2),
  },
  dimmed: { opacity: 0.4 },
});
