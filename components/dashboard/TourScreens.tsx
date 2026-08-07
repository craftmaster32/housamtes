import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import type { TFunction } from 'i18next';
import { type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

export type TourScreenId = 'bills' | 'spending' | 'grocery' | 'calendar';

// Background app content is shown at this opacity so the screen reads as the
// real app, while the spotlighted control (full opacity + ring) stands out.
const DIM = 0.5;

// ── Pulsing spotlight ring drawn around the highlighted control ──────────────
// Opacity-only pulse (no scale) so it hugs targets of any width correctly.
interface HighlightProps {
  C: ColorTokens;
  radius: number;
  children: React.ReactNode;
}

export const Highlight: React.FC<HighlightProps> = ({ C, radius, children }) => {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return (): void => loop.stop();
  }, [pulse]);

  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.6] });

  return (
    <View style={styles.highlightWrap}>
      <Animated.View
        pointerEvents="none"
        style={[styles.ring, { borderColor: C.primary, borderRadius: radius + 7, opacity: glow }]}
      />
      <View style={[styles.ringStatic, { borderColor: C.primary, borderRadius: radius + 3 }]}>
        {children}
      </View>
    </View>
  );
};

// ── The persistent bottom nav bar ────────────────────────────────────────────
export function TourBottomBar({
  C,
  highlightAdd,
  addLabel,
}: {
  C: ColorTokens;
  highlightAdd: boolean;
  addLabel: string;
}): React.JSX.Element {
  const tab = (name: keyof typeof Ionicons.glyphMap): React.JSX.Element => (
    <View style={styles.barTab}>
      <Ionicons name={name} size={24} color={C.textSecondary} style={{ opacity: DIM }} />
    </View>
  );
  const addBtn = (
    <View
      style={[styles.addBtn, { backgroundColor: C.surface, borderColor: C.border }]}
      accessibilityLabel={addLabel}
    >
      <Ionicons name="add" size={28} color={C.primary} />
    </View>
  );
  return (
    <View style={[styles.bar, { backgroundColor: C.background, borderTopColor: C.border }]}>
      {tab('home-outline')}
      {tab('card-outline')}
      <View style={styles.barCenter}>
        {highlightAdd ? (
          <Highlight C={C} radius={26}>
            {addBtn}
          </Highlight>
        ) : (
          <View style={styles.barAddDim}>{addBtn}</View>
        )}
      </View>
      {tab('car-outline')}
      {tab('ellipsis-horizontal')}
    </View>
  );
}

interface ScreenProps {
  C: ColorTokens;
  t: TFunction;
  currency: string;
}

