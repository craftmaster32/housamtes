import { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@stores/authStore';
import { Alert } from '@lib/alert';
import {
  useBillsStore,
  calculateAllNetBalances,
  calculateSimplifiedBalancesForUser,
} from '@stores/billsStore';
import { useRecurringBillsStore, calculateFairness } from '@stores/recurringBillsStore';
import { useParkingStore } from '@stores/parkingStore';
import { useGroceryStore } from '@stores/groceryStore';
import { useChoresStore } from '@stores/choresStore';
import { useEventsStore } from '@stores/eventsStore';
import { useAnnouncementsStore } from '@stores/announcementsStore';
import { useHousematesStore } from '@stores/housematesStore';
import { resolveName } from '@utils/housemates';
import { useMemberName } from '@hooks/useMemberName';
import { useSettingsStore } from '@stores/settingsStore';
import { useProfilePopupStore } from '@stores/profilePopupStore';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';
import { useThemedColors } from '@constants/colors';
import { formatFull } from '@constants/currencies';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { DadJokeCard } from '@components/shared/DadJokeCard';
import { DashboardErrorBanner } from '@components/dashboard/DashboardErrorBanner';

// The parking tile stays a deep slate in both themes — a deliberate anchor on
// the home grid, matching the design.
const PARK_TILE_BG = '#23323E';

// ── Helpers ───────────────────────────────────────────────────────────────────
function greetingText(name: string, t: (key: string) => string): string {
  const h = new Date().getHours();
  const timeKey = h < 12 ? 'greeting_morning' : h < 18 ? 'greeting_afternoon' : 'greeting_evening';
  return `${t(`dashboard.${timeKey}`)}, ${name}`;
}

function localeFor(lang: string): string {
  return lang === 'he' ? 'he-IL' : lang === 'es' ? 'es-ES' : 'en-GB';
}

function timeAgo(
  iso: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
  lang: string
): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('common.just_now');
  if (mins < 60) return t('common.minutes_ago', { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('common.hours_ago', { n: hours });
  return new Date(iso).toLocaleDateString(localeFor(lang), { month: 'short', day: 'numeric' });
}

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Split a formatted amount ("₪746.46") into its leading symbol and the number,
// so the currency mark can sit smaller beside the big figure.
function splitAmount(formatted: string): { symbol: string; value: string } {
  const m = formatted.match(/^([^\d-]*)(.*)$/);
  return { symbol: m?.[1] ?? '', value: m?.[2] ?? formatted };
}

// ── Header ──────────────────────────────────────────────────────────────────
function Header(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const profile = useAuthStore((s) => s.profile);
  const houseName = useHousematesStore((s) => s.houseName);
  const events = useEventsStore((s) => s.events);
  const openProfile = useProfilePopupStore((s) => s.open);

  const myName = profile?.name ?? 'there';
  const initials = myName.charAt(0).toUpperCase();
  const today = todayYMD();
  const todaysEvents = events.filter((e) => e.date === today).length;

  return (
    <View style={styles.header}>
      <Pressable
        style={({ pressed }) => [
          styles.avatar,
          {
            backgroundColor: profile?.avatarUrl
              ? 'transparent'
              : (profile?.avatarColor ?? c.primary),
          },
          pressed && styles.pressed,
        ]}
        onPress={openProfile}
        accessibilityRole="button"
        accessibilityLabel={t('dashboard.open_profile')}
      >
        {profile?.avatarUrl ? (
          <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImg} contentFit="cover" />
        ) : (
          <Text style={styles.avatarText}>{initials}</Text>
        )}
      </Pressable>

      <View style={styles.headerText}>
        {houseName ? (
          <Text style={[styles.headerHouse, { color: c.textSecondary }]} numberOfLines={1}>
            {houseName}
          </Text>
        ) : null}
        <Text style={[styles.headerGreeting, { color: c.textPrimary }]} numberOfLines={1}>
          {greetingText(myName, t)}
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.bell,
          { backgroundColor: c.surface, borderColor: c.border },
          pressed && styles.pressed,
        ]}
        onPress={() => router.push('/(tabs)/calendar')}
        accessibilityRole="button"
        accessibilityLabel={t('nav.calendar')}
      >
        <Ionicons name="notifications-outline" size={20} color={c.textPrimary} />
        {todaysEvents > 0 && (
          <View
            style={[styles.bellBadge, { backgroundColor: c.danger, borderColor: c.background }]}
          >
            <Text style={styles.bellBadgeText}>{todaysEvents > 9 ? '9+' : todaysEvents}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

// ── Today row (next upcoming event) ───────────────────────────────────────────
function TodayRow(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const language = useLanguageStore((s) => s.language);
  const rtl = isRTL(language);
  const events = useEventsStore((s) => s.events);
  const today = todayYMD();

  const next = useMemo(
    () =>
      [...events]
        .filter((e) => e.date >= today)
        .sort(
          (a, b) =>
            a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? '')
        )[0],
    [events, today]
  );

  if (!next) return <></>;

  const d = new Date(`${next.date}T12:00:00`);
  const month = d.toLocaleDateString(localeFor(language), { month: 'short' });
  const day = d.getDate();
  const isToday = next.date === today;
  const dateLabel = isToday
    ? t('common.today').toUpperCase()
    : d.toLocaleDateString(localeFor(language), { weekday: 'short' }).toUpperCase();
  const title = next.startTime ? `${next.title} · ${next.startTime}` : next.title;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.todayRow,
        { backgroundColor: c.surface, borderColor: c.border, borderLeftColor: c.primary },
        pressed && styles.pressed,
      ]}
      onPress={() => router.push('/(tabs)/calendar')}
      accessibilityRole="button"
      accessibilityLabel={`${dateLabel} ${title}`}
    >
      <View style={[styles.todayDate, { backgroundColor: c.primaryTint }]}>
        <Text style={[styles.todayDateM, { color: c.primary }]}>{month}</Text>
        <Text style={[styles.todayDateN, { color: c.primary }]}>{day}</Text>
      </View>
      <View style={styles.flex1}>
        <Text style={[styles.todayEyebrow, { color: c.primary }]}>{dateLabel}</Text>
        <Text style={[styles.todayTitle, { color: c.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={17} color={c.textTertiary} />
    </Pressable>
  );
}

// ── Pinned note (latest house announcement) ───────────────────────────────────
function PinnedNote(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const language = useLanguageStore((s) => s.language);
  const notes = useAnnouncementsStore((s) => s.items);
  const memberName = useMemberName();
  const latest = notes[0];

  if (!latest) return <></>;

  const author = memberName(latest.author).split(' ')[0];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.pinned,
        { backgroundColor: c.secondary },
        pressed && styles.pressed,
      ]}
      onPress={() => router.push('/(tabs)/notes')}
      accessibilityRole="button"
      accessibilityLabel={t('dashboard.pinned_by', { name: author })}
    >
      <View style={styles.pinnedIcon}>
        <Ionicons name="megaphone-outline" size={16} color={c.secondaryForeground} />
      </View>
      <View style={styles.flex1}>
        <View style={styles.pinnedTop}>
          <Text style={[styles.pinnedLabel, { color: c.secondaryForeground }]} numberOfLines={1}>
            {t('dashboard.pinned_by', { name: author })}
          </Text>
          <Text style={[styles.pinnedAgo, { color: c.textSecondary }]}>
            {timeAgo(latest.createdAt, t, language)}
          </Text>
        </View>
        <Text style={[styles.pinnedText, { color: c.textPrimary }]} numberOfLines={3}>
          {latest.text}
        </Text>
      </View>
    </Pressable>
  );
}

