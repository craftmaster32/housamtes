import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { View, StyleSheet, FlatList, Dimensions, Pressable, ViewToken, Animated } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ONBOARDING_KEY = 'housemates_onboarding_seen';

export async function markOnboardingSeen(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY, '1');
}

export async function hasSeenOnboarding(): Promise<boolean> {
  const val = await AsyncStorage.getItem(ONBOARDING_KEY);
  return val === '1';
}

export default function IntroScreen(): React.JSX.Element {
  const { t } = useTranslation();

  const SLIDES = [
    {
      id: '1',
      emoji: '🏠',
      title: t('onboarding.slide1_title'),
      subtitle: t('onboarding.slide1_subtitle'),
      body: t('onboarding.slide1_body'),
    },
    {
      id: '2',
      emoji: '💰',
      title: t('onboarding.slide2_title'),
      subtitle: t('onboarding.slide2_subtitle'),
      body: t('onboarding.slide2_body'),
    },
    {
      id: '3',
      emoji: '🚗',
      title: t('onboarding.slide3_title'),
      subtitle: t('onboarding.slide3_subtitle'),
      body: t('onboarding.slide3_body'),
    },
  ];

  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList>(null);
  const isLast = activeIndex === SLIDES.length - 1;

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]) {
        setActiveIndex(viewableItems[0].index ?? 0);
      }
    },
    []
  );

  const handleNext = useCallback(async () => {
    if (isLast) {
      await markOnboardingSeen();
      router.replace('/(auth)/welcome');
    } else {
      listRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    }
  }, [isLast, activeIndex]);

  const handleSkip = useCallback(async () => {
    await markOnboardingSeen();
    router.replace('/(auth)/welcome');
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        {/* Skip button */}
        {!isLast && (
          <Pressable onPress={handleSkip} style={styles.skipBtn} accessible accessibilityRole="button" accessibilityLabel="Skip intro">
            <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
          </Pressable>
        )}

        {/* Slides */}
        <FlatList
          ref={listRef}
          data={SLIDES}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              <View style={styles.emojiCircle}>
                <Text style={styles.emoji}>{item.emoji}</Text>
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </View>
          )}
        />

        {/* Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
          ))}
        </View>

        {/* CTA */}
        <View style={styles.footer}>
          <Button
            mode="contained"
            onPress={handleNext}
            style={styles.cta}
            contentStyle={styles.ctaContent}
            labelStyle={styles.ctaLabel}
            buttonColor={C.primary}
          >
            {isLast ? t('onboarding.lets_go') : t('onboarding.next')}
          </Button>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.surface },
    flex: { flex: 1 },
    skipBtn: {
      alignSelf: 'flex-end',
      paddingHorizontal: sizes.lg,
      paddingVertical: sizes.md,
    },
    skipText: { color: C.textSecondary, fontSize: 15, ...font.medium },
    slide: {
      width: SCREEN_WIDTH,
      paddingHorizontal: sizes.xl,
      paddingTop: sizes.lg,
      alignItems: 'center',
      gap: sizes.md,
    },
    emojiCircle: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: C.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: sizes.md,
    },
    emoji: { fontSize: 56 },
    title: {
      fontSize: 28,
      ...font.extrabold,
      color: C.textPrimary,
      textAlign: 'center',
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 17,
      ...font.semibold,
      color: C.primary,
      textAlign: 'center',
      marginTop: -sizes.sm,
    },
    body: {
      fontSize: 16,
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      paddingHorizontal: sizes.sm,
    },
    dotsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: sizes.lg,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: C.border,
    },
    dotActive: {
      backgroundColor: C.primary,
      width: 24,
    },
    footer: {
      paddingHorizontal: sizes.xl,
      paddingBottom: sizes.xl,
    },
    cta: { borderRadius: 14 },
    ctaContent: { height: 56 },
    ctaLabel: { fontSize: 16, ...font.semibold },
  });
}
