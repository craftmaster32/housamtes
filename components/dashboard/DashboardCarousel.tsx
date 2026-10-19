import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Animated,
  Platform,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';
import { MACHINE_META } from '@components/machines/meta';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { mf, ms } from '@utils/responsive';
import { useHeadingFont } from '@hooks/useHeadingFont';
import {
  useDashboardCardsStore,
  ALL_DASHBOARD_CARDS,
  type DashboardCardKey,
} from '@stores/dashboardCardsStore';
import {
  makeCardStyles,
  CARD_H,
  CARD_GAP as GAP,
  type CardStyles,
} from '@components/dashboard/cards/cardStyles';
import { GroceriesCard } from '@components/dashboard/cards/GroceriesCard';
import { ChoresCard } from '@components/dashboard/cards/ChoresCard';
import { VotesCard } from '@components/dashboard/cards/VotesCard';
import { ParkingCard } from '@components/dashboard/cards/ParkingCard';
import { ApplianceCard } from '@components/dashboard/cards/ApplianceCard';

// The parking card's quick-toggle tests import it from here.
export { ParkingCard };

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const CARD_ICON: Record<DashboardCardKey, IoniconName> = {
  groceries: 'cart-outline',
  chores: 'checkmark-done-outline',
  votes: 'people-outline',
  parking: 'car-outline',
  washer: MACHINE_META.washer.icon,
  dryer: MACHINE_META.dryer.icon,
  dishwasher: MACHINE_META.dishwasher.icon,
};
const CARD_LABEL_KEY: Record<DashboardCardKey, string> = {
  groceries: 'dashboard.grocery_list',
  chores: 'dashboard.tasks_label',
  votes: 'dashboard.votes_label',
  parking: 'dashboard.parking_label',
  washer: MACHINE_META.washer.labelKey,
  dryer: MACHINE_META.dryer.labelKey,
  dishwasher: MACHINE_META.dishwasher.labelKey,
};

const makeStyles = (c: ColorTokens): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: ms(8),
      marginHorizontal: ms(2),
    },
    sectionTitle: { fontSize: mf(22), letterSpacing: -0.4, color: c.textPrimary },
    editBtn: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
    editText: { fontSize: mf(15), ...font.bold, color: c.primary },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: ms(6),
      marginTop: ms(10),
    },
    dotHit: { paddingVertical: ms(6), paddingHorizontal: ms(3) },
    dot: { height: ms(7), borderRadius: ms(4) },
    splitRow: { flexDirection: 'row', gap: GAP },
    flex1: { flex: 1 },

    // empty state
    emptyCard: {
      height: CARD_H,
      borderRadius: ms(24),
      borderWidth: 1.5,
      borderColor: c.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      gap: ms(8),
    },
    emptyText: { fontSize: mf(14), ...font.semibold, color: c.textSecondary },

    // manage sheet
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: c.background,
      borderTopLeftRadius: ms(22),
      borderTopRightRadius: ms(22),
      padding: sizes.lg,
      paddingBottom: sizes.xxl,
      gap: ms(4),
    },
    sheetHandle: {
      width: ms(38),
      height: ms(4),
      borderRadius: ms(2),
      backgroundColor: c.border,
      alignSelf: 'center',
      marginBottom: ms(12),
    },
    sheetTitle: { fontSize: mf(19), ...font.bold, color: c.textPrimary },
    sheetSub: { fontSize: mf(13), ...font.regular, color: c.textSecondary, marginBottom: ms(12) },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: ms(10),
    },
    tile: {
      width: '48%',
      minHeight: ms(96),
      borderRadius: ms(16),
      borderWidth: 1.5,
      padding: ms(12),
      justifyContent: 'space-between',
      gap: ms(8),
    },
    tileOn: { borderColor: c.primary, backgroundColor: c.primary + '12' },
    tileOff: { borderColor: c.border, backgroundColor: c.surface, borderStyle: 'dashed' },
    tileHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    tileChip: {
      width: ms(34),
      height: ms(34),
      borderRadius: ms(11),
      alignItems: 'center',
      justifyContent: 'center',
    },
    tileLabel: { fontSize: mf(14.5), ...font.semibold, color: c.textPrimary },
    pinBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(4),
      alignSelf: 'flex-start',
      paddingVertical: ms(4),
      paddingHorizontal: ms(9),
      borderRadius: sizes.borderRadiusFull,
      borderWidth: 1,
    },
    pinText: { fontSize: mf(11), ...font.semibold },
    doneBtn: {
      marginTop: sizes.md,
      backgroundColor: c.primary,
      borderRadius: ms(14),
      paddingVertical: ms(13),
      alignItems: 'center',
    },
    doneText: { fontSize: mf(15), ...font.bold, color: '#fff' },
  });

