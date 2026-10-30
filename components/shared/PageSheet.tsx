import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemedColors, darkColors } from '@constants/colors';
import { SheetHeader } from '@components/bills/recurring/SheetHeader';
import { useReduceMotion } from '@hooks/useReduceMotion';
import { ms } from '@utils/responsive';

interface PageSheetProps {
  visible: boolean;
  eyebrow: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * The standard bottom sheet: page colour, grab handle, Fraunces title with a
 * round close button, and a scrolling body that stays above the keyboard.
 */
export function PageSheet({
  visible,
  eyebrow,
  title,
  onClose,
  children,
}: PageSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const overlay = c === darkColors ? 'rgba(0,0,0,0.6)' : 'rgba(34,32,29,0.42)';
  const reduceMotion = useReduceMotion();

  // The dim background fades in place while only the sheet slides up (a
  // Modal "slide" would carry the dark layer up the screen with it). On close
  // both run backwards, and the Modal goes away once they're done.
  const [mounted, setMounted] = useState(visible);
  const fade = useRef(new Animated.Value(0)).current;
  const drop = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);
  useEffect(() => {
    if (!mounted) return undefined;
    const anim = Animated.parallel([
      Animated.timing(fade, {
        toValue: visible ? 1 : 0,
        duration: reduceMotion ? 0 : visible ? 220 : 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(drop, {
        toValue: visible ? 0 : 1,
        duration: reduceMotion ? 0 : visible ? 300 : 220,
        easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    anim.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return (): void => anim.stop();
  }, [mounted, visible, reduceMotion, fade, drop]);
  const travel = Dimensions.get('window').height;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: overlay, opacity: fade }]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: c.background,
              transform: [
                { translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [0, travel] }) },
              ],
            },
          ]}
          accessibilityViewIsModal
        >
          <SheetHeader eyebrow={eyebrow} title={title} onClose={onClose} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: ms(26),
    borderTopRightRadius: ms(26),
    maxHeight: '92%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  body: { padding: ms(20), paddingTop: ms(8), paddingBottom: ms(36), gap: ms(20) },
});
