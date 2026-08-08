import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { View, StyleSheet, Modal, Pressable, Animated, PanResponder } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { useLanguageStore } from '@stores/languageStore';
import { useSettingsStore } from '@stores/settingsStore';
import { isRTL } from '@lib/i18n';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { TourScreen, TourBottomBar, WelcomeBg, type TourScreenId } from './TourScreens';

interface Step {
  id: 'welcome' | TourScreenId;
  screen?: TourScreenId;
}

const STEPS: Step[] = [
  { id: 'welcome' },
  { id: 'bills', screen: 'bills' },
  { id: 'spending', screen: 'spending' },
  { id: 'grocery', screen: 'grocery' },
  { id: 'calendar', screen: 'calendar' },
];

interface WelcomeTourProps {
  visible: boolean;
  onDone: () => void;
}

export const WelcomeTour: React.FC<WelcomeTourProps> = ({ visible, onDone }) => {
  const { t } = useTranslation();
  const C = useThemedColors();
  const rtl = isRTL(useLanguageStore((s) => s.language));
  const currency = useSettingsStore((s) => s.currency);
  const insets = useSafeAreaInsets();
  // Push content clear of the status bar AND the floating Skip button
  // (its ring can extend upward, so leave generous room).
  const topPad = insets.top + 60;
  const styles = useMemo(() => makeStyles(C, rtl, topPad), [C, rtl, topPad]);

  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible]);
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [index, fade]);

  const next = useCallback(() => {
    if (isLast) onDone();
    else setIndex((i) => i + 1);
  }, [isLast, onDone]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Horizontal swipe: back one step, or forward. Only claims the gesture on a
  // clear horizontal drag, so taps and the buttons keep working.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderRelease: (_, g) => {
          const isBack = rtl ? g.dx < -45 : g.dx > 45;
          const isFwd = rtl ? g.dx > 45 : g.dx < -45;
          if (isBack) back();
          else if (isFwd) next();
        },
      }),
    [rtl, back, next]
  );

  const translateY = fade.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  const anim = { opacity: fade, transform: [{ translateY }] };

  const footer = (
    <View style={styles.footer}>
      {index > 0 ? (
        <Pressable
          onPress={back}
          style={styles.backBtn}
          hitSlop={8}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('tour.back')}
        >
          <Ionicons
            name={rtl ? 'chevron-forward' : 'chevron-back'}
            size={20}
            color={C.textSecondary}
          />
        </Pressable>
      ) : (
        <View style={styles.backBtn} />
      )}
      <View style={styles.dots}>
        {STEPS.map((s, i) => (
          <View key={s.id} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
      <Button
        mode="contained"
        onPress={next}
        style={styles.cta}
        contentStyle={styles.ctaContent}
        labelStyle={styles.ctaLabel}
        buttonColor={C.primary}
        textColor="#fff"
        accessible
        accessibilityRole="button"
        accessibilityLabel={isLast ? t('tour.start') : t('tour.next')}
      >
        {isLast ? t('tour.start') : t('tour.next')}
      </Button>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone}>
      <View style={styles.modalRoot} {...pan.panHandlers}>
        <Pressable
          style={styles.stack}
          onPress={next}
          accessibilityRole="button"
          accessibilityLabel={t('tour.next')}
        >
          {/* Content zone — fills the space above the caption + bar */}
          <View style={styles.contentZone}>
            <Animated.View style={[styles.fill, { opacity: fade }]}>
              {step.id === 'welcome' ? (
                <WelcomeBg C={C} />
              ) : step.screen ? (
                <TourScreen id={step.screen} C={C} t={t} currency={currency} />
              ) : null}
            </Animated.View>
            {step.id === 'welcome' && (
              <View style={styles.welcomeCenter}>
                <Animated.View style={[styles.welcomeCard, anim]}>
                  <View style={styles.welcomeIcon}>
                    <Ionicons name="happy-outline" size={40} color={C.primary} />
                  </View>
                  <Text style={styles.welcomeTitle}>{t('tour.welcome_title')}</Text>
                  <Text style={styles.welcomeBody}>{t('tour.welcome_body')}</Text>
                  {footer}
                </Animated.View>
              </View>
            )}
          </View>

          {/* Caption — stacked below the content, never overlapping it */}
          {step.id !== 'welcome' && (
            <Animated.View style={[styles.sheet, anim]}>
              <Text style={styles.eyebrow}>{t(`tour.${step.id}_title`)}</Text>
              <Text style={styles.body}>{t(`tour.${step.id}_body`)}</Text>
              {footer}
            </Animated.View>
          )}

          {/* Persistent bottom bar */}
          <TourBottomBar
            C={C}
            highlightAdd={step.id === 'bills'}
            addLabel={t('bills.add_expense')}
          />
        </Pressable>

        <SafeAreaView edges={['top']} style={styles.skipWrap} pointerEvents="box-none">
          <Pressable
            onPress={onDone}
            style={styles.skipBtn}
            hitSlop={8}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('tour.skip')}
          >
            <Text style={styles.skipText}>{t('tour.skip')}</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

function makeStyles(C: ColorTokens, rtl: boolean, topPad: number) {
  const textAlign = rtl ? 'right' : 'left';
  return StyleSheet.create({
    modalRoot: { flex: 1, backgroundColor: C.background },
    stack: { flex: 1 },
    contentZone: { flex: 1, paddingTop: topPad, overflow: 'hidden' },
    fill: { flex: 1 },
    // Welcome
    welcomeCenter: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      padding: sizes.lg,
    },
    welcomeCard: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: C.surface,
      borderRadius: 26,
      padding: sizes.lg,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.18,
      shadowRadius: 28,
      elevation: 8,
    },
    welcomeIcon: {
      width: 82,
      height: 82,
      borderRadius: 41,
      backgroundColor: C.primary + '22',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: sizes.md,
    },
    welcomeTitle: {
      fontSize: 22,
      ...font.extrabold,
      color: C.textPrimary,
      textAlign: 'center',
      letterSpacing: -0.4,
    },
    welcomeBody: {
      fontSize: 14,
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
      marginTop: sizes.sm,
      paddingHorizontal: sizes.sm,
    },
    // Caption
    sheet: {
      marginHorizontal: sizes.md,
      marginBottom: sizes.sm,
      backgroundColor: C.surface,
      borderRadius: 22,
      padding: sizes.md + 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.22,
      shadowRadius: 24,
      elevation: 8,
    },
    eyebrow: {
      fontSize: 18,
      ...font.extrabold,
      color: C.textPrimary,
      letterSpacing: -0.3,
      textAlign,
      writingDirection: rtl ? 'rtl' : 'ltr',
    },
    body: {
      fontSize: 13.5,
      ...font.regular,
      color: C.textSecondary,
      lineHeight: 20,
      marginTop: 6,
      textAlign,
      writingDirection: rtl ? 'rtl' : 'ltr',
    },
    // Footer (dots + CTA)
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: sizes.md,
      gap: sizes.sm,
    },
    backBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'flex-start' },
    dots: { flexDirection: 'row', gap: 7, flex: 1, justifyContent: 'center' },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.border },
    dotActive: { width: 20, backgroundColor: C.primary },
    cta: { borderRadius: 12 },
    ctaContent: { height: 42, paddingHorizontal: sizes.xs },
    ctaLabel: { fontSize: 14.5, ...font.semibold },
    // Skip
    skipWrap: { position: 'absolute', top: 0, right: 0, left: 0, alignItems: 'flex-end' },
    skipBtn: {
      margin: sizes.md,
      paddingVertical: 7,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: C.textPrimary + '14',
      minHeight: sizes.touchTarget - 8,
      justifyContent: 'center',
    },
    skipText: { color: C.textPrimary, fontSize: 13, ...font.semibold },
  });
}