function renderCard(
  key: DashboardCardKey,
  styles: CardStyles,
  c: ColorTokens,
  compact: boolean,
  pinned = false
): React.JSX.Element {
  switch (key) {
    case 'groceries':
      return <GroceriesCard styles={styles} c={c} compact={compact} pinned={pinned} />;
    case 'chores':
      return <ChoresCard styles={styles} pinned={pinned} />;
    case 'votes':
      return <VotesCard styles={styles} c={c} compact={compact} pinned={pinned} />;
    case 'parking':
      return <ParkingCard styles={styles} pinned={pinned} />;
    case 'washer':
    case 'dryer':
    case 'dishwasher':
      return <ApplianceCard styles={styles} kind={key} pinned={pinned} />;
  }
}

// ── Carousel ──────────────────────────────────────────────────────────────────
export function DashboardCarousel(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const rtl = isRTL(useLanguageStore((s) => s.language));
  const headingFont = useHeadingFont('semibold');
  const styles = useMemo(() => makeStyles(c), [c]);
  const cardStyles = useMemo(() => makeCardStyles(c), [c]);
  const enabled = useDashboardCardsStore((s) => s.enabled);
  const pinned = useDashboardCardsStore((s) => s.pinned);
  const setEnabled = useDashboardCardsStore((s) => s.setEnabled);
  const setPinned = useDashboardCardsStore((s) => s.setPinned);
  const hydrate = useDashboardCardsStore((s) => s.hydrate);

  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [manageOpen, setManageOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    hydrate().catch(() => {});
  }, [hydrate]);

  const pinnedKey = pinned && enabled.includes(pinned) ? pinned : null;
  const railKeys = pinnedKey ? enabled.filter((k) => k !== pinnedKey) : enabled;

  // Widths: a pinned card takes the left half; the carousel fills the rest and
  // peeks the next card when there's more than one.
  const pinnedW = pinnedKey && width > 0 ? Math.round((width - GAP) / 2) : 0;
  const railOuter = pinnedKey ? width - pinnedW - GAP : width;
  // Unpinned, two glanceable cards sit side by side with the third peeking in;
  // the narrow pinned rail fills its column (a thin sliver there just reads as
  // a glitch), relying on the dots instead.
  const peek = pinnedKey ? 0 : ms(28);
  const cardW =
    railOuter <= 0
      ? 0
      : pinnedKey || railKeys.length === 1
        ? railOuter
        : railKeys.length === 2
          ? Math.round((railOuter - GAP) / 2)
          : Math.round((railOuter - GAP - peek) / 2);
  const stride = cardW + GAP;

  const onLayout = useCallback((e: LayoutChangeEvent): void => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  // The horizontal scroll offset's sign in RTL is platform-specific: iOS and web
  // run it negative (0 at the right, growing negative toward the left), while
  // Android keeps it positive (0 on the left). Multiplying the raw offset by this
  // sign always yields a plain 0→N position, and using the same sign to write
  // (goTo / scrollProgress) keeps read and write consistent. LTR is always +1.
  const rtlScrollSign = rtl && Platform.OS !== 'android' ? -1 : 1;
  const syncIndex = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
      if (stride <= 0) return;
      const offset = e.nativeEvent.contentOffset.x * rtlScrollSign;
      const i = Math.max(0, Math.min(Math.round(offset / stride), railKeys.length - 1));
      setIndex((prev) => (prev === i ? prev : i));
    },
    [stride, railKeys.length, rtlScrollSign]
  );

  // Live scroll position drives the smooth dot morph (and web dot tracking).
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
        useNativeDriver: false,
        listener: syncIndex as (e: NativeSyntheticEvent<NativeScrollEvent>) => void,
      }),
    [scrollX, syncIndex]
  );

  const goTo = useCallback(
    (i: number): void => {
      scrollRef.current?.scrollTo({ x: i * stride * rtlScrollSign, animated: true });
      setIndex(i);
    },
    [stride, rtlScrollSign]
  );

  // The dot morph interpolates on a growing positive position; feed it the
  // sign-corrected offset so it grows positively on every platform.
  const scrollProgress = useMemo(
    () => (rtlScrollSign === 1 ? scrollX : Animated.multiply(scrollX, rtlScrollSign)),
    [rtlScrollSign, scrollX]
  );

  const rail =
    cardW > 0 ? (
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={stride}
        snapToAlignment="start"
        onScroll={onScroll}
        scrollEventThrottle={16}
        // The peek that reveals the next card sits on the trailing edge. In RTL
        // the row flows right-to-left, so that edge — and the inter-card gap —
        // flips to the left; keeping them on the right would shove the first
        // card off the right border and leave a gap there.
        contentContainerStyle={
          rtl ? { paddingLeft: railOuter - cardW } : { paddingRight: railOuter - cardW }
        }
      >
        {railKeys.map((key, i) => (
          <View
            key={key}
            style={{
              width: cardW,
              [rtl ? 'marginLeft' : 'marginRight']: i === railKeys.length - 1 ? 0 : GAP,
            }}
          >
            {renderCard(key, cardStyles, c, cardW < ms(220))}
          </View>
        ))}
      </ScrollView>
    ) : null;

  return (
    <View onLayout={onLayout}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, headingFont]} accessibilityRole="header">
          {t('dashboard.manage_cards')}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.6 }]}
          onPress={() => setManageOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('dashboard.manage_cards')}
        >
          <Text style={styles.editText}>{t('dashboard.edit_cards')}</Text>
        </Pressable>
      </View>

      {enabled.length === 0 ? (
        <Pressable style={styles.emptyCard} onPress={() => setManageOpen(true)}>
          <Ionicons name="add-circle-outline" size={26} color={c.textSecondary} />
          <Text style={styles.emptyText}>{t('dashboard.add_cards_prompt')}</Text>
        </Pressable>
      ) : (
        width > 0 && (
          <>
            {pinnedKey ? (
              <View style={styles.splitRow}>
                <View style={{ width: pinnedW }}>
                  {renderCard(pinnedKey, cardStyles, c, true, true)}
                </View>
                <View style={styles.flex1}>{rail}</View>
              </View>
            ) : (
              rail
            )}

            {railKeys.length > 1 && (
              <View style={styles.dots}>
                {railKeys.map((key, i) => {
                  const inputRange = [(i - 1) * stride, i * stride, (i + 1) * stride];
                  const dotWidth = scrollProgress.interpolate({
                    inputRange,
                    outputRange: [7, 22, 7],
                    extrapolate: 'clamp',
                  });
                  const dotColor = scrollProgress.interpolate({
                    inputRange,
                    outputRange: [c.border, c.primary, c.border],
                    extrapolate: 'clamp',
                  });
                  return (
                    <Pressable
                      key={key}
                      style={styles.dotHit}
                      onPress={() => goTo(i)}
                      accessibilityRole="button"
                      accessibilityLabel={t(CARD_LABEL_KEY[key])}
                      accessibilityState={{ selected: i === index }}
                    >
                      <Animated.View
                        style={[styles.dot, { width: dotWidth, backgroundColor: dotColor }]}
                      />
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        )
      )}

      <Modal
        visible={manageOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setManageOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setManageOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('dashboard.manage_cards')}</Text>
            <Text style={styles.sheetSub}>{t('dashboard.manage_cards_sub')}</Text>
            <View style={styles.grid}>
              {ALL_DASHBOARD_CARDS.map((key) => {
                const on = enabled.includes(key);
                const isPinned = pinned === key;
                return (
                  <Pressable
                    key={key}
                    style={[styles.tile, on ? styles.tileOn : styles.tileOff]}
                    onPress={() => setEnabled(key, !on)}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={t(CARD_LABEL_KEY[key])}
                  >
                    <View style={styles.tileHead}>
                      <View
                        style={[
                          styles.tileChip,
                          { backgroundColor: on ? c.primaryTint : c.surfaceSecondary },
                        ]}
                      >
                        <Ionicons
                          name={CARD_ICON[key]}
                          size={17}
                          color={on ? c.primary : c.textTertiary}
                        />
                      </View>
                      <Ionicons
                        name={on ? 'checkmark-circle' : 'add-circle-outline'}
                        size={22}
                        color={on ? c.primary : c.textTertiary}
                      />
                    </View>
                    <Text style={styles.tileLabel}>{t(CARD_LABEL_KEY[key])}</Text>
                    {on && (
                      <Pressable
                        style={[
                          styles.pinBtn,
                          {
                            borderColor: isPinned ? c.primary : c.border,
                            backgroundColor: isPinned ? c.primary : 'transparent',
                          },
                        ]}
                        onPress={() => setPinned(isPinned ? null : key)}
                        accessibilityRole="button"
                        accessibilityLabel={t('dashboard.pin_left')}
                        accessibilityState={{ selected: isPinned }}
                      >
                        <Ionicons
                          name={isPinned ? 'pin' : 'pin-outline'}
                          size={12}
                          color={isPinned ? '#fff' : c.textSecondary}
                        />
                        <Text
                          style={[styles.pinText, { color: isPinned ? '#fff' : c.textSecondary }]}
                        >
                          {isPinned ? t('dashboard.pinned') : t('dashboard.pin_left')}
                        </Text>
                      </Pressable>
                    )}
                  </Pressable>
                );
              })}
            </View>
            <Pressable style={styles.doneBtn} onPress={() => setManageOpen(false)}>
              <Text style={styles.doneText}>{t('common.done')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
