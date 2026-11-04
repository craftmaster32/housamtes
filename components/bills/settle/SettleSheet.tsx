import { View, StyleSheet, Pressable, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SheetHeader } from '@components/bills/recurring/SheetHeader';
import { useRecurringPalette } from '@components/bills/recurring/palette';
import { ms } from '@utils/responsive';

interface SettleSheetProps {
  visible: boolean;
  eyebrow: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/** Bottom-sheet frame shared by the settle-up sheets (same look as the payment sheet). */
export function SettleSheet({
  visible,
  eyebrow,
  title,
  onClose,
  children,
}: SettleSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const p = useRecurringPalette();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: p.overlay }]}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View style={[styles.sheet, { backgroundColor: p.sheet }]} accessibilityViewIsModal>
          <SheetHeader eyebrow={eyebrow} title={title} onClose={onClose} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    borderTopLeftRadius: ms(26),
    borderTopRightRadius: ms(26),
    maxHeight: '92%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
});