// ── "You're owed" hero ────────────────────────────────────────────────────────
function OwedHero(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const bills = useBillsStore((s) => s.bills);
  const profile = useAuthStore((s) => s.profile);
  const householdBills = useRecurringBillsStore((s) => s.bills);
  const payments = useRecurringBillsStore((s) => s.payments);
  const householdMembers = useHousematesStore((s) => s.housemates);
  const myId = profile?.id ?? '';

  const activeBills = bills.filter((b) => !b.settled);
  const combinedNet = new Map<string, number>(calculateAllNetBalances(activeBills));
  for (const { person, balance } of calculateFairness(
    householdBills,
    payments,
    householdMembers.map((h) => h.id)
  )) {
    combinedNet.set(person, (combinedNet.get(person) ?? 0) + balance);
  }
  const balances = calculateSimplifiedBalancesForUser(combinedNet, myId);
  const totalOwed = balances.filter((b) => b.amount > 0).reduce((s, b) => s + b.amount, 0);
  const totalOwe = balances.filter((b) => b.amount < 0).reduce((s, b) => s + Math.abs(b.amount), 0);
  const netAmount = totalOwed - totalOwe;
  const isOwed = netAmount >= 0;
  const peopleCount = balances.length;
  const settled = balances.length === 0;
  const { symbol, value } = splitAmount(formatFull(Math.abs(netAmount), currencyCode));

  return (
    <Pressable
      style={({ pressed }) => [styles.heroWrap, pressed && styles.pressed]}
      onPress={() => router.push('/(tabs)/bills')}
      accessibilityRole="button"
      accessibilityLabel={
        settled
          ? t('dashboard.balance_all_settled')
          : t(isOwed ? 'dashboard.balance_owed_amount' : 'dashboard.balance_you_owe_amount', {
              amount: formatFull(Math.abs(netAmount), currencyCode),
            })
      }
    >
      <LinearGradient
        colors={c.owedGradient}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={[styles.hero, { shadowColor: c.owedShadow }]}
      >
        <View style={styles.heroDeco} />
        <View style={styles.heroDecoSm} />

        {settled ? (
          <View style={styles.heroSettledRow}>
            <View>
              <Text style={styles.heroLabel}>{t('dashboard.balance_all_settled')}</Text>
              <Text style={styles.heroSub}>{t('dashboard.no_debts')}</Text>
            </View>
            <View style={styles.heroCheck}>
              <Ionicons name="checkmark" size={22} color="#fff" />
            </View>
          </View>
        ) : (
          <View style={styles.heroRow}>
            <View style={styles.flex1}>
              <Text style={styles.heroLabel}>
                {isOwed ? t('dashboard.balance_owed') : t('dashboard.balance_you_owe')}
              </Text>
              <View style={styles.heroAmtRow}>
                <Text style={styles.heroAmtSym}>{symbol}</Text>
                <Text style={styles.heroAmt} numberOfLines={1} adjustsFontSizeToFit>
                  {value}
                </Text>
              </View>
              <Text style={styles.heroSub}>
                {peopleCount !== 1
                  ? t('dashboard.balance_across_plural', { count: peopleCount })
                  : t('dashboard.balance_across', { count: peopleCount })}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.heroAnalysisBtn, pressed && styles.pressed]}
              onPress={() => router.push('/(tabs)/profile/spending')}
              accessibilityRole="button"
              accessibilityLabel={t('spending.view_spending')}
            >
              <Ionicons name="stats-chart-outline" size={20} color="#fff" />
            </Pressable>
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

// ── Parking tile (dark) ───────────────────────────────────────────────────────
function ParkingTile(): React.JSX.Element {
  const { t } = useTranslation();
  const current = useParkingStore((s) => s.current);
  const claim = useParkingStore((s) => s.claim);
  const release = useParkingStore((s) => s.release);
  const housemates = useHousematesStore((s) => s.housemates);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const myId = profile?.id ?? '';
  const myName = profile?.name ?? '';
  const isFree = !current;
  const isMine = current?.occupant === myId;
  const [busy, setBusy] = useState(false);

  const handlePress = useCallback(async (): Promise<void> => {
    if (busy || !myId || !houseId) {
      router.push('/(tabs)/parking');
      return;
    }
    if (!isFree && !isMine) {
      router.push('/(tabs)/parking');
      return;
    }
    setBusy(true);
    try {
      if (isFree) {
        await claim(myId, myName, houseId ?? '');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        await release(houseId ?? '', myName);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
    } catch {
      Alert.alert(t('dashboard.parking_error'), t('common.failed_try_again'));
    } finally {
      setBusy(false);
    }
  }, [busy, isFree, isMine, claim, release, myId, myName, houseId, t]);

  const accent = isFree ? '#8FE0AC' : '#FF8478';
  const chipBg = isFree ? 'rgba(79,176,113,0.22)' : 'rgba(255,97,85,0.22)';
  const pillBg = isFree ? 'rgba(79,176,113,0.16)' : 'rgba(255,97,85,0.16)';
  const occupantName = resolveName(current?.occupant ?? '', housemates, '');
  const sub = isFree
    ? t('dashboard.parking_first_come')
    : isMine
      ? t('dashboard.parking_free_it_up')
      : occupantName
        ? occupantName.split(' ')[0]
        : t('common.unknown');

  return (
    <Pressable
      style={({ pressed }) => [styles.parkTile, pressed && styles.pressed]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={isFree ? t('dashboard.claim_parking_spot') : t('dashboard.view_parking')}
    >
      <View style={styles.parkTop}>
        <View style={[styles.parkChip, { backgroundColor: chipBg }]}>
          {busy ? (
            <ActivityIndicator size="small" color={accent} />
          ) : (
            <Ionicons name={isFree ? 'car-outline' : 'car'} size={17} color={accent} />
          )}
        </View>
        <View style={[styles.parkPill, { backgroundColor: pillBg }]}>
          <Text style={[styles.parkPillText, { color: accent }]}>
            {isFree ? t('dashboard.parking_free').toUpperCase() : t('parking.taken').toUpperCase()}
          </Text>
        </View>
      </View>
      <View>
        <Text style={styles.parkLabel}>{t('dashboard.parking_label')}</Text>
        <Text style={styles.parkStatus}>
          {isFree ? t('dashboard.parking_free') : t('dashboard.parking_in_use')}
        </Text>
        <Text style={styles.parkSub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
    </Pressable>
  );
}

// ── Chores ring tile ──────────────────────────────────────────────────────────
function ChoresRing(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const chores = useChoresStore((s) => s.chores);
  const total = chores.length;
  const done = chores.filter((ch) => ch.isComplete).length;
  const next = chores.find((ch) => !ch.isComplete);

  const R = 18;
  const CIRC = 2 * Math.PI * R;
  const pct = total > 0 ? done / total : 0;
  const offset = CIRC * (1 - pct);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.choreTile,
        { backgroundColor: c.surface, borderColor: c.border },
        pressed && styles.pressed,
      ]}
      onPress={() => router.push('/(tabs)/chores')}
      accessibilityRole="button"
      accessibilityLabel={t('dashboard.x_of_y_done', { done, total })}
    >
      <View style={styles.choreTop}>
        <Text style={[styles.choreLabel, { color: c.textSecondary }]}>
          {t('dashboard.chores_label')}
        </Text>
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
            strokeDashoffset={offset}
            transform="rotate(-90 23 23)"
          />
        </Svg>
      </View>
      <View>
        <Text style={[styles.choreNum, { color: c.textPrimary }]}>
          {done}
          <Text style={[styles.choreDenom, { color: c.textTertiary }]}>/{total}</Text>
        </Text>
        <Text style={[styles.choreSub, { color: c.textSecondary }]} numberOfLines={1}>
          {next ? t('dashboard.chore_next', { name: next.name }) : t('dashboard.chores_smashed')}
        </Text>
      </View>
    </Pressable>
  );
}

// ── Grocery list ──────────────────────────────────────────────────────────────
function GroceryList(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const items = useGroceryStore((s) => s.items);
  const toggleItem = useGroceryStore((s) => s.toggleItem);
  const memberName = useMemberName();

  const shared = items.filter((i) => !i.isPersonal && !i.isDraft);
  const toBuy = shared.filter((i) => !i.isChecked).length;
  const preview = shared.slice(0, 3);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: c.surface, borderColor: c.border },
        pressed && styles.pressed,
      ]}
      onPress={() => router.push('/(tabs)/grocery')}
      accessibilityRole="button"
      accessibilityLabel={t('dashboard.shared_groceries')}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.cardIcon, { backgroundColor: c.warningTint }]}>
          <Ionicons name="cart-outline" size={16} color={c.warning} />
        </View>
        <Text style={[styles.cardTitle, { color: c.textPrimary }]}>
          {t('dashboard.grocery_list')}
        </Text>
        <Text style={[styles.cardMetaRight, { color: c.textSecondary }]}>
          {t('dashboard.n_to_buy', { count: toBuy })}
        </Text>
      </View>
      {preview.length === 0 ? (
        <Text style={[styles.emptyText, { color: c.textSecondary }]}>
          {t('dashboard.grocery_empty')}
        </Text>
      ) : (
        <View style={styles.groceryItems}>
          {preview.map((item) => (
            <Pressable
              key={item.id}
              style={styles.groceryRow}
              onPress={() => toggleItem(item.id)}
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
                {item.isChecked && <Ionicons name="checkmark" size={12} color="#fff" />}
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
              <Text style={[styles.groceryWho, { color: c.textSecondary }]}>
                {memberName(item.addedBy).split(' ')[0]}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </Pressable>
  );
}

// ── Games button ──────────────────────────────────────────────────────────────
function GamesButton(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const language = useLanguageStore((s) => s.language);
  const rtl = isRTL(language);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.games,
        { backgroundColor: c.surface, borderColor: c.border },
        pressed && styles.pressed,
      ]}
      onPress={() => router.push('/(tabs)/games')}
      accessibilityRole="button"
      accessibilityLabel={t('dashboard.games_fun')}
    >
      <View style={styles.gamesEmoji}>
        <Text style={styles.gamesEmojiText}>🎮</Text>
      </View>
      <View style={styles.flex1}>
        <Text style={[styles.gamesTitle, { color: c.textPrimary }]}>
          {t('dashboard.games_fun')}
        </Text>
        <Text style={[styles.gamesSub, { color: c.textSecondary }]}>
          {t('dashboard.games_sub')}
        </Text>
      </View>
      <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={18} color={c.textTertiary} />
    </Pressable>
  );
}

