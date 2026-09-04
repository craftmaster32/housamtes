import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import type { TFunction } from 'i18next';
import { type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

export type TourScreenId = 'bills' | 'spending' | 'grocery' | 'calendar';
export type BarHighlight = 'add' | 'more' | null;

// Background app content is shown at this opacity so the screen reads as the
// real app, while the spotlighted control (full opacity + ring) stands out.
const DIM = 0.5;

// ── Pulsing spotlight ring drawn around the highlighted control ──────────────
// Opacity-only pulse (no scale) so it hugs targets of any width correctly, and
// a small, tight outset so it never sits on neighbouring content.
interface HighlightProps {
  C: ColorTokens;
  radius: number;
  children: React.ReactNode;
  circle?: boolean;
}

export const Highlight: React.FC<HighlightProps> = ({ C, radius, children, circle }) => {
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

  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.55] });
  const rGlow = circle ? 999 : radius + 4;
  const rStatic = circle ? 999 : radius + 2;

  return (
    <View style={[styles.highlightWrap, circle && styles.highlightCircle]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.ring, { borderColor: C.primary, borderRadius: rGlow, opacity: glow }]}
      />
      <View style={[styles.ringStatic, { borderColor: C.primary, borderRadius: rStatic }]}>
        {children}
      </View>
    </View>
  );
};

