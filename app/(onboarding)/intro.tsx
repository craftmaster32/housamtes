import { useState, useRef, useCallback } from 'react';
import { View, StyleSheet, FlatList, Dimensions, ViewToken } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemedColors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { SheetButton } from '@components/shared/SheetButton';
import { TextLink } from '@components/auth/TextLink';
import { TapedPicture, type PictureKind } from '@components/auth/TapedPicture';
import { mf, ms } from '@utils/responsive';

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

  const SLIDES: {
    id: string;
    picture: PictureKind;
    title: string;
    subtitle: string;
    body: string;
  }[] = [
    {
      id: '1',
      picture: 'door',
      title: t('onboarding.slide1_title'),
      subtitle: t('onboarding.slide1_subtitle'),
      body: t('onboarding.slide1_body'),
    },
    {
      id: '2',
      picture: 'bill',
      title: t('onboarding.slide2_title'),
      subtitle: t('onboarding.slide2_subtitle'),
      body: t('onboarding.slide2_body'),
    },
    {
      id: '3',
      picture: 'car',
      title: t('onboarding.slide3_title'),
      subtitle: t('onboarding.slide3_subtitle'),
      body: t('onboarding.slide3_body'),
    },
  ];

  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList>(null);
  const isLast = activeIndex === SLIDES.length - 1;

  const C = useThemedColors();
  const heading = useHeadingFont('semibold');
  const hand = useHandFont();

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
    <SafeAreaView style={[styles.root, { backgroundColor: C.background }]} edges={['top']}>
      <View style={styles.skipRow}>
        {!isLast && <TextLink muted label={t('onboarding.skip')} onPress={handleSkip} />}
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item, index }) => (
          <View style={styles.slide}>
            <TapedPicture kind={item.picture} tilt={index % 2 === 0 ? -3 : 3} />
            <Text style={[styles.title, heading, { color: C.textPrimary }]}>{item.title}</Text>
            <Text style={[styles.subtitle, hand, { color: C.primary }]}>{item.subtitle}</Text>
            <Text style={[styles.body, { color: C.textSecondary }]}>{item.body}</Text>
          </View>
        )}
      />

      {/* Where you are: ink dots, the current one a short blue pen stroke */}
      <View style={styles.dotsRow}>
        {SLIDES.map((slide, i) => (
          <View
            key={slide.id}
            style={[
              styles.dot,
              { backgroundColor: i === activeIndex ? C.primary : C.textTertiary },
              i === activeIndex && styles.dotActive,
            ]}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <SheetButton
          label={isLast ? t('onboarding.lets_go') : t('onboarding.next')}
          onPress={handleNext}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  skipRow: { minHeight: 52, alignItems: 'flex-end', paddingHorizontal: sizes.md },
  slide: {
    width: SCREEN_WIDTH,
    paddingHorizontal: sizes.xl,
    paddingTop: ms(18),
    alignItems: 'center',
  },
  title: {
    fontSize: mf(32),
    lineHeight: mf(40),
    textAlign: 'center',
    letterSpacing: -0.5,
    marginTop: ms(34),
  },
  subtitle: { fontSize: mf(23), textAlign: 'center', marginTop: ms(4) },
  body: {
    fontSize: mf(15.5),
    ...font.regular,
    textAlign: 'center',
    lineHeight: mf(23),
    marginTop: ms(12),
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: ms(8),
    paddingVertical: ms(18),
  },
  dot: { width: ms(7), height: ms(7), borderRadius: ms(4) },
  dotActive: { width: ms(22), height: ms(4), borderRadius: ms(2) },
  footer: { paddingHorizontal: sizes.lg, paddingBottom: ms(36) },
});