// ── Bills — sample expense rows; the spotlight is the bar's + (controller) ────
function BillsScreen({ C, t, currency }: ScreenProps): React.JSX.Element {
  const rows: Array<{
    icon: keyof typeof Ionicons.glyphMap;
    tint: string;
    title: string;
    amount: string;
    who: string;
  }> = [
    { icon: 'flash', tint: '#E0912F', title: t('tour.demo_electricity'), amount: '84', who: 'S' },
    { icon: 'wifi', tint: C.primary, title: t('tour.demo_internet'), amount: '39', who: 'D' },
    { icon: 'water', tint: '#3FA0C9', title: t('tour.demo_water'), amount: '22', who: 'A' },
  ];
  return (
    <View style={[styles.body, { opacity: DIM }]}>
      <Text style={[styles.title, { color: C.textPrimary }]}>{t('bills.title')}</Text>
      <Text style={[styles.sub, { color: C.textSecondary }]}>{t('bills.page_subtitle')}</Text>
      <View style={styles.rows}>
        {rows.map((r) => (
          <View
            key={r.title}
            style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}
          >
            <View style={[styles.chip, { backgroundColor: r.tint + '22' }]}>
              <Ionicons name={r.icon} size={18} color={r.tint} />
            </View>
            <View style={styles.cardMeta}>
              <Text style={[styles.rowTitle, { color: C.textPrimary }]}>{r.title}</Text>
              <Text style={[styles.rowSub, { color: C.textSecondary }]}>{t('bills.paid_by')}</Text>
            </View>
            <Text style={[styles.amount, { color: C.textPrimary }]}>
              {currency}
              {r.amount}
            </Text>
            <View style={[styles.avatar, { backgroundColor: C.primary }]}>
              <Text style={styles.avatarText}>{r.who}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Spending — summary + monthly bar chart (the chart is the spotlight) ───────
function SpendingScreen({ C, t, currency }: ScreenProps): React.JSX.Element {
  const bars = [40, 56, 44, 72, 50, 92];
  const peak = Math.max(...bars);
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) =>
    new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      .toLocaleDateString(undefined, { month: 'short' })
      .slice(0, 3)
  );
  const summary = [
    { label: t('spending.house_total'), value: `${currency}1,240` },
    { label: t('spending.your_share'), value: `${currency}413` },
  ];
  return (
    <View style={styles.body}>
      <Text style={[styles.title, { color: C.textPrimary, opacity: DIM }]}>
        {t('spending.spending_analysis')}
      </Text>
      <View style={[styles.sumRow, { opacity: DIM }]}>
        {summary.map((s) => (
          <View
            key={s.label}
            style={[styles.sumCard, { backgroundColor: C.surface, borderColor: C.border }]}
          >
            <Text style={[styles.sumLabel, { color: C.textSecondary }]}>{s.label}</Text>
            <Text style={[styles.sumValue, { color: C.textPrimary }]}>{s.value}</Text>
          </View>
        ))}
      </View>
      <Highlight C={C} radius={20}>
        <View style={[styles.chartCard, { backgroundColor: C.surface, borderColor: C.border }]}>
          <View style={[styles.seg, { backgroundColor: C.surfaceSecondary }]}>
            <View style={[styles.segOn, { backgroundColor: C.primary }]}>
              <Text style={styles.segOnText}>{t('spending.house_label')}</Text>
            </View>
            <Text style={[styles.segText, { color: C.textSecondary }]}>
              {t('spending.personal_label')}
            </Text>
          </View>
          <Text style={[styles.chartTitle, { color: C.textPrimary }]}>
            {t('spending.monthly_trend')}
          </Text>
          <View style={styles.bars}>
            {bars.map((h, i) => (
              <View key={months[i]} style={styles.barCol}>
                <View
                  style={[
                    styles.barFill,
                    { height: `${h}%`, backgroundColor: h === peak ? C.primary : C.primary + '66' },
                  ]}
                />
                <Text style={[styles.barLabel, { color: C.textSecondary }]}>{months[i]}</Text>
              </View>
            ))}
          </View>
        </View>
      </Highlight>
    </View>
  );
}

// ── Groceries — the add row is the spotlight, with a real-looking list below ──
function GroceryScreen({ C, t }: ScreenProps): React.JSX.Element {
  const items: Array<{ name: string; qty: string; done: boolean }> = [
    { name: t('grocery.quick_add_milk'), qty: '×2', done: false },
    { name: t('grocery.quick_add_bread'), qty: '', done: false },
    { name: t('grocery.quick_add_coffee'), qty: '', done: true },
  ];
  return (
    <View style={styles.body}>
      <Text style={[styles.title, { color: C.textPrimary, opacity: DIM }]}>
        {t('grocery.shared_groceries')}
      </Text>
      <Text style={[styles.sub, { color: C.textSecondary, opacity: DIM }]}>
        {t('grocery.add_things_hint')}
      </Text>
      <Highlight C={C} radius={14}>
        <View style={styles.addRow}>
          <View style={[styles.addInput, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[styles.addInputText, { color: C.textTertiary }]}>
              {t('grocery.item_placeholder')}
            </Text>
          </View>
          <View style={[styles.addSquare, { backgroundColor: C.primary }]}>
            <Ionicons name="add" size={24} color="#fff" />
          </View>
        </View>
      </Highlight>
      <View style={[styles.groceryList, { opacity: DIM }]}>
        {items.map((it) => (
          <View
            key={it.name}
            style={[styles.gRow, { backgroundColor: C.surface, borderColor: C.border }]}
          >
            <Ionicons
              name={it.done ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={it.done ? C.positive : C.textTertiary}
            />
            <Text
              style={[
                styles.gName,
                { color: it.done ? C.textSecondary : C.textPrimary },
                it.done && styles.gDone,
              ]}
            >
              {it.name}
            </Text>
            {!!it.qty && <Text style={[styles.gQty, { color: C.textSecondary }]}>{it.qty}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Calendar — real month grid with day numbers + a few event dots ───────────
function CalendarScreen({ C, t }: ScreenProps): React.JSX.Element {
  const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const events: Record<number, string[]> = {
    8: [C.primary],
    14: [C.positive, '#E0912F'],
    22: ['#8B5CF6'],
  };
  const today = 12;
  const cells = Array.from({ length: 35 }, (_, i) => {
    const day = i - 3;
    return day >= 1 && day <= 30 ? day : null;
  });
  return (
    <View style={styles.body}>
      <View style={styles.calHead}>
        <View style={{ opacity: DIM }}>
          <Text style={[styles.title, { color: C.textPrimary }]}>{t('calendar.title')}</Text>
          <Text style={[styles.sub, { color: C.textSecondary }]}>
            {t('calendar.house_schedule')}
          </Text>
        </View>
        <Highlight C={C} radius={13}>
          <View style={[styles.addPill, { backgroundColor: C.primary }]}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.addPillText}>{t('calendar.add_event')}</Text>
          </View>
        </Highlight>
      </View>
      <View style={[styles.weekRow, { opacity: DIM }]}>
        {weekdays.map((w, i) => (
          <Text key={i} style={[styles.weekday, { color: C.textSecondary }]}>
            {w}
          </Text>
        ))}
      </View>
      <View style={[styles.grid, { opacity: DIM }]}>
        {cells.map((day, i) => {
          const isToday = day === today;
          return (
            <View
              key={i}
              style={[
                styles.calCell,
                { backgroundColor: isToday ? C.primary : C.surface, borderColor: C.border },
              ]}
            >
              {day != null && (
                <>
                  <Text style={[styles.calDay, { color: isToday ? '#fff' : C.textPrimary }]}>
                    {day}
                  </Text>
                  {!!events[day] && (
                    <View style={styles.calDots}>
                      {events[day].map((col, k) => (
                        <View
                          key={k}
                          style={[styles.calDot, { backgroundColor: isToday ? '#fff' : col }]}
                        />
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Welcome backdrop — a faint populated dashboard ───────────────────────────
export function WelcomeBg({ C }: { C: ColorTokens }): React.JSX.Element {
  return (
    <View style={[styles.body, { opacity: DIM }]}>
      <Text style={[styles.title, { color: C.textPrimary }]}>HouseMates</Text>
      <View style={styles.welcomeBgCards}>
        <View style={[styles.wCard, { backgroundColor: C.surface, borderColor: C.border }]} />
        <View
          style={[
            styles.wCard,
            styles.wCardTall,
            { backgroundColor: C.surface, borderColor: C.border },
          ]}
        />
      </View>
    </View>
  );
}

export function TourScreen({
  id,
  C,
  t,
  currency,
}: {
  id: TourScreenId;
  C: ColorTokens;
  t: TFunction;
  currency: string;
}): React.JSX.Element {
  switch (id) {
    case 'bills':
      return <BillsScreen C={C} t={t} currency={currency} />;
    case 'spending':
      return <SpendingScreen C={C} t={t} currency={currency} />;
    case 'grocery':
      return <GroceryScreen C={C} t={t} currency={currency} />;
    case 'calendar':
      return <CalendarScreen C={C} t={t} currency={currency} />;
  }
}

const styles = StyleSheet.create({
  highlightWrap: { alignSelf: 'stretch' },
  ring: { position: 'absolute', top: -7, left: -7, right: -7, bottom: -7, borderWidth: 2 },
  ringStatic: { borderWidth: 2 },
  body: { flex: 1, paddingHorizontal: sizes.lg, paddingTop: sizes.xl + sizes.lg, gap: sizes.sm },
  title: { fontSize: 26, ...font.extrabold, letterSpacing: -0.7 },
  sub: { fontSize: 13, ...font.regular },
  welcomeBgCards: { marginTop: sizes.sm, gap: 10 },
  wCard: { height: 66, borderRadius: 18, borderWidth: 1 },
  wCardTall: { height: 96 },
  // Bills rows
  rows: { marginTop: sizes.sm, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  chip: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  cardMeta: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 14.5, ...font.bold },
  rowSub: { fontSize: 11.5, ...font.regular },
  amount: { fontSize: 15, ...font.extrabold, fontVariant: ['tabular-nums'] },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 11, ...font.bold, color: '#fff' },
  // Bottom bar
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    paddingBottom: 18,
  },
  barTab: { flex: 1, alignItems: 'center' },
  barCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  barAddDim: { opacity: DIM },
  addBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  // Spending
  sumRow: { flexDirection: 'row', gap: 10, marginTop: sizes.sm },
  sumCard: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 12, gap: 4 },
  sumLabel: { fontSize: 11, ...font.semibold },
  sumValue: { fontSize: 20, ...font.extrabold, fontVariant: ['tabular-nums'] },
  chartCard: { borderWidth: 1, borderRadius: 20, padding: 16, marginTop: sizes.xs },
  seg: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderRadius: 999,
    padding: 3,
    gap: 2,
    marginBottom: 12,
  },
  segOn: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5 },
  segOnText: { fontSize: 11, ...font.bold, color: '#fff' },
  segText: { fontSize: 11, ...font.bold, paddingHorizontal: 14, paddingVertical: 5 },
  chartTitle: { fontSize: 13, ...font.bold, marginBottom: 12 },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 96,
    gap: 9,
  },
  barCol: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: 5 },
  barFill: { width: '100%', maxWidth: 22, borderRadius: 6 },
  barLabel: { fontSize: 9, ...font.medium },
  // Grocery
  addRow: { flexDirection: 'row', gap: 9, marginTop: sizes.sm },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    justifyContent: 'center',
  },
  addInputText: { fontSize: 14, ...font.regular },
  addSquare: { width: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  groceryList: { marginTop: sizes.md, gap: 8 },
  gRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  gName: { flex: 1, fontSize: 14.5, ...font.semibold },
  gDone: { textDecorationLine: 'line-through' },
  gQty: { fontSize: 13, ...font.bold, fontVariant: ['tabular-nums'] },
  // Calendar
  calHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  addPillText: { fontSize: 13, ...font.semibold, color: '#fff' },
  weekRow: { flexDirection: 'row', marginTop: sizes.md },
  weekday: { flex: 1, textAlign: 'center', fontSize: 10, ...font.bold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  calCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  calDay: { fontSize: 11, ...font.semibold },
  calDots: { flexDirection: 'row', gap: 2 },
  calDot: { width: 4, height: 4, borderRadius: 2 },
});