// ── The persistent bottom nav bar ────────────────────────────────────────────
export function TourBottomBar({
  C,
  highlight,
  addLabel,
  moreLabel,
}: {
  C: ColorTokens;
  highlight: BarHighlight;
  addLabel: string;
  moreLabel: string;
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
        {highlight === 'add' ? (
          <Highlight C={C} radius={27} circle>
            {addBtn}
          </Highlight>
        ) : (
          <View style={styles.barAddDim}>{addBtn}</View>
        )}
      </View>
      {tab('car-outline')}
      {highlight === 'more' ? (
        <View style={styles.barTab}>
          <Highlight C={C} radius={11}>
            <View style={styles.moreHi} accessibilityLabel={moreLabel}>
              <Ionicons name="ellipsis-horizontal" size={24} color={C.primary} />
            </View>
          </Highlight>
        </View>
      ) : (
        tab('ellipsis-horizontal')
      )}
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
    <View style={styles.body}>
      <View style={[styles.header, { opacity: DIM }]}>
        <Text style={[styles.title, { color: C.textPrimary }]}>{t('bills.title')}</Text>
        <Text style={[styles.sub, { color: C.textSecondary }]}>{t('bills.page_subtitle')}</Text>
      </View>
      <View style={[styles.rows, { opacity: DIM }]}>
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
      <View style={[styles.header, { opacity: DIM }]}>
        <Text style={[styles.title, { color: C.textPrimary }]}>
          {t('grocery.shared_groceries')}
        </Text>
        <Text style={[styles.sub, { color: C.textSecondary }]}>{t('grocery.add_things_hint')}</Text>
      </View>
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
  const todayDay = 12;
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
          const isToday = day === todayDay;
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

// ── Welcome backdrop — a faint but populated dashboard ───────────────────────
export function WelcomeBg({ C, t, currency }: ScreenProps): React.JSX.Element {
  return (
    <View style={[styles.body, { opacity: DIM }]}>
      <Text style={[styles.title, { color: C.textPrimary }]}>HouseMates</Text>
      <View style={[styles.owedCard, { backgroundColor: C.surface, borderColor: C.border }]}>
        <Text style={[styles.owedLbl, { color: C.textSecondary }]}>
          {t('dashboard.balance_owed')}
        </Text>
        <Text style={[styles.owedVal, { color: C.textPrimary }]}>{currency}126</Text>
      </View>
      <View style={styles.miniRow}>
        <View style={[styles.miniTile, { backgroundColor: C.surface, borderColor: C.border }]} />
        <View style={[styles.miniTile, { backgroundColor: C.surface, borderColor: C.border }]} />
      </View>
    </View>
  );
}

// ── Explore — the More menu opened, so people can see what's inside ──────────
export function MoreMenuScreen({ C, t }: ScreenProps): React.JSX.Element {
  const tiles: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string; color: string }> = [
    { icon: 'cart-outline', label: t('nav.grocery'), color: '#E8892B' },
    { icon: 'calendar-outline', label: t('nav.calendar'), color: '#3B6FBF' },
    { icon: 'images-outline', label: t('nav.photos'), color: '#AF52DE' },
    { icon: 'list-outline', label: t('nav.tasks'), color: '#2FA37A' },
    { icon: 'clipboard-outline', label: t('nav.notes'), color: '#D9A414' },
    { icon: 'hand-left-outline', label: t('nav.votes'), color: '#EC5A8D' },
    { icon: 'construct-outline', label: t('nav.property'), color: '#12A594' },
  ];
  return (
    <View style={styles.body}>
      <View style={[styles.menuCard, { backgroundColor: C.surface, borderColor: C.border }]}>
        <Text style={[styles.menuTitle, { color: C.textSecondary }]}>{t('nav.more')}</Text>
        <View style={styles.menuGrid}>
          {tiles.map((tile) => (
            <View
              key={tile.label}
              style={[styles.menuTile, { backgroundColor: C.surfaceSecondary }]}
            >
              <View style={[styles.menuIcon, { backgroundColor: tile.color + '22' }]}>
                <Ionicons name={tile.icon} size={20} color={tile.color} />
              </View>
              <Text style={[styles.menuLbl, { color: C.textPrimary }]} numberOfLines={1}>
                {tile.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ── Profile — the header avatar tapped, with its dropdown menu open ───────────
// Teaches that tapping the profile icon (top of every screen) opens a small
// menu where Settings lives. The avatar is the spotlight; the dropdown below
// is shown at full opacity so people can read the Settings row.
export function ProfileMenuScreen({ C, t }: ScreenProps): React.JSX.Element {
  const rows: Array<{
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    danger?: boolean;
    emphasise?: boolean;
  }> = [
    { icon: 'person-outline', label: t('nav.profile') },
    { icon: 'settings-outline', label: t('nav.settings'), emphasise: true },
    { icon: 'log-out-outline', label: t('profile.sign_out'), danger: true },
  ];
  return (
    <View style={styles.body}>
      {/* Mock dashboard header — the avatar on the leading edge is the target */}
      <View style={styles.profHeader}>
        <Highlight C={C} radius={21} circle>
          <View style={[styles.profAvatar, { backgroundColor: C.primary }]}>
            <Text style={styles.profAvatarText}>S</Text>
          </View>
        </Highlight>
        <View style={[styles.profHeaderText, { opacity: DIM }]}>
          <View style={[styles.profLine, { backgroundColor: C.border, width: '55%' }]} />
          <View
            style={[styles.profLine, { backgroundColor: C.border, width: '80%', height: 12 }]}
          />
        </View>
        <View
          style={[
            styles.profBell,
            { backgroundColor: C.surface, borderColor: C.border, opacity: DIM },
          ]}
        >
          <Ionicons name="notifications-outline" size={20} color={C.textSecondary} />
        </View>
      </View>

      {/* The profile popup, dropped just under the avatar */}
      <View style={[styles.profPanel, { backgroundColor: C.surface, borderColor: C.border }]}>
        <View style={[styles.profPanelHead, { borderBottomColor: C.border }]}>
          <View style={[styles.profPanelAvatar, { backgroundColor: C.primary }]}>
            <Text style={styles.profPanelAvatarText}>S</Text>
          </View>
          <View style={styles.profPanelMeta}>
            <Text style={[styles.profPanelName, { color: C.textPrimary }]}>{t('common.you')}</Text>
            <Text style={[styles.profPanelEmail, { color: C.textSecondary }]}>you@house.app</Text>
          </View>
        </View>
        {rows.map((r) => (
          <View
            key={r.label}
            style={[styles.profRow, r.emphasise && { backgroundColor: C.primary + '18' }]}
          >
            <Ionicons
              name={r.icon}
              size={18}
              color={r.danger ? C.negative : r.emphasise ? C.primary : C.textSecondary}
              style={styles.profRowIcon}
            />
            <Text
              style={[
                styles.profRowLabel,
                { color: r.danger ? C.negative : r.emphasise ? C.primary : C.textPrimary },
                r.emphasise && font.bold,
              ]}
            >
              {r.label}
            </Text>
          </View>
        ))}
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
  highlightCircle: { alignSelf: 'center' },
  ring: { position: 'absolute', top: -5, left: -5, right: -5, bottom: -5, borderWidth: 2 },
  ringStatic: { borderWidth: 2 },
  body: { flex: 1, paddingHorizontal: sizes.lg, paddingTop: sizes.sm, gap: sizes.lg },
  header: { gap: 3 },
  title: { fontSize: 26, ...font.extrabold, letterSpacing: -0.7 },
  sub: { fontSize: 13, ...font.regular },
  owedCard: { borderWidth: 1, borderRadius: 20, padding: 18 },
  owedLbl: { fontSize: 12, ...font.semibold },
  owedVal: { fontSize: 30, ...font.extrabold, marginTop: 4, fontVariant: ['tabular-nums'] },
  miniRow: { flexDirection: 'row', gap: 10 },
  miniTile: { flex: 1, height: 64, borderRadius: 16, borderWidth: 1 },
  // More menu (explore)
  menuCard: { borderWidth: 1, borderRadius: 22, padding: 16 },
  menuTitle: {
    fontSize: 12,
    ...font.extrabold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  menuTile: { width: '31%', alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 14 },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLbl: { fontSize: 11, ...font.semibold },
  // Profile menu (avatar → dropdown)
  profHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 4 },
  profAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profAvatarText: { fontSize: 17, ...font.bold, color: '#fff' },
  profHeaderText: { flex: 1, gap: 6 },
  profLine: { height: 9, borderRadius: 5 },
  profBell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profPanel: {
    alignSelf: 'flex-start',
    width: 232,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 6,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 12,
  },
  profPanelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  profPanelAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profPanelAvatarText: { fontSize: 15, ...font.bold, color: '#fff' },
  profPanelMeta: { flex: 1 },
  profPanelName: { fontSize: 14, ...font.semibold },
  profPanelEmail: { fontSize: 12, ...font.regular, marginTop: 1 },
  profRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 6,
    paddingHorizontal: 8,
    paddingVertical: 11,
    borderRadius: 12,
  },
  profRowIcon: { width: 20, textAlign: 'center' },
  profRowLabel: { flex: 1, fontSize: 14, ...font.medium },
  // Bills rows
  rows: { gap: 10 },
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
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    paddingBottom: 18,
  },
  barTab: { flex: 1, alignItems: 'center' },
  barCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  barAddDim: { opacity: DIM },
  moreHi: { padding: 5, borderRadius: 8 },
  addBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  // Spending
  sumRow: { flexDirection: 'row', gap: 10 },
  sumCard: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 12, gap: 4 },
  sumLabel: { fontSize: 11, ...font.semibold },
  sumValue: { fontSize: 20, ...font.extrabold, fontVariant: ['tabular-nums'] },
  chartCard: { borderWidth: 1, borderRadius: 20, padding: 16 },
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
    height: 74,
    gap: 9,
  },
  barCol: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: 5 },
  barFill: { width: '100%', maxWidth: 22, borderRadius: 6 },
  barLabel: { fontSize: 9, ...font.medium },
  // Grocery
  addRow: { flexDirection: 'row', gap: 9 },
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
  groceryList: { gap: 8 },
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
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 10, ...font.bold },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
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
