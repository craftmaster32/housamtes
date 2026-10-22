import { View, StyleSheet, Pressable, Modal } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useThemedColors, darkColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { mf, ms } from '@utils/responsive';

interface SettingsDialogProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  body: string;
  children: React.ReactNode;
}

/** A centred pop-up on the page colour: serif title, plain body, then buttons. */
export function SettingsDialog({
  visible,
  onClose,
  title,
  body,
  children,
}: SettingsDialogProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const heading = useHeadingFont('semibold');
  const overlay = c === darkColors ? 'rgba(0,0,0,0.6)' : 'rgba(34,32,29,0.42)';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View style={[styles.box, { backgroundColor: c.background }]} accessibilityViewIsModal>
          <Text
            style={[styles.title, heading, { color: c.textPrimary }]}
            accessibilityRole="header"
          >
            {title}
          </Text>
          <Text style={[styles.body, { color: c.textSecondary }]}>{body}</Text>
          {children}
        </View>
      </View>
    </Modal>
  );
}

interface DialogButtonProps {
  label: string;
  onPress: () => void;
  kind: 'primary' | 'danger' | 'outline' | 'link';
  disabled?: boolean;
}

/** Big rounded button for a dialog; `link` is the plain blue Cancel. */
export function DialogButton({
  label,
  onPress,
  kind,
  disabled = false,
}: DialogButtonProps): React.JSX.Element {
  const c = useThemedColors();
  const fill = kind === 'primary' ? c.primary : kind === 'danger' ? c.negative : 'transparent';
  const ink = kind === 'primary' || kind === 'danger' ? '#FFFFFF' : c.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        kind !== 'link' && styles.btnBox,
        { backgroundColor: fill },
        kind === 'outline' && { borderColor: c.primary, ...styles.outline },
        (pressed || disabled) && styles.dim,
      ]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.btnText, { color: ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: ms(24) },
  box: { width: '100%', maxWidth: 380, borderRadius: ms(26), padding: ms(24), gap: ms(12) },
  title: { fontSize: mf(26), lineHeight: mf(33), letterSpacing: -0.4 },
  body: { fontSize: mf(15), ...font.regular, lineHeight: mf(21) },
  btn: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  btnBox: { borderRadius: ms(17), marginTop: ms(2) },
  outline: { borderWidth: 1.5 },
  btnText: { fontSize: mf(16), ...font.semibold },
  dim: { opacity: 0.6 },
});
