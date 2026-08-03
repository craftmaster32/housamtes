import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Switch,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
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
import { resolveName } from '@utils/housemates';
import {
  useDashboardCardsStore,
  ALL_DASHBOARD_CARDS,
  type DashboardCardKey,
} from '@stores/dashboardCardsStore';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const CARD_H = 158;
const GAP = 12;
const PARK_GRADIENT = ['#2C3E4C', '#1A2732'] as const;

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
      marginBottom: 10,
    },
    sectionLabel: {
      fontSize: 11,
      ...font.bold,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: c.textSecondary,
    },
    editBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: sizes.borderRadiusFull,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    editText: { fontSize: 12.5, ...font.semibold, color: c.textSecondary },

    shell: {
      height: CARD_H,
      borderRadius: 18,
      padding: 15,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
      justifyContent: 'space-between',
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconChip: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: { fontSize: 15, ...font.bold, color: c.textPrimary },
    cardMeta: { marginLeft: 'auto', fontSize: 12, ...font.semibold, color: c.textSecondary },

    bigStat: { fontSize: 30, ...font.extrabold, color: c.textPrimary },
    bigDenom: { fontSize: 18, ...font.bold, color: c.textTertiary },
    cardSub: { fontSize: 12.5, ...font.medium, color: c.textSecondary, marginTop: 2 },
    itemLine: { fontSize: 13.5, ...font.medium, color: c.textPrimary, marginTop: 5 },

    ringWrap: {
      marginLeft: 'auto',
      width: 46,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringPct: { position: 'absolute', fontSize: 12, ...font.bold, color: c.success },

    // parking (dark) card
    parkShell: {
      height: CARD_H,
      borderRadius: 18,
      overflow: 'hidden',
      justifyContent: 'space-between',
      padding: 15,
    },
    parkPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: sizes.borderRadiusFull,
    },
    parkPillText: { fontSize: 10.5, ...font.bold, letterSpacing: 0.4 },
    parkLabel: { fontSize: 11, ...font.semibold, color: 'rgba(255,255,255,0.6)' },
    parkStatus: { fontSize: 20, ...font.extrabold, color: '#fff', marginTop: 1 },
    parkSub: { fontSize: 12.5, ...font.medium, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

    dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
    dotHit: { padding: 4 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.border },
    dotActive: { width: 18, backgroundColor: c.primary },

    // empty state
    emptyCard: {
      height: CARD_H,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.surface,
    },
    emptyText: { fontSize: 13.5, ...font.semibold, color: c.textSecondary },

    // manage sheet
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: c.background,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      padding: sizes.lg,
      paddingBottom: sizes.xxl,
      gap: 4,
    },
    sheetTitle: { fontSize: 18, ...font.bold, color: c.textPrimary },
    sheetSub: { fontSize: 13, ...font.regular, color: c.textSecondary, marginBottom: 8 },
    manageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    manageLabel: { flex: 1, fontSize: 15, ...font.medium, color: c.textPrimary },
    doneBtn: {
      marginTop: sizes.md,
      backgroundColor: c.primary,
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: 'center',
    },
    doneText: { fontSize: 15, ...font.bold, color: '#fff' },
    switchLtr: { writingDirection: 'ltr' },
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
function GroceriesCard({ styles, c }: { styles: Styles; c: ColorTokens }): React.JSX.Element {
  const { t } = useTranslation();
  const items = useGroceryStore((s) => s.items);
  const shared = items.filter((i) => !i.isPersonal && !i.isDraft);
  const toBuy = shared.filter((i) => !i.isChecked).length;
  const preview = shared.filter((i) => !i.isChecked).slice(0, 2);
  return (
    <CardShell
      styles={styles}
      onPress={() => router.push('/(tabs)/grocery')}
      accessibilityLabel={t('dashboard.grocery_list')}
    >
      <View style={styles.cardTop}>
        <IconChip styles={styles} icon="cart-outline" tint={c.warningTint} color={c.warning} />
        <Text style={styles.cardTitle}>{t('dashboard.grocery_list')}</Text>
        <Text style={styles.cardMeta}>{t('dashboard.n_to_buy', { count: toBuy })}</Text>
      </View>
      <View>
        {preview.length === 0 ? (
          <Text style={styles.cardSub}>{t('dashboard.grocery_empty')}</Text>
        ) : (
          preview.map((i) => (
            <Text key={i.id} style={styles.itemLine} numberOfLines={1}>
              • {i.name}
            </Text>
          ))
        )}
      </View>
    </CardShell>
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

function VotesCard({ styles, c }: { styles: Styles; c: ColorTokens }): React.JSX.Element {
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
        <Text style={styles.cardTitle}>{t('dashboard.votes_label')}</Text>
        <Text style={styles.cardMeta}>{t('dashboard.votes_open', { count: open.length })}</Text>
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
  const current = useParkingStore((s) => s.current);
  const housemates = useHousematesStore((s) => s.housemates);
  const isFree = !current;
  const accent = isFree ? '#8FE0AC' : '#FF8478';
  const pillBg = isFree ? 'rgba(79,176,113,0.16)' : 'rgba(255,97,85,0.16)';
  const occupant = resolveName(current?.occupant ?? '', housemates, '').split(' ')[0];
  return (
    <Pressable
      style={({ pressed }) => [styles.parkShell, pressed && { opacity: 0.9 }]}
      onPress={() => router.push('/(tabs)/parking')}
      accessibilityRole="button"
      accessibilityLabel={t('dashboard.parking_label')}
    >
      <LinearGradient
        colors={PARK_GRADIENT}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
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
        <Text style={styles.parkSub} numberOfLines={1}>
          {isFree ? t('dashboard.parking_first_come') : occupant || t('common.unknown')}
        </Text>
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

function renderCard(key: DashboardCardKey, styles: Styles, c: ColorTokens): React.JSX.Element {
  switch (key) {
    case 'groceries':
      return <GroceriesCard styles={styles} c={c} />;
    case 'chores':
      return <ChoresCard styles={styles} c={c} />;
    case 'votes':
      return <VotesCard styles={styles} c={c} />;
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
  const setEnabled = useDashboardCardsStore((s) => s.setEnabled);
  const hydrate = useDashboardCardsStore((s) => s.hydrate);

  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [manageOpen, setManageOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    hydrate().catch(() => {});
  }, [hydrate]);

  const cardW = width > 0 ? width - 40 : 0;
  const stride = cardW + GAP;

  const onLayout = useCallback((e: LayoutChangeEvent): void => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
      if (stride <= 0) return;
      const i = Math.round(e.nativeEvent.contentOffset.x / stride);
      setIndex(Math.max(0, Math.min(i, enabled.length - 1)));
    },
    [stride, enabled.length]
  );

  const goTo = useCallback(
    (i: number): void => {
      scrollRef.current?.scrollTo({ x: i * stride, animated: true });
      setIndex(i);
    },
    [stride]
  );

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
        cardW > 0 && (
          <>
            <ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={stride}
              snapToAlignment="start"
              disableIntervalMomentum
              onMomentumScrollEnd={onScrollEnd}
              contentContainerStyle={{ paddingRight: width - cardW }}
            >
              {enabled.map((key, i) => (
                <View
                  key={key}
                  style={{ width: cardW, marginRight: i === enabled.length - 1 ? 0 : GAP }}
                >
                  {renderCard(key, styles, c)}
                </View>
              ))}
            </ScrollView>

            {enabled.length > 1 && (
              <View style={styles.dots}>
                {enabled.map((key, i) => (
                  <Pressable
                    key={key}
                    style={styles.dotHit}
                    onPress={() => goTo(i)}
                    accessibilityRole="button"
                    accessibilityLabel={t(CARD_LABEL_KEY[key])}
                    accessibilityState={{ selected: i === index }}
                  >
                    <View style={[styles.dot, i === index && styles.dotActive]} />
                  </Pressable>
                ))}
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
            <Text style={styles.sheetTitle}>{t('dashboard.manage_cards')}</Text>
            <Text style={styles.sheetSub}>{t('dashboard.manage_cards_sub')}</Text>
            {ALL_DASHBOARD_CARDS.map((key) => {
              const on = enabled.includes(key);
              return (
                <View style={styles.manageRow} key={key}>
                  <Ionicons name={CARD_ICON[key]} size={18} color={c.textSecondary} />
                  <Text style={styles.manageLabel}>{t(CARD_LABEL_KEY[key])}</Text>
                  <Switch
                    value={on}
                    onValueChange={(v) => setEnabled(key, v)}
                    trackColor={{ false: c.border, true: c.primary + '80' }}
                    thumbColor={on ? c.primary : c.surface}
                    style={styles.switchLtr}
                    accessibilityLabel={t(CARD_LABEL_KEY[key])}
                  />
                </View>
              );
            })}
            <Pressable style={styles.doneBtn} onPress={() => setManageOpen(false)}>
              <Text style={styles.doneText}>{t('common.done')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
