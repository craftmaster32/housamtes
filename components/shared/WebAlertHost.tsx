import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';
import {
  subscribeWebAlert,
  getWebAlertSnapshot,
  clearWebAlert,
  type AlertButton,
} from '@lib/alert';

// Renders the web-only fallback for Alert.alert calls with 3+ buttons — see
// lib/alert.ts for why those can't be represented by window.confirm. No-ops
// on native, where RNAlert.alert already renders its own native picker.
export function WebAlertHost(): React.JSX.Element | null {
  const pending = useSyncExternalStore(subscribeWebAlert, getWebAlertSnapshot, () => null);
  const C = useThemedColors();
  const s = useMemo(() => makeStyles(), []);

  const handlePress = useCallback((button: AlertButton): void => {
    clearWebAlert();
    button.onPress?.();
  }, []);

  const handleRequestClose = useCallback((): void => {
    const onDismiss = pending?.onDismiss;
    clearWebAlert();
    onDismiss?.();
  }, [pending]);

  if (Platform.OS !== 'web' || !pending) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleRequestClose}>
      <Pressable
        style={s.backdrop}
        onPress={handleRequestClose}
        accessible={false}
        accessibilityElementsHidden
      />
      <View style={s.centerer} pointerEvents="box-none">
        <View style={[s.sheet, { backgroundColor: C.surface }]}>
          <Text style={[s.title, { color: C.textPrimary }]}>{pending.title}</Text>
          {!!pending.message && (
            <Text style={[s.message, { color: C.textSecondary }]}>{pending.message}</Text>
          )}
          {pending.buttons.map((button, i) => (
            <Pressable
              key={i}
              onPress={() => handlePress(button)}
              style={[s.btn, { borderColor: C.border }]}
              accessible
              accessibilityRole="button"
              accessibilityLabel={button.text}
            >
              <Text
                style={[
                  s.btnText,
                  { color: C.textPrimary },
                  button.style === 'destructive' && { color: C.danger },
                  button.style === 'cancel' && { color: C.textSecondary },
                ]}
              >
                {button.text}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
    centerer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: ms(24) },
    sheet: {
      width: '100%',
      maxWidth: ms(400),
      borderRadius: ms(16),
      padding: ms(20),
      gap: ms(4),
    },
    title: { fontSize: mf(17), ...font.bold, marginBottom: ms(4) },
    message: { fontSize: mf(14), ...font.regular, marginBottom: ms(12) },
    btn: {
      minHeight: ms(48),
      justifyContent: 'center',
      paddingHorizontal: ms(4),
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    btnText: { fontSize: mf(15), ...font.medium },
  });
}
