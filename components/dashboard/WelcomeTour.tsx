import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { View, StyleSheet, Modal, FlatList, Dimensions, Pressable, ViewToken } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH - sizes.lg * 2, 360);

interface TourSlide {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  title: string;
  body: string;
}

interface WelcomeTourProps {
  visible: boolean;
  onDone: () => void;
}

export const WelcomeTour: React.FC<WelcomeTourProps> = ({ visible, onDone }) => {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const slides: TourSlide[] = useMemo(
    () => [
      {
        id: 'welcome',
        icon: 'happy-outline',
        tint: C.primary,
        title: t('tour.welcome_title'),
        body: t('tour.welcome_body'),
      },
      {
        id: 'bills',
        icon: 'receipt-outline',
        tint: C.success,
        title: t('tour.bills_title'),
        body: t('tour.bills_body'),
      },
      {
        id: 'house',
        icon: 'checkmark-done-outline',
        tint: '#E0912F',
        title: t('tour.house_title'),
        body: t('tour.house_body'),
      },
      {
        id: 'sync',
        icon: 'chatbubbles-outline',
        tint: '#8B5CF6',
        title: t('tour.sync_title'),
        body: t('tour.sync_body'),
      },
    ],
    [t, C.primary, C.success]
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList<TourSlide>>(null);
  const isLast = activeIndex === slides.length - 1;

  // Reset to the first card whenever the tour is (re)opened.
  useEffect(() => {
    if (visible) setActiveIndex(0);
  }, [visible]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  const handleNext = useCallback(() => {
    if (isLast) {
      onDone();
    } else {
      listRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    }
  }, [isLast, activeIndex, onDone]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Pressable
            onPress={onDone}
            style={styles.skipBtn}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('tour.skip')}
          >
            <Text style={styles.skipText}>{t('tour.skip')}</Text>
          </Pressable>

          <FlatList
            ref={listRef}
            data={slides}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
            renderItem={({ item }) => (
              <View style={styles.slide}>
                <View style={[styles.iconCircle, { backgroundColor: item.tint + '18' }]}>
                  <Ionicons name={item.icon} size={40} color={item.tint} />
                </View>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.body}>{item.body}</Text>
              </View>
            )}
          />

          <View style={styles.dotsRow}>
            {slides.map((s, i) => (
              <View key={s.id} style={[styles.dot, i === activeIndex && styles.dotActive]} />
            ))}
          </View>

          <Button
            mode="contained"
            onPress={handleNext}
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
      </View>
    </Modal>
  );
};

function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(12,20,35,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: sizes.lg,
    },
    card: {
      width: CARD_WIDTH,
      backgroundColor: C.surface,
      borderRadius: 28,
      paddingTop: sizes.sm,
      paddingBottom: sizes.lg,
      paddingHorizontal: sizes.lg,
    },
    skipBtn: {
      alignSelf: 'flex-end',
      paddingVertical: sizes.sm,
      paddingHorizontal: sizes.xs,
      minHeight: sizes.touchTarget,
      justifyContent: 'center',
    },
    skipText: { color: C.textSecondary, fontSize: 14, ...font.medium },
    slide: {
      width: CARD_WIDTH - sizes.lg * 2,
      alignItems: 'center',
      gap: sizes.sm,
      paddingTop: sizes.sm,
    },
    iconCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: sizes.sm,
    },
    title: {
      fontSize: 22,
      ...font.extrabold,
      color: C.textPrimary,
      textAlign: 'center',
      letterSpacing: -0.4,
    },
    body: {
      fontSize: 15,
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
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
      width: 22,
    },
    cta: { borderRadius: 14 },
    ctaContent: { height: 52 },
    ctaLabel: { fontSize: 16, ...font.semibold },
  });
}