// ── Dashboard screen ────────────────────────────────────────────────────────────
export default function DashboardScreen(): React.JSX.Element {
  const c = useThemedColors();
  const isEnabled = useSettingsStore((s) => s.isEnabled);
  const { width } = useWindowDimensions();
  const isWide = width >= 680;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, isWide && styles.scrollWide]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeIn.duration(400)}>
          <Header />
        </Animated.View>

        <DashboardErrorBanner />

        <Animated.View entering={FadeInDown.delay(60).duration(400)}>
          <TodayRow />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <PinnedNote />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(140).duration(450)} style={styles.block}>
          <OwedHero />
        </Animated.View>

        {(isEnabled('parking') || isEnabled('chores')) && (
          <Animated.View entering={FadeInDown.delay(200).duration(450)} style={styles.gridRow}>
            {isEnabled('parking') && (
              <View style={styles.gridCol}>
                <ParkingTile />
              </View>
            )}
            {isEnabled('chores') && (
              <View style={styles.gridCol}>
                <ChoresRing />
              </View>
            )}
          </Animated.View>
        )}

        {isEnabled('grocery') && (
          <Animated.View entering={FadeInDown.delay(260).duration(450)} style={styles.block}>
            <GroceryList />
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(320).duration(450)} style={styles.block}>
          <DadJokeCard />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(380).duration(450)} style={styles.block}>
          <GamesButton />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: sizes.bottomTabContentPadding },
  scrollWide: { paddingHorizontal: 24, maxWidth: 640, width: '100%', alignSelf: 'center' },
  flex1: { flex: 1, minWidth: 0 },
  block: { marginTop: 14 },
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },

  // ── Header
  header: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 8 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { fontSize: 17, ...font.bold, color: '#fff' },
  headerText: { flex: 1, minWidth: 0 },
  headerHouse: { fontSize: 12, ...font.medium },
  headerGreeting: { fontSize: 19, ...font.extrabold, letterSpacing: -0.5 },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: { fontSize: 10, ...font.bold, color: '#fff' },

  // ── Today row
  todayRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: 14,
    padding: 11,
  },
  todayDate: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayDateM: { fontSize: 9, ...font.bold, textTransform: 'uppercase', lineHeight: 11 },
  todayDateN: { fontSize: 15, ...font.extrabold, lineHeight: 17 },
  todayEyebrow: { fontSize: 10, ...font.bold, letterSpacing: 0.5, textTransform: 'uppercase' },
  todayTitle: { fontSize: 14, ...font.semibold, marginTop: 1 },

  // ── Pinned note
  pinned: { marginTop: 14, flexDirection: 'row', gap: 11, borderRadius: 18, padding: 14 },
  pinnedIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinnedTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  pinnedLabel: {
    flex: 1,
    fontSize: 10.5,
    ...font.bold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  pinnedAgo: { fontSize: 11, ...font.regular },
  pinnedText: { fontSize: 13.5, ...font.medium, lineHeight: 20 },

  // ── Owed hero
  heroWrap: { borderRadius: 18 },
  hero: {
    borderRadius: 18,
    padding: 20,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 10,
  },
  heroDeco: {
    position: 'absolute',
    bottom: -40,
    right: -20,
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
  },
  heroDecoSm: {
    position: 'absolute',
    bottom: -8,
    right: 20,
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  heroRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroAnalysisBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSettledRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroCheck: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: { fontSize: 12, ...font.medium, color: 'rgba(255,255,255,0.8)' },
  heroAmtRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  heroAmtSym: { fontSize: 22, ...font.medium, color: 'rgba(255,255,255,0.7)', marginRight: 2 },
  heroAmt: { fontSize: 44, ...font.extrabold, color: '#fff', letterSpacing: -1.6, lineHeight: 48 },
  heroSub: { fontSize: 11, color: 'rgba(255,255,255,0.72)', marginTop: 4 },

  // ── Grid row (parking + chores)
  gridRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  gridCol: { flex: 1 },

  // ── Parking tile
  parkTile: {
    flex: 1,
    minHeight: 118,
    borderRadius: 18,
    padding: 15,
    backgroundColor: PARK_TILE_BG,
    justifyContent: 'space-between',
  },
  parkTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  parkChip: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parkPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  parkPillText: { fontSize: 10.5, ...font.bold },
  parkLabel: {
    fontSize: 11,
    ...font.semibold,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  parkStatus: { fontSize: 17, ...font.bold, color: '#fff', letterSpacing: -0.3, marginTop: 2 },
  parkSub: { fontSize: 11.5, color: 'rgba(255,255,255,0.62)', marginTop: 1 },

  // ── Chores tile
  choreTile: {
    flex: 1,
    minHeight: 118,
    borderRadius: 18,
    borderWidth: 1,
    padding: 15,
    justifyContent: 'space-between',
  },
  choreTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  choreLabel: {
    fontSize: 11,
    ...font.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  choreNum: { fontSize: 22, ...font.extrabold, letterSpacing: -0.5 },
  choreDenom: { fontSize: 15, ...font.bold },
  choreSub: { fontSize: 11.5, ...font.regular, marginTop: 1 },

  // ── Generic card (grocery)
  card: { borderRadius: 18, borderWidth: 1, padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12 },
  cardIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 14, ...font.bold },
  cardMetaRight: { marginLeft: 'auto', fontSize: 12, ...font.semibold },
  emptyText: { fontSize: 13, ...font.regular },
  groceryItems: { gap: 11 },
  groceryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  groceryBox: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groceryName: { flex: 1, fontSize: 13.5, ...font.medium },
  groceryDone: { textDecorationLine: 'line-through' },
  groceryWho: { fontSize: 11, ...font.regular },

  // ── Games
  games: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    padding: 13,
  },
  gamesEmoji: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F6E7C4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gamesEmojiText: { fontSize: 19 },
  gamesTitle: { fontSize: 14.5, ...font.bold },
  gamesSub: { fontSize: 12, ...font.regular, marginTop: 1 },
});
