import { useCallback, useSyncExternalStore } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useThemedColors, darkColors } from '@constants/colors';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';
import { subscribeAlert, getAlertSnapshot, finishAlert, type AlertButton } from '@lib/alert';

// The sticky note is paper: it keeps these colours in light and dark mode.
const NOTE_BLUE = '#3B6FBF';
const NOTE_RED = '#B84540';
const NOTE_LINK = '#2952A0';

/**
 * Every pop-up message in the app (Alert.alert from @lib/alert), drawn as a
 * blue sticky note taped onto the screen: serif title, the message, an
 * optional big code, then the buttons — the main one big and blue (red when
 * it deletes), Cancel as a blue word underneath.
 */
export function AlertHost(): React.JSX.Element | null {
  const request = useSyncExternalStore(subscribeAlert, getAlertSnapshot, () => null);
  const { t } = useTranslation();
  const c = useThemedColors();
  const heading = useHeadingFont('semibold');
  const hand = useHandFont();
  const overlay = c === darkColors ? 'rgba(0,0,0,0.6)' : 'rgba(34,32,29,0.42)';

  const handlePress = useCallback(
    (button: AlertButton): void => {
      if (!request) return;
      finishAlert(request.id);
      button.onPress?.();
    },
    [request]
  );

  // Tapping outside (or Android back) counts as Cancel when there is one; a
  // plain message with one button counts as pressing it.
  const handleDismiss = useCallback((): void => {
    if (!request) return;
    const cancel = request.buttons.find((b) => b.style === 'cancel');
    finishAlert(request.id);
    if (cancel) cancel.onPress?.();
    else if (request.buttons.length === 1) request.buttons[0].onPress?.();
    else request.onDismiss?.();
  }, [request]);

  if (!request) return null;

  const buttons: AlertButton[] =
    request.buttons.length > 0 ? request.buttons : [{ text: t('common.ok') }];
  const actions = buttons.filter((b) => b.style !== 'cancel');
  const cancels = buttons.filter((b) => b.style === 'cancel');

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleDismiss}>
      <View style={[styles.overlay, { backgroundColor: overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleDismiss}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View style={[styles.note, { backgroundColor: c.note }]} accessibilityViewIsModal>
          <View style={styles.tape} />
          {!!request.title && (
            <Text style={[styles.title, heading, { color: c.noteInk }]} accessibilityRole="header">
              {request.title}
            </Text>
          )}
          {!!request.message && (
            <Text selectable style={[styles.message, { color: c.noteInk }]}>
              {request.message}
            </Text>
          )}
          {!!request.code && (
            <Text selectable style={[styles.code, hand, { color: c.noteInk }]}>
              {request.code}
            </Text>
          )}
          <View style={styles.buttons}>
            {actions.map((button, i) => {
              const red = button.style === 'destructive';
              // With several choices, the first is the big blue one and the
              // rest are outlined, so the note doesn't turn into a wall of blue.
              const outlined = !red && i > 0;
              return (
                <Pressable
                  key={`${button.text}-${i}`}
                  onPress={() => handlePress(button)}
                  style={({ pressed }) => [
                    styles.btn,
                    outlined ? styles.btnOutline : { backgroundColor: red ? NOTE_RED : NOTE_BLUE },
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={button.text}
                >
                  <Text style={[styles.btnText, outlined && styles.btnTextOutline]}>
                    {button.text}
                  </Text>
                </Pressable>
              );
            })}
            {cancels.map((button, i) => (
              <Pressable
                key={`${button.text}-cancel-${i}`}
                onPress={() => handlePress(button)}
                style={({ pressed }) => [styles.link, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={button.text}
              >
                <Text style={styles.linkText}>{button.text}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: ms(24) },
  note: {
    width: '100%',
    maxWidth: 380,
    borderRadius: ms(4),
    paddingHorizontal: ms(22),
    paddingTop: ms(26),
    paddingBottom: ms(18),
    transform: [{ rotate: '-1.2deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(12) },
    shadowOpacity: 0.25,
    shadowRadius: ms(26),
    elevation: 10,
  },
  tape: {
    position: 'absolute',
    top: ms(-11),
    alignSelf: 'center',
    width: ms(92),
    height: ms(24),
    backgroundColor: 'rgba(255,255,255,0.55)',
    transform: [{ rotate: '2deg' }],
  },
  title: { fontSize: mf(24), lineHeight: mf(31), letterSpacing: -0.3 },
  message: {
    fontSize: mf(15),
    ...font.regular,
    lineHeight: mf(22),
    marginTop: ms(8),
    opacity: 0.85,
  },
  code: {
    fontSize: mf(40),
    lineHeight: mf(48),
    textAlign: 'center',
    letterSpacing: 3,
    writingDirection: 'ltr',
    marginTop: ms(10),
    paddingBottom: ms(6),
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(20,36,61,0.35)',
  },
  buttons: { marginTop: ms(18), gap: ms(8) },
  btn: {
    minHeight: 50,
    borderRadius: ms(17),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(16),
  },
  btnOutline: { borderWidth: 1.5, borderColor: NOTE_BLUE },
  btnText: { fontSize: mf(16), ...font.semibold, color: '#FFFFFF', textAlign: 'center' },
  btnTextOutline: { color: NOTE_BLUE },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  linkText: { fontSize: mf(16), ...font.semibold, color: NOTE_LINK },
  pressed: { opacity: 0.7 },
});
