import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import type { TFunction } from 'i18next';
import { type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

export type TourScreenId = 'bills' | 'spending' | 'grocery' | 'calendar';

const DIM = 0.32;

// ── Pulsing spotlight ring drawn around the highlighted control ──────────────
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
          duration: 1100,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return (): void => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          { borderColor: C.primary, borderRadius: radius + 6, opacity, transform: [{ scale }] },
        ]}
      />
      <View style={[styles.ringStatic, { borderColor: C.primary, borderRadius: radius + 6 }]}>
        {children}
      </View>
    </View>
  );
};

// ── Small building blocks ────────────────────────────────────────────────────
function Skeleton({ C, w, h }: { C: ColorTokens; w: number; h: number }): React.JSX.Element {
  return (
    <View
      style={{
        width: w,
        height: h,
        borderRadius: 7,
        backgroundColor: C.surfaceSecondary,
        opacity: DIM,
      }}
    />
  );
}

function BottomBar({ C, addLabel }: { C: ColorTokens; addLabel: string }): React.JSX.Element {
  const tab = (name: keyof typeof Ionicons.glyphMap): React.JSX.Element => (
    <View style={styles.barTab}>
      <Ionicons name={name} size={24} color={C.textSecondary} style={{ opacity: DIM }} />
    </View>
  );
  return (
    <View style={[styles.bar, { backgroundColor: C.background, borderTopColor: C.border }]}>
      {tab('home-outline')}
      {tab('card-outline')}
      <View style={styles.barCenter}>
        <Highlight C={C} radius={26}>
          <View
            style={[styles.addBtn, { backgroundColor: C.surface, borderColor: C.border }]}
            accessibilityLabel={addLabel}
          >
            <Ionicons name="add" size={28} color={C.primary} />
          </View>
        </Highlight>
      </View>
      {tab('car-outline')}
      {tab('ellipsis-horizontal')}
    </View>
  );
}

// ── The four screen illustrations ────────────────────────────────────────────
interface ScreenProps {
  C: ColorTokens;
  t: TFunction;
}

function BillsScreen({ C, t }: ScreenProps): React.JSX.Element {
  return (
    <View style={styles.flex}>
      <View style={styles.body}>
        <Text style={[styles.title, { color: C.textPrimary, opacity: DIM }]}>
          {t('bills.title')}
        </Text>
        <Text style={[styles.sub, { color: C.textSecondary, opacity: DIM }]}>
          {t('bills.page_subtitle')}
        </Text>
        <View style={styles.rows}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.card,
                { backgroundColor: C.surface, borderColor: C.border, opacity: DIM },
              ]}
            >
              <View style={[styles.chip, { backgroundColor: C.surfaceSecondary }]} />
              <View style={styles.cardMeta}>
                <Skeleton C={C} w={120} h={11} />
                <Skeleton C={C} w={72} h={9} />
              </View>
              <Skeleton C={C} w={44} h={13} />
            </View>
          ))}
        </View>
      </View>
      <BottomBar C={C} addLabel={t('bills.add_expense')} />
    </View>
  );
}

function SpendingScreen({ C, t }: ScreenProps): React.JSX.Element {
  const bars = [40, 56, 44, 72, 50, 92];
  const peak = Math.max(...bars);
  return (
    <View style={styles.body}>
      <Text style={[styles.title, { color: C.textPrimary, opacity: DIM }]}>
        {t('spending.spending_analysis')}
      </Text>
      <View style={styles.sumRow}>
        {[t('spending.house_total'), t('spending.your_share')].map((l) => (
          <View
            key={l}
            style={[
              styles.sumCard,
              { backgroundColor: C.surface, borderColor: C.border, opacity: DIM },
            ]}
          >
            <Text style={[styles.sumLabel, { color: C.textSecondary }]}>{l}</Text>
            <Skeleton C={C} w={64} h={16} />
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
              <View key={i} style={styles.barCol}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height: `${h}%`,
                      backgroundColor: h === peak ? C.primary : C.primary + '66',
                    },
                  ]}
                />
              </View>
            ))}
          </View>
        </View>
      </Highlight>
    </View>
  );
}

function GroceryScreen({ C, t }: ScreenProps): React.JSX.Element {
  return (
    <View style={styles.body}>
      <Text style={[styles.title, { color: C.textPrimary, opacity: DIM }]}>
        {t('grocery.shared_groceries')}
      </Text>
      <Text style={[styles.sub, { color: C.textSecondary, opacity: DIM }]}>
        {t('grocery.add_things_hint')}
      </Text>
      <View style={[styles.modeRow, { opacity: DIM }]}>
        <View
          style={[styles.modePill, { backgroundColor: C.primary + '22', borderColor: C.primary }]}
        />
        <View
          style={[
            styles.modePill,
            { backgroundColor: C.surfaceSecondary, borderColor: 'transparent' },
          ]}
        />
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
      <View style={[styles.chips, { opacity: DIM }]}>
        {[68, 84, 56, 74].map((w, i) => (
          <View
            key={i}
            style={[
              styles.chipPill,
              { backgroundColor: C.surface, borderColor: C.border, width: w },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function CalendarScreen({ C, t }: ScreenProps): React.JSX.Element {
  return (
    <View style={styles.body}>
      <View style={styles.calHead}>
        <View>
          <Text style={[styles.title, { color: C.textPrimary, opacity: DIM }]}>
            {t('calendar.title')}
          </Text>
          <Text style={[styles.sub, { color: C.textSecondary, opacity: DIM }]}>
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
      <View style={[styles.grid, { opacity: DIM }]}>
        {Array.from({ length: 28 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.calCell,
              { backgroundColor: i === 6 ? C.primary : C.surface, borderColor: C.border },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

export function TourScreen({
  id,
  C,
  t,
}: {
  id: TourScreenId;
  C: ColorTokens;
  t: TFunction;
}): React.JSX.Element {
  switch (id) {
    case 'bills':
      return <BillsScreen C={C} t={t} />;
    case 'spending':
      return <SpendingScreen C={C} t={t} />;
    case 'grocery':
      return <GroceryScreen C={C} t={t} />;
    case 'calendar':
      return <CalendarScreen C={C} t={t} />;
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  ring: { position: 'absolute', top: -6, left: -6, right: -6, bottom: -6, borderWidth: 2 },
  ringStatic: { borderWidth: 2 },
  body: { flex: 1, paddingHorizontal: sizes.lg, paddingTop: sizes.xl + sizes.lg, gap: sizes.sm },
  title: { fontSize: 26, ...font.extrabold, letterSpacing: -0.7 },
  sub: { fontSize: 13, ...font.regular },
  rows: { marginTop: sizes.sm, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  chip: { width: 38, height: 38, borderRadius: 11 },
  cardMeta: { flex: 1, gap: 6 },
  // Bottom tab bar
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    paddingBottom: 18,
    marginTop: 'auto',
  },
  barTab: { flex: 1, alignItems: 'center' },
  barCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  sumCard: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 12, gap: 6 },
  sumLabel: { fontSize: 11, ...font.semibold },
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
    height: 88,
    gap: 9,
  },
  barCol: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  barFill: { width: '100%', maxWidth: 22, borderRadius: 6 },
  // Grocery
  modeRow: { flexDirection: 'row', gap: 8, marginTop: sizes.sm },
  modePill: { flex: 1, height: 38, borderRadius: 12, borderWidth: 1 },
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: sizes.md },
  chipPill: { height: 32, borderRadius: 999, borderWidth: 1 },
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: sizes.md },
  calCell: { width: '12%', aspectRatio: 1, borderRadius: 9, borderWidth: 1 },
});
