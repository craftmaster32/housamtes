import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import type { TFunction } from 'i18next';
import { lightColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import type { MonthSpend } from '@stores/spendingStore';
import { NotebookPaper } from '@components/shared/NotebookPaper';
import { DotLeader } from '@components/shared/DotLeader';
import { ReceiptRoll } from '@components/bills/ReceiptRoll';
import { BagSlice } from '@components/grocery/BagSlice';
import { GraphChart } from '@components/spending/GraphChart';
import { ParkingSignIcon } from '@components/shared/tabbar/ParkingSignIcon';
import { asWord } from '@utils/asWord';
import { Highlight } from './TourHighlight';
import { TourParkingScreen, TourTasksScreen, TourPhotosScreen } from './TourScreensMore';

export type TourScreenId = 'bills' | 'spending' | 'parking' | 'grocery' | 'tasks' | 'photos';
export type BarHighlight = 'add' | 'parking' | 'more' | null;

// Background app content is shown at this opacity so the screen reads as the
// real app, while the spotlighted control (full opacity + ring) stands out.
const DIM = 0.5;

// ── The bottom menu, as it is in the app: icons only, a blue round +, the P sign ──
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
    <View style={[styles.barTab, styles.dim]}>
      <Ionicons name={name} size={24} color={C.textSecondary} />
    </View>
  );
  const addBtn = (
    <View style={[styles.addBtn, { backgroundColor: C.primary }]} accessibilityLabel={addLabel}>
      <Ionicons name="add" size={30} color="#FFFFFF" />
    </View>
  );
  const parking =
    highlight === 'parking' ? (
      <View style={styles.barTab}>
        <Highlight C={C} radius={11} circle>
          <View style={styles.tabHi}>
            <ParkingSignIcon size={24} color={C.primary} active />
          </View>
        </Highlight>
      </View>
    ) : (
      <View style={[styles.barTab, styles.dim]}>
        <ParkingSignIcon size={24} color={C.textSecondary} active={false} />
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
          <View style={styles.dim}>{addBtn}</View>
        )}
      </View>
      {parking}
      {highlight === 'more' ? (
        <View style={styles.barTab}>
          <Highlight C={C} radius={11} circle>
            <View style={styles.tabHi} accessibilityLabel={moreLabel}>
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

// Paper objects keep their light inks in both themes, like the real pages.
const P = lightColors;
const noop = (): void => {};

/** Fraunces page title with an optional grey line under it, like the real pages. */
function PageTitle({
  C,
  title,
  sub,
}: {
  C: ColorTokens;
  title: string;
  sub?: string;
}): React.JSX.Element {
  const heading = useHeadingFont('semibold');
  return (
    <View style={[styles.header, { opacity: DIM }]}>
      <Text style={[styles.title, heading, { color: C.textPrimary }]}>{title}</Text>
      {!!sub && <Text style={[styles.sub, { color: C.textSecondary }]}>{sub}</Text>}
    </View>
  );
}

// ── Bills — the notebook balance and receipt lines; the spotlight is the bar's + ──
function BillsScreen({ C, t, currency }: ScreenProps): React.JSX.Element {
  const heading = useHeadingFont('semibold');
  const hand = useHandFont();
  const rows: Array<{
    icon: keyof typeof Ionicons.glyphMap;
    tint: string;
    title: string;
    amount: string;
    who: string;
  }> = [
    {
      icon: 'flash-outline',
      tint: '#E0912F',
      title: t('tour.demo_electricity'),
      amount: '84.00',
      who: 'Sam',
    },
    {
      icon: 'wifi-outline',
      tint: P.primary,
      title: t('tour.demo_internet'),
      amount: '39.00',
      who: 'Dana',
    },
    {
      icon: 'water-outline',
      tint: '#3FA0C9',
      title: t('tour.demo_water'),
      amount: '22.00',
      who: 'Alex',
    },
  ];
  return (
    <View style={styles.body}>
      <PageTitle C={C} title={t('bills.title')} sub={t('bills.page_subtitle')} />
      <View style={[styles.gap, { opacity: DIM }]}>
        <NotebookPaper>
          <Text style={[styles.owedLbl, hand]}>{t('dashboard.balance_owed')}</Text>
          <Text style={[styles.owedVal, heading]}>{currency}126.00</Text>
        </NotebookPaper>
        <ReceiptRoll>
          {rows.map((r) => (
            <View key={r.title} style={styles.line}>
              <Ionicons name={r.icon} size={17} color={r.tint} />
              <View style={styles.lineText}>
                <Text style={styles.lineTitle}>{r.title}</Text>
                <Text style={[styles.lineWho, hand]}>{r.who}</Text>
              </View>
              <DotLeader color="rgba(107,98,80,0.35)" />
              <Text style={styles.lineAmt}>
                {currency}
                {r.amount}
              </Text>
            </View>
          ))}
        </ReceiptRoll>
      </View>
    </View>
  );
}

// ── Spending — the graph-paper trend is the spotlight ─────────────────────────
function SpendingScreen({ C, t, currency }: ScreenProps): React.JSX.Element {
  const now = new Date();
  const totals = [920, 1040, 870, 1310, 990, 1240];
  const months: MonthSpend[] = totals
    .map((house, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return {
        month: key,
        label: key,
        total: Math.round(house / 3),
        houseTotal: house,
        categories: [],
        houseCategories: [],
        billsByCategory: {},
      };
    })
    .reverse();
  return (
    <View style={styles.body}>
      <PageTitle C={C} title={t('spending.spending_analysis')} />
      <Highlight C={C} radius={8}>
        <GraphChart
          months={months}
          currency={currency}
          selectedIdx={0}
          view="house"
          onSelectMonth={noop}
        />
      </Highlight>
    </View>
  );
}

// ── Groceries — the add strip is the spotlight, the bag below ─────────────────
function GroceryScreen({ C, t }: ScreenProps): React.JSX.Element {
  const hand = useHandFont();
  const items: Array<{ name: string; qty: string; done: boolean }> = [
    { name: t('grocery.quick_add_milk'), qty: '2 L', done: false },
    { name: t('grocery.quick_add_bread'), qty: '', done: false },
    { name: t('grocery.quick_add_coffee'), qty: '', done: true },
  ];
  return (
    <View style={styles.body}>
      <PageTitle C={C} title={t('nav.grocery')} />
      <Highlight C={C} radius={14}>
        <View style={styles.strip}>
          <View style={styles.stripField}>
            <Text style={styles.stripText}>{t('grocery.item_placeholder')}</Text>
            <View style={styles.stripDashes}>
              {Array.from({ length: 30 }, (_, i) => (
                <View key={i} style={styles.stripDash} />
              ))}
            </View>
          </View>
          <View style={[styles.plus, { backgroundColor: P.primary }]}>
            <Ionicons name="add" size={24} color="#fff" />
          </View>
        </View>
      </Highlight>
      <View style={{ opacity: DIM }}>
        <BagSlice isTop isBottom>
          {items.map((it) => (
            <View key={it.name} style={styles.gRow}>
              <View style={styles.box}>
                {it.done && (
                  <Ionicons name="checkmark" size={20} color={P.primary} style={styles.tick} />
                )}
              </View>
              <Text style={[styles.gName, it.done && styles.gDone]}>{it.name}</Text>
              {!!it.qty && <Text style={[styles.gQty, hand]}>{it.qty}</Text>}
            </View>
          ))}
        </BagSlice>
      </View>
    </View>
  );
}

// ── Welcome backdrop — a faint Home with the notebook balance ─────────────────
export function WelcomeBg({ C, t, currency }: ScreenProps): React.JSX.Element {
  const heading = useHeadingFont('semibold');
  const hand = useHandFont();
  return (
    <View style={[styles.body, { opacity: DIM }]}>
      <Text style={[styles.title, heading, { color: C.textPrimary }]}>HouseMates</Text>
      <NotebookPaper>
        <Text style={[styles.owedLbl, hand]}>{t('dashboard.balance_owed')}</Text>
        <Text style={[styles.owedVal, heading]}>{currency}126.00</Text>
      </NotebookPaper>
      <View style={styles.miniRow}>
        <View style={[styles.miniTile, { backgroundColor: C.surface }]} />
        <View style={[styles.miniTile, { backgroundColor: C.surface }]} />
      </View>
    </View>
  );
}

// ── Explore — the More menu as the notebook page it is in the app ─────────────
export function MoreMenuScreen({ t }: ScreenProps): React.JSX.Element {
  const heading = useHeadingFont('semibold');
  const tiles: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string; color: string }> = [
    { icon: 'cart-outline', label: t('nav.grocery'), color: '#E8892B' },
    { icon: 'sync-outline', label: t('nav.machines'), color: '#3B6FBF' },
    { icon: 'calendar-outline', label: t('nav.calendar'), color: '#3B6FBF' },
    { icon: 'images-outline', label: t('nav.photos'), color: '#AF52DE' },
    { icon: 'list-outline', label: t('nav.tasks'), color: '#2FA37A' },
    { icon: 'clipboard-outline', label: t('nav.notes'), color: '#D9A414' },
    { icon: 'hand-left-outline', label: t('nav.votes'), color: '#EC5A8D' },
    { icon: 'construct-outline', label: t('nav.property'), color: '#12A594' },
  ];
  return (
    <View style={styles.body}>
      <NotebookPaper>
        <Text style={[styles.menuTitle, heading]}>{asWord(t('nav.house_section'))}</Text>
        <View style={styles.menuGrid}>
          {tiles.map((tile) => (
            <View key={tile.label} style={styles.menuItem}>
              <Ionicons name={tile.icon} size={20} color={tile.color} />
              <Text style={styles.menuLbl} numberOfLines={1}>
                {tile.label}
              </Text>
            </View>
          ))}
        </View>
      </NotebookPaper>
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
    case 'parking':
      return <TourParkingScreen C={C} t={t} />;
    case 'grocery':
      return <GroceryScreen C={C} t={t} currency={currency} />;
    case 'tasks':
      return <TourTasksScreen C={C} t={t} />;
    case 'photos':
      return <TourPhotosScreen C={C} t={t} />;
  }
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: sizes.lg, paddingTop: sizes.sm, gap: sizes.lg },
  gap: { gap: sizes.md },
  header: { gap: 2 },
  title: { fontSize: 32, lineHeight: 41, letterSpacing: -0.5 },
  sub: { fontSize: 13, ...font.regular },
  owedLbl: { fontSize: 19, color: P.paperMuted },
  owedVal: { fontSize: 32, lineHeight: 40, color: P.paperInk, letterSpacing: -0.5 },
  miniRow: { flexDirection: 'row', gap: 10 },
  miniTile: { flex: 1, height: 64, borderRadius: 18 },
  // Bills receipt lines
  line: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7 },
  lineText: { flexShrink: 1 },
  lineTitle: { fontSize: 14.5, ...font.semibold, color: P.paperInk },
  lineWho: { fontSize: 16, lineHeight: 18, color: P.paperMuted },
  lineAmt: { fontSize: 14.5, ...font.semibold, color: P.paperInk },
  // More menu
  menuTitle: { fontSize: 22, lineHeight: 29, color: P.paperInk, marginBottom: 6 },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  menuItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
  },
  menuLbl: { fontSize: 15, ...font.semibold, color: P.paperInk, flexShrink: 1 },
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
  dim: { opacity: DIM },
  tabHi: { padding: 8 },
  addBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  // Grocery
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: P.paper,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  stripField: { flex: 1, minWidth: 0 },
  stripText: { fontSize: 16, ...font.semibold, color: P.paperMuted, paddingVertical: 6 },
  stripDashes: { flexDirection: 'row', gap: 4, height: 2, overflow: 'hidden' },
  stripDash: { width: 6, height: 2, backgroundColor: 'rgba(107,98,80,0.35)' },
  plus: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  gRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  box: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 4,
    borderColor: '#2E2416',
    transform: [{ rotate: '-2deg' }],
  },
  tick: { position: 'absolute', left: -1, top: -6 },
  gName: { flex: 1, fontSize: 15, ...font.semibold, color: '#2E2416' },
  gDone: { textDecorationLine: 'line-through', opacity: 0.6 },
  gQty: { fontSize: 20, color: P.primary },
});
