import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Animated,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Circle,
  Path,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Mask,
  Rect,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';
import { useGroceryStore } from '@stores/groceryStore';
import { useTasksStore } from '@stores/tasksStore';
import { useVotingStore } from '@stores/votingStore';
import { useParkingStore } from '@stores/parkingStore';
import { useBillsStore } from '@stores/billsStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { resolveName } from '@utils/housemates';
import { mf, ms } from '@utils/responsive';
import {
  useDashboardCardsStore,
  ALL_DASHBOARD_CARDS,
  type DashboardCardKey,
} from '@stores/dashboardCardsStore';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const CARD_H = ms(158);
const GAP = ms(12);
const PARK_GRADIENT = ['#2C3E4C', '#1A2732'] as const;
// Sleek car silhouette, drawn once and reused as the parking card's faint
// backdrop. Fills the otherwise-empty right half of the card.
const CAR_PATH =
  'M10 70 Q10 62 22 60 L40 58 C48 46 60 40 74 39 L96 39 C112 39 122 46 130 58 ' +
  'L146 62 Q152 64 152 72 L152 74 Q152 78 147 78 L133 78 A13 13 0 0 0 107 78 ' +
  'L66 78 A13 13 0 0 0 40 78 L15 78 Q10 78 10 72 Z';

const CARD_ICON: Record<DashboardCardKey, IoniconName> = {
  groceries: 'cart-outline',
  chores: 'checkmark-done-outline',
  votes: 'people-outline',
  parking: 'car-outline',
  bills: 'card-outline',
};
const CARD_LABEL_KEY: Record<DashboardCardKey, string> = {
  groceries: 'dashboard.grocery_list',
  chores: 'dashboard.tasks_label',
  votes: 'dashboard.votes_label',
  parking: 'dashboard.parking_label',
  bills: 'dashboard.bills_label',
};

