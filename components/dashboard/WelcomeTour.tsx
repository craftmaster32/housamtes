import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { View, StyleSheet, Modal, Pressable, Animated } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { TourScreen, type TourScreenId } from './TourScreens';

interface Step {
  id: 'welcome' | TourScreenId;
  screen?: TourScreenId;
  anchor?: 'top' | 'bottom';
}

const STEPS: Step[] = [
  { id: 'welcome' },
  { id: 'bills', screen: 'bills', anchor: 'top' },
  { id: 'spending', screen: 'spending', anchor: 'bottom' },
  { id: 'grocery', screen: 'grocery', anchor: 'bottom' },
  { id: 'calendar', screen: 'calendar', anchor: 'bottom' },
];

interface WelcomeTourProps {
  visible: boolean;
  onDone: () => void;
}

export const WelcomeTour: React.FC<WelcomeTourProps> = ({ visible, onDone }) => {
  const { t } = useTranslation();
  const C = useThemedColors();
  const rtl = isRTL(useLanguageStore((s) => s.language));
  const styles = useMemo(() => makeStyles(C, rtl), [C, rtl]);

  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible]);
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [index, fade]);

  const next = useCallback(() => {
    if (isLast) onDone();
    else setIndex((i) => i + 1);
  }, [isLast, onDone]);

  const translateY = fade.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  const footer = (
    <View style={styles.footer}>
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
      <View style={styles.root}>
        <Pressable
          style={styles.tapLayer}
          onPress={next}
          accessibilityRole="button"
          accessibilityLabel={t('tour.next')}
        >
          {step.id === 'welcome' ? (
            <View style={styles.welcomeWrap}>
              <Animated.View
                style={[styles.welcomeCard, { opacity: fade, transform: [{ translateY }] }]}
              >
                <View style={styles.welcomeIcon}>
                  <Ionicons name="happy-outline" size={40} color={C.primary} />
                </View>
                <Text style={styles.welcomeTitle}>{t('tour.welcome_title')}</Text>
                <Text style={styles.welcomeBody}>{t('tour.welcome_body')}</Text>
                {footer}
              </Animated.View>
            </View>
          ) : (
            <>
              {step.screen && <TourScreen id={step.screen} C={C} t={t} />}
              <Animated.View
                style={[
                  styles.sheet,
                  step.anchor === 'top' ? styles.sheetTop : styles.sheetBottom,
                  { opacity: fade, transform: [{ translateY }] },
                ]}
              >
                <Text style={styles.eyebrow}>{t(`tour.${step.id}_title`)}</Text>
                <Text style={styles.body}>{t(`tour.${step.id}_body`)}</Text>
                {footer}
              </Animated.View>
            </>
          )}
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

function makeStyles(C: ColorTokens, rtl: boolean) {
  const textAlign = rtl ? 'right' : 'left';
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    tapLayer: { flex: 1 },
    // Welcome
    welcomeWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: sizes.lg },
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
    // Caption sheet
    sheet: {
      position: 'absolute',
      left: sizes.md,
      right: sizes.md,
      backgroundColor: C.surface,
      borderRadius: 22,
      padding: sizes.md + 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.22,
      shadowRadius: 24,
      elevation: 8,
    },
    sheetBottom: { bottom: sizes.xl },
    sheetTop: { top: 72 },
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
    dots: { flexDirection: 'row', gap: 7 },
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
