import { View, StyleSheet, Pressable, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { SheetHeader } from '@components/bills/recurring/SheetHeader';
import { mf, ms } from '@utils/responsive';

interface SplitSheetProps {
  visible: boolean;
  /** Small line above the title, e.g. the total. */
  eyebrow: string;
  onClose: () => void;
  /** The who-paid / split fields. */
  children: React.ReactNode;
}

/** Bottom sheet holding the full split options, opened from the split sentence. */
export function SplitSheet({
  visible,
  eyebrow,
  onClose,
  children,
}: SplitSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View style={[styles.sheet, { backgroundColor: c.background }]} accessibilityViewIsModal>
          <SheetHeader eyebrow={eyebrow} title={t('bills.split_sheet_title')} onClose={onClose} />
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {children}
            <Pressable
              style={({ pressed }) => [
                styles.done,
                { backgroundColor: c.primary },
                pressed && styles.pressed,
              ]}
              onPress={onClose}
              accessible
              accessibilityRole="button"
            >
              <Text style={styles.doneText}>{t('common.done')}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.42)' },
  sheet: {
    borderTopLeftRadius: ms(26),
    borderTopRightRadius: ms(26),
    maxHeight: '92%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  body: { padding: ms(20), paddingBottom: ms(36), gap: ms(22) },
  done: { minHeight: ms(56), borderRadius: ms(18), alignItems: 'center', justifyContent: 'center' },
  doneText: { fontSize: mf(17), ...font.bold, color: '#fff' },
  pressed: { opacity: 0.75 },
});