const makeStyles = (c: ColorTokens): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: ms(10),
    },
    sectionLabel: {
      fontSize: mf(11),
      ...font.bold,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: c.textSecondary,
    },
    editBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(4),
      paddingVertical: ms(4),
      paddingHorizontal: ms(8),
      borderRadius: sizes.borderRadiusFull,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    editText: { fontSize: mf(12.5), ...font.semibold, color: c.textSecondary },

    shell: {
      height: CARD_H,
      borderRadius: ms(18),
      padding: ms(15),
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
      justifyContent: 'space-between',
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: ms(10) },
    iconChip: {
      width: ms(34),
      height: ms(34),
      borderRadius: ms(11),
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: { flexShrink: 1, fontSize: mf(15), ...font.bold, color: c.textPrimary },
    cardMeta: {
      marginLeft: 'auto',
      flexShrink: 0,
      fontSize: mf(12),
      ...font.semibold,
      color: c.textSecondary,
    },

    bigStat: { fontSize: mf(30), ...font.extrabold, color: c.textPrimary },
    bigDenom: { fontSize: mf(18), ...font.bold, color: c.textTertiary },
    cardSub: { fontSize: mf(12.5), ...font.medium, color: c.textSecondary, marginTop: ms(2) },
    groceryRow: { flexDirection: 'row', alignItems: 'center', gap: ms(9), paddingVertical: ms(5) },
    groceryBox: {
      width: ms(18),
      height: ms(18),
      borderRadius: ms(6),
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    groceryName: { flex: 1, fontSize: mf(13.5), ...font.medium },
    groceryDone: { textDecorationLine: 'line-through' },

    ringWrap: {
      marginLeft: 'auto',
      width: ms(46),
      height: ms(46),
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringPct: { position: 'absolute', fontSize: mf(12), ...font.bold, color: c.success },

    // parking (dark) card
    parkShell: {
      height: CARD_H,
      borderRadius: ms(18),
      overflow: 'hidden',
      justifyContent: 'space-between',
      padding: ms(15),
    },
    // LTR: car sits in the bottom-right corner. RTL: mirror it to the
    // bottom-left (scaleX flips both the silhouette's facing and its fade so
    // the solid body lands away from the right-aligned Hebrew text).
    parkArt: {
      position: 'absolute',
      right: ms(-14),
      bottom: ms(-4),
    },
    parkArtNarrow: {
      position: 'absolute',
      right: ms(-14),
      bottom: ms(-2),
    },
    parkArtRTL: {
      position: 'absolute',
      left: ms(-14),
      bottom: ms(-4),
      transform: [{ scaleX: -1 }],
    },
    parkArtNarrowRTL: {
      position: 'absolute',
      left: ms(-14),
      bottom: ms(-2),
      transform: [{ scaleX: -1 }],
    },
    parkPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: ms(9),
      paddingVertical: ms(3),
      borderRadius: sizes.borderRadiusFull,
    },
    parkPillText: { fontSize: mf(10.5), ...font.bold, letterSpacing: 0.4 },
    parkLabel: { fontSize: mf(11), ...font.semibold, color: 'rgba(255,255,255,0.6)' },
    parkStatus: { fontSize: mf(20), ...font.extrabold, color: '#fff', marginTop: ms(1) },
    parkSub: {
      fontSize: mf(12.5),
      ...font.medium,
      color: 'rgba(255,255,255,0.7)',
      marginTop: ms(2),
    },

    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: ms(6),
      marginTop: ms(12),
    },
    dotHit: { paddingVertical: ms(6), paddingHorizontal: ms(3) },
    dot: { height: ms(7), borderRadius: ms(4) },
    splitRow: { flexDirection: 'row', gap: ms(12) },
    flex1: { flex: 1 },

    // empty state
    emptyCard: {
      height: CARD_H,
      borderRadius: ms(18),
      borderWidth: 1,
      borderColor: c.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      gap: ms(8),
      backgroundColor: c.surface,
    },
    emptyText: { fontSize: mf(13.5), ...font.semibold, color: c.textSecondary },

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

type Styles = ReturnType<typeof makeStyles>;

// ── Shared card shell ─────────────────────────────────────────────────────────
function CardShell({
  styles,
  onPress,
  accessibilityLabel,
  children,
}: {
  styles: Styles;
  onPress: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [styles.shell, pressed && { opacity: 0.9 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </Pressable>
  );
}

function IconChip({
  styles,
  icon,
  tint,
  color,
}: {
  styles: Styles;
  icon: IoniconName;
  tint: string;
  color: string;
}): React.JSX.Element {
  return (
    <View style={[styles.iconChip, { backgroundColor: tint }]}>
      <Ionicons name={icon} size={17} color={color} />
    </View>
  );
}

// ── Individual cards ──────────────────────────────────────────────────────────
function GroceriesCard({
  styles,
  c,
  compact,
}: {
  styles: Styles;
  c: ColorTokens;
  compact: boolean;
}): React.JSX.Element {
  const { t } = useTranslation();
  const items = useGroceryStore((s) => s.items);
  const toggleItem = useGroceryStore((s) => s.toggleItem);
  const shared = items.filter((i) => !i.isPersonal && !i.isDraft);
  const toBuy = shared.filter((i) => !i.isChecked).length;
  const preview = shared.slice(0, compact ? 2 : 3);
  const onToggle = useCallback(
    (id: string): void => {
      toggleItem(id).catch(() => {});
    },
    [toggleItem]
  );
  // Header navigates; the item rows are tappable to tick off in place, so this
  // card is a working mini-list rather than a static Pressable.
  return (
    <View style={styles.shell}>
      <Pressable
        style={styles.cardTop}
        onPress={() => router.push('/(tabs)/grocery')}
        accessibilityRole="button"
        accessibilityLabel={t('dashboard.grocery_list')}
      >
        <IconChip styles={styles} icon="cart-outline" tint={c.warningTint} color={c.warning} />
        <Text style={styles.cardTitle} numberOfLines={1}>
          {t('dashboard.grocery_list')}
        </Text>
        {!compact && (
          <Text style={styles.cardMeta}>{t('dashboard.n_to_buy', { count: toBuy })}</Text>
        )}
      </Pressable>
      <View>
        {preview.length === 0 ? (
          <Text style={styles.cardSub}>{t('dashboard.grocery_empty')}</Text>
        ) : (
          preview.map((item) => (
            <Pressable
              key={item.id}
              style={styles.groceryRow}
              onPress={() => onToggle(item.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.isChecked }}
              accessibilityLabel={item.name}
            >
              <View
                style={[
                  styles.groceryBox,
                  item.isChecked
                    ? { backgroundColor: c.success, borderColor: c.success }
                    : { borderColor: c.border },
                ]}
              >
                {item.isChecked && <Ionicons name="checkmark" size={11} color="#fff" />}
              </View>
              <Text
                style={[
                  styles.groceryName,
                  { color: item.isChecked ? c.textTertiary : c.textPrimary },
                  item.isChecked && styles.groceryDone,
                ]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
            </Pressable>
          ))
        )}
      </View>
    </View>
  );
}

function ChoresCard({ styles, c }: { styles: Styles; c: ColorTokens }): React.JSX.Element {
  const { t } = useTranslation();
  const tasks = useTasksStore((s) => s.tasks);
  const total = tasks.length;
  const done = tasks.filter((tk) => tk.isComplete).length;
  const next = tasks.find((tk) => !tk.isComplete);
  const R = 18;
  const CIRC = 2 * Math.PI * R;
  const pct = total > 0 ? done / total : 0;
  return (
    <CardShell
      styles={styles}
      onPress={() => router.push('/(tabs)/tasks')}
      accessibilityLabel={t('dashboard.x_of_y_done', { done, total })}
    >
      <View style={styles.cardTop}>
        <IconChip
          styles={styles}
          icon="checkmark-done-outline"
          tint={c.success + '22'}
          color={c.success}
        />
        <Text style={styles.cardTitle}>{t('dashboard.tasks_label')}</Text>
        <View style={styles.ringWrap}>
          <Svg width={46} height={46} viewBox="0 0 46 46">
            <Circle cx={23} cy={23} r={R} fill="none" stroke={c.surfaceSecondary} strokeWidth={5} />
            <Circle
              cx={23}
              cy={23}
              r={R}
              fill="none"
              stroke={c.success}
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - pct)}
              transform="rotate(-90 23 23)"
            />
          </Svg>
          {total > 0 && <Text style={styles.ringPct}>{Math.round(pct * 100)}%</Text>}
        </View>
      </View>
      <View>
        <Text style={styles.bigStat}>
          {done}
          <Text style={styles.bigDenom}>/{total}</Text>
        </Text>
        <Text style={styles.cardSub} numberOfLines={1}>
          {next ? t('dashboard.chore_next', { name: next.title }) : t('dashboard.chores_smashed')}
        </Text>
      </View>
    </CardShell>
  );
}

function VotesCard({
  styles,
  c,
  compact,
}: {
  styles: Styles;
  c: ColorTokens;
  compact: boolean;
}): React.JSX.Element {
  const { t } = useTranslation();
  const proposals = useVotingStore((s) => s.proposals);
  const open = proposals.filter((p) => p.isOpen);
  const next = open[0];
  return (
    <CardShell
      styles={styles}
      onPress={() => router.push('/(tabs)/voting')}
      accessibilityLabel={t('dashboard.votes_label')}
    >
      <View style={styles.cardTop}>
        <IconChip styles={styles} icon="people-outline" tint={c.primaryTint} color={c.primary} />
        <Text style={styles.cardTitle} numberOfLines={1}>
          {t('dashboard.votes_label')}
        </Text>
        {!compact && (
          <Text style={styles.cardMeta}>{t('dashboard.votes_open', { count: open.length })}</Text>
        )}
      </View>
      <View>
        <Text style={styles.bigStat}>{open.length}</Text>
        <Text style={styles.cardSub} numberOfLines={1}>
          {next ? next.title : t('dashboard.votes_none')}
        </Text>
      </View>
    </CardShell>
  );
}

function ParkingCard({ styles }: { styles: Styles }): React.JSX.Element {
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const rtl = isRTL(language);
  const current = useParkingStore((s) => s.current);
  const housemates = useHousematesStore((s) => s.housemates);
  const [cardW, setCardW] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent): void => {
    setCardW(e.nativeEvent.layout.width);
  }, []);
  const isFree = !current;
  const accent = isFree ? '#8FE0AC' : '#FF8478';
  const pillBg = isFree ? 'rgba(79,176,113,0.16)' : 'rgba(255,97,85,0.16)';
  const occupant = resolveName(current?.occupant ?? '', housemates, '').split(' ')[0];
  // When another card is pinned this one renders at ~half width, so the car is
  // sized and faded a little differently there than at full width.
  const narrow = cardW === 0 || cardW < 210;
  // The car fills the empty side of the card and reaches toward the middle so
  // there's no dead band next to the (now short) status text — capped by the
  // card height. It's bolder when free and pulls back a touch when taken.
  const carW = narrow ? (isFree ? ms(140) : ms(120)) : Math.min(cardW * 0.66, ms(240));
  const carH = carW / 1.6;
  // Left edge of the car fades in; held back further when there is text to
  // protect (taken, or the tight pinned width) and let bolder when free.
  const fadeHold = isFree ? (narrow ? 0.12 : 0) : narrow ? 0.5 : 0;
  const fadeSolid = isFree ? (narrow ? 0.42 : 0.15) : narrow ? 0.78 : 0.32;
  const artStyle = rtl
    ? narrow
      ? styles.parkArtNarrowRTL
      : styles.parkArtRTL
    : narrow
      ? styles.parkArtNarrow
      : styles.parkArt;
  const handleParkingPress = useCallback((): void => {
    router.push('/(tabs)/parking');
  }, []);
  return (
    <Pressable
      style={({ pressed }) => [styles.parkShell, pressed && { opacity: 0.9 }]}
      onPress={handleParkingPress}
      onLayout={onLayout}
      accessibilityRole="button"
      accessibilityLabel={t('dashboard.parking_label')}
    >
      <LinearGradient
        colors={PARK_GRADIENT}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={artStyle} pointerEvents="none">
        <Svg width={carW} height={carH} viewBox="0 0 160 100">
          <Defs>
            {/* A transparent lead-in on the text side dissolves the car before
                it reaches the words, then it turns solid toward its own edge. */}
            <SvgLinearGradient id="parkFade" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#fff" stopOpacity={0} />
              <Stop offset={fadeHold} stopColor="#fff" stopOpacity={0} />
              <Stop offset={fadeSolid} stopColor="#fff" stopOpacity={1} />
            </SvgLinearGradient>
            <Mask id="parkFadeMask">
              <Rect x="0" y="0" width="160" height="100" fill="url(#parkFade)" />
            </Mask>
          </Defs>
          <Path d={CAR_PATH} fill={accent} opacity={isFree ? 0.5 : 0.4} mask="url(#parkFadeMask)" />
        </Svg>
      </View>
      <View style={[styles.parkPill, { backgroundColor: pillBg }]}>
        <Text style={[styles.parkPillText, { color: accent }]}>
          {isFree ? t('dashboard.parking_free').toUpperCase() : t('parking.taken').toUpperCase()}
        </Text>
      </View>
      <View>
        <Text style={styles.parkLabel}>{t('dashboard.parking_label')}</Text>
        <Text style={styles.parkStatus}>
          {isFree ? t('dashboard.parking_free') : t('dashboard.parking_in_use')}
        </Text>
        {/* When free, the car is the hero — no sub-line to crowd it. When taken,
            show who has the spot. */}
        {!isFree && (
          <Text style={styles.parkSub} numberOfLines={1}>
            {occupant || t('common.unknown')}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function BillsCard({ styles, c }: { styles: Styles; c: ColorTokens }): React.JSX.Element {
  const { t } = useTranslation();
  const bills = useBillsStore((s) => s.bills);
  const unsettled = bills.filter((b) => !b.settled).length;
  return (
    <CardShell
      styles={styles}
      onPress={() => router.push('/(tabs)/bills')}
      accessibilityLabel={t('dashboard.bills_label')}
    >
      <View style={styles.cardTop}>
        <IconChip styles={styles} icon="card-outline" tint={c.primaryTint} color={c.primary} />
        <Text style={styles.cardTitle}>{t('dashboard.bills_label')}</Text>
      </View>
      <View>
        <Text style={styles.bigStat}>{unsettled}</Text>
        <Text style={styles.cardSub}>
          {unsettled > 0
            ? t('dashboard.bills_unsettled', { count: unsettled })
            : t('dashboard.bills_settled')}
        </Text>
      </View>
    </CardShell>
  );
}

function renderCard(
  key: DashboardCardKey,
  styles: Styles,
  c: ColorTokens,
  compact: boolean
): React.JSX.Element {
  switch (key) {
    case 'groceries':
      return <GroceriesCard styles={styles} c={c} compact={compact} />;
    case 'chores':
      return <ChoresCard styles={styles} c={c} />;
    case 'votes':
      return <VotesCard styles={styles} c={c} compact={compact} />;
    case 'parking':
      return <ParkingCard styles={styles} />;
    case 'bills':
      return <BillsCard styles={styles} c={c} />;
  }
}

// ── Carousel ──────────────────────────────────────────────────────────────────
export function DashboardCarousel(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const styles = useMemo(() => makeStyles(c), [c]);
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
  // Full-width rail peeks the next card; the narrow pinned rail fills its column
  // (a thin sliver there just reads as a glitch), relying on the dots instead.
  const peek = pinnedKey ? 0 : 40;
  const cardW = railOuter > 0 ? (railKeys.length > 1 && peek ? railOuter - peek : railOuter) : 0;
  const stride = cardW + GAP;

  const onLayout = useCallback((e: LayoutChangeEvent): void => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  const syncIndex = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
      if (stride <= 0) return;
      const i = Math.max(
        0,
        Math.min(Math.round(e.nativeEvent.contentOffset.x / stride), railKeys.length - 1)
      );
      setIndex((prev) => (prev === i ? prev : i));
    },
    [stride, railKeys.length]
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
      scrollRef.current?.scrollTo({ x: i * stride, animated: true });
      setIndex(i);
    },
    [stride]
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
        contentContainerStyle={{ paddingRight: railOuter - cardW }}
      >
        {railKeys.map((key, i) => (
          <View
            key={key}
            style={{ width: cardW, marginRight: i === railKeys.length - 1 ? 0 : GAP }}
          >
            {renderCard(key, styles, c, pinnedKey !== null)}
          </View>
        ))}
      </ScrollView>
    ) : null;

  return (
    <View onLayout={onLayout}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>{t('dashboard.manage_cards')}</Text>
        <Pressable
          style={styles.editBtn}
          onPress={() => setManageOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('dashboard.manage_cards')}
        >
          <Ionicons name="options-outline" size={14} color={c.textSecondary} />
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
                <View style={{ width: pinnedW }}>{renderCard(pinnedKey, styles, c, false)}</View>
                <View style={styles.flex1}>{rail}</View>
              </View>
            ) : (
              rail
            )}

            {railKeys.length > 1 && (
              <View style={styles.dots}>
                {railKeys.map((key, i) => {
                  const inputRange = [(i - 1) * stride, i * stride, (i + 1) * stride];
                  const dotWidth = scrollX.interpolate({
                    inputRange,
                    outputRange: [7, 22, 7],
                    extrapolate: 'clamp',
                  });
                  const dotColor = scrollX.interpolate({
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
