import { useState, useCallback, useMemo, useRef } from 'react';
import {
  View, StyleSheet, ScrollView, Pressable, TextInput, FlatList,
  ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@stores/authStore';
import { useBillsStore, calculateAllNetBalances, calculateSimplifiedBalancesForUser, type Bill } from '@stores/billsStore';
import { useRecurringBillsStore, calculateFairness } from '@stores/recurringBillsStore';
import { useParkingStore } from '@stores/parkingStore';
import { useGroceryStore, type GroceryItem } from '@stores/groceryStore';
import { useChoresStore, type Chore } from '@stores/choresStore';
import { useChatStore } from '@stores/chatStore';
import { useVotingStore } from '@stores/votingStore';
import { useEventsStore } from '@stores/eventsStore';
import { useHousematesStore, type Housemate } from '@stores/housematesStore';
import { resolveName } from '@utils/housemates';
import { useBadgeStore, countNew, countNewSimple } from '@stores/badgeStore';
import { useSettingsStore } from '@stores/settingsStore';
import { font } from '@constants/typography';
import { useColors } from '@hooks/useColors';

// ── Helpers ───────────────────────────────────────────────────────────────────
function greetingText(name: string): string {
  const h = new Date().getHours();
  if (h < 12) return `Good morning, ${name}`;
  if (h < 18) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function parkingAge(startTime: string): string {
  const diff = Date.now() - new Date(startTime).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h ${m > 0 ? `${m}m` : ''}`.trimEnd();
  if (m > 0) return `${m} min`;
  return 'Just now';
}

function todayDateLabel(): string {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

const CATEGORY_ICON_MAP: Record<string, { name: string; color: string; bg: string }> = {
  rent:           { name: 'home-outline',       color: '#8B5CF6', bg: '#2D1F4A' },
  groceries:      { name: 'cart-outline',        color: '#22C55E', bg: '#0A2A1A' },
  food:           { name: 'fast-food-outline',   color: '#F59E0B', bg: '#2A1A0A' },
  transport:      { name: 'car-outline',         color: '#64748B', bg: '#1A1F2A' },
  utilities:      { name: 'flash-outline',       color: '#F59E0B', bg: '#2A1A0A' },
  internet:       { name: 'wifi-outline',        color: '#06B6D4', bg: '#0A1F2A' },
  phone:          { name: 'phone-portrait-outline', color: '#06B6D4', bg: '#0A1F2A' },
  entertainment:  { name: 'musical-notes-outline', color: '#EC4899', bg: '#2A0A1A' },
  health:         { name: 'medkit-outline',      color: '#10B981', bg: '#0A2A1A' },
  shopping:       { name: 'bag-outline',         color: '#10B981', bg: '#0A2A1A' },
  travel:         { name: 'airplane-outline',    color: '#3B82F6', bg: '#0A1A2A' },
  other:          { name: 'receipt-outline',     color: '#6B7280', bg: '#1A1A1A' },
};

function catIconMeta(category: string | null): { name: string; color: string; bg: string } {
  return CATEGORY_ICON_MAP[(category ?? '').toLowerCase()] ?? CATEGORY_ICON_MAP.other;
}

// ── Widget Card wrapper ───────────────────────────────────────────────────────
export interface WidgetCardProps {
  children: React.ReactNode;
  style?: object;
  onPress?: () => void;
}

function WidgetCard({ children, style, onPress }: WidgetCardProps): React.JSX.Element {
  const c = useColors();
  const cardStyle = [styles.card, { backgroundColor: c.surface, borderColor: c.border }, style];
  if (onPress) {
    return (
      <Pressable style={cardStyle} onPress={onPress} accessibilityRole="button">
        {children}
      </Pressable>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}

// ── Balance Hero Card ─────────────────────────────────────────────────────────
function BalanceHeroCard(): React.JSX.Element {
  const currency = useSettingsStore((s) => s.currency);
  const bills = useBillsStore((s) => s.bills);
  const profile = useAuthStore((s) => s.profile);
  const lastSeen = useBadgeStore((s) => s.lastSeen);
  const householdBills = useRecurringBillsStore((s) => s.bills);
  const payments = useRecurringBillsStore((s) => s.payments);
  const myId = profile?.id ?? '';
  const activeBills = bills.filter((b) => !b.settled);
  const combinedNet = new Map<string, number>(calculateAllNetBalances(activeBills));
  for (const { person, balance } of calculateFairness(householdBills, payments)) {
    combinedNet.set(person, (combinedNet.get(person) ?? 0) + balance);
  }
  const balances = calculateSimplifiedBalancesForUser(combinedNet, myId);
  const totalOwed = balances.filter((b) => b.amount > 0).reduce((s, b) => s + b.amount, 0);
  const totalOwe  = balances.filter((b) => b.amount < 0).reduce((s, b) => s + Math.abs(b.amount), 0);
  const netAmount = totalOwed - totalOwe;
  const newBills  = countNewSimple(bills.filter((b) => !b.settled), lastSeen.bills);
  const isOwed    = netAmount >= 0;
  const peopleCount = balances.length;

  return (
    <Pressable
      style={styles.balanceHero}
      onPress={() => router.push('/(tabs)/bills')}
      accessibilityRole="button"
      accessibilityLabel={`Balance: ${isOwed ? 'you are owed' : 'you owe'} ${currency}${Math.abs(netAmount).toFixed(2)}`}
    >
      {/* Decorative circle */}
      <View style={styles.balanceHeroDeco} />

      <View style={styles.balanceHeroTop}>
        <Text style={styles.balanceHeroLabel}>
          {balances.length === 0 ? 'All settled up' : isOwed ? "You're owed" : 'You owe'}
        </Text>
        {newBills > 0 && (
          <View style={styles.balanceHeroNewBadge}>
            <Text style={styles.balanceHeroNewBadgeText}>{newBills} new</Text>
          </View>
        )}
        {peopleCount > 0 && (
          <Text style={styles.balanceHeroSub}>
            across {peopleCount} housemate{peopleCount !== 1 ? 's' : ''}
          </Text>
        )}
      </View>

      <Text style={styles.balanceHeroAmt}>
        {currency}{Math.abs(netAmount).toFixed(2)}
      </Text>

      {balances.length > 0 && (
        <View style={styles.balanceHeroBtns}>
          <Pressable
            style={styles.balanceHeroSettleBtn}
            onPress={() => router.push('/(tabs)/bills')}
            accessibilityRole="button"
          >
            <Text style={styles.balanceHeroSettleBtnText}>Settle up</Text>
          </Pressable>
          <Pressable
            style={styles.balanceHeroDetailsBtn}
            onPress={() => router.push('/(tabs)/bills')}
            accessibilityRole="button"
          >
            <Text style={styles.balanceHeroDetailsBtnText}>Details →</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

// ── Today at Home ─────────────────────────────────────────────────────────────
function TodayAtHome(): React.JSX.Element {
  const c         = useColors();
  const current   = useParkingStore((s) => s.current);
  const chores    = useChoresStore((s) => s.chores);
  const items     = useGroceryStore((s) => s.items);
  const housemates = useHousematesStore((s) => s.housemates);
  const isEnabled = useSettingsStore((s) => s.isEnabled);

  const isFree         = !current;
  const pendingChores  = chores.filter((ch) => !ch.isComplete).length;
  const totalChores    = chores.length;
  const groceryPending = items.filter((i) => !i.isChecked && !i.isPersonal).length;

  return (
    <View style={styles.todaySection}>
      <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>Today at home</Text>
      <View style={styles.todayRow}>
        {isEnabled('parking') && (
          <Pressable
            style={[styles.todayCard, { backgroundColor: c.surface, borderColor: c.border }]}
            onPress={() => router.push('/(tabs)/parking')}
            accessibilityRole="button"
          >
            <View style={[styles.todayIconWrap, { backgroundColor: isFree ? '#0A2418' : '#2A0A0A' }]}>
              <Ionicons name={isFree ? 'car-outline' : 'car'} size={20} color={isFree ? '#4FB071' : '#D9534F'} />
            </View>
            <Text style={styles.todayCardCat}>PARKING</Text>
            <Text style={[styles.todayCardStatus, { color: c.textPrimary }]}>
              {isFree ? 'Free' : 'In use'}
            </Text>
            <Text style={[styles.todayCardSub, { color: c.textSecondary }]}>
              {isFree ? 'Available' : `by ${resolveName(current?.occupant ?? '', housemates).split(' ')[0]}`}
            </Text>
          </Pressable>
        )}
        {isEnabled('chores') && (
          <Pressable
            style={[styles.todayCard, { backgroundColor: c.surface, borderColor: c.border }]}
            onPress={() => router.push('/(tabs)/chores')}
            accessibilityRole="button"
          >
            <View style={[styles.todayIconWrap, { backgroundColor: '#0A1E30' }]}>
              <Ionicons name="checkmark-done-outline" size={20} color="#4F78B6" />
            </View>
            <Text style={styles.todayCardCat}>CHORES</Text>
            <Text style={[styles.todayCardStatus, { color: c.textPrimary }]}>
              {totalChores - pendingChores}/{totalChores}
            </Text>
            <Text style={[styles.todayCardSub, { color: c.textSecondary }]}>
              {pendingChores === 0 ? 'All done!' : 'On track'}
            </Text>
          </Pressable>
        )}
        {isEnabled('grocery') && (
          <Pressable
            style={[styles.todayCard, { backgroundColor: c.surface, borderColor: c.border }]}
            onPress={() => router.push('/(tabs)/grocery')}
            accessibilityRole="button"
          >
            <View style={[styles.todayIconWrap, { backgroundColor: '#2A1E0A' }]}>
              <Ionicons name="cart-outline" size={20} color="#E0B24D" />
            </View>
            <Text style={styles.todayCardCat}>GROCERY</Text>
            <Text style={[styles.todayCardStatus, { color: c.textPrimary }]}>{groceryPending}</Text>
            <Text style={[styles.todayCardSub, { color: c.textSecondary }]}>
              {groceryPending === 1 ? 'item' : 'items'} to buy
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ── Recent Expenses ───────────────────────────────────────────────────────────
function RecentExpenses(): React.JSX.Element {
  const c          = useColors();
  const bills      = useBillsStore((s) => s.bills);
  const currency   = useSettingsStore((s) => s.currency);
  const housemates = useHousematesStore((s) => s.housemates);

  const recent = useMemo(
    () => [...bills]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 4),
    [bills],
  );

  if (recent.length === 0) return <></>;

  return (
    <View style={styles.recentSection}>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>Recent expenses</Text>
        <Pressable onPress={() => router.push('/(tabs)/bills')} accessibilityRole="button">
          <Text style={[styles.sectionSeeAll, { color: c.primary }]}>See all ›</Text>
        </Pressable>
      </View>
      <View style={[styles.recentCard, { backgroundColor: c.surface, borderColor: c.border }]}>
        {recent.map((bill, idx) => {
          const meta = catIconMeta(bill.category);
          return (
            <View key={bill.id}>
              {idx > 0 && <View style={[styles.recentSep, { backgroundColor: c.border }]} />}
              <Pressable
                style={styles.recentRow}
                onPress={() => router.push(`/(tabs)/bills/${bill.id}`)}
                accessibilityRole="button"
              >
                <View style={[styles.recentIconWrap, { backgroundColor: meta.bg }]}>
                  <Ionicons name={meta.name as never} size={16} color={meta.color} />
                </View>
                <View style={styles.recentInfo}>
                  <Text style={[styles.recentTitle, { color: c.textPrimary }]} numberOfLines={1}>
                    {bill.title}
                  </Text>
                  <Text style={[styles.recentSub, { color: c.textSecondary }]}>
                    Paid by {resolveName(bill.paidBy, housemates)} · {timeAgo(bill.createdAt)}
                  </Text>
                </View>
                <View style={styles.recentRight}>
                  <Text style={[styles.recentAmt, { color: c.textPrimary }]}>
                    {currency}{bill.amount.toFixed(2)}
                  </Text>
                  <View style={[
                    styles.recentBadge,
                    { backgroundColor: bill.settled ? '#0A2418' : c.surfaceSecondary },
                  ]}>
                    <Text style={[styles.recentBadgeText, { color: bill.settled ? '#4FB071' : c.textSecondary }]}>
                      {bill.settled ? 'Settled' : 'Pending'}
                    </Text>
                  </View>
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Chore Card ────────────────────────────────────────────────────────────────
function ChoreCard(): React.JSX.Element {
  const c          = useColors();
  const chores     = useChoresStore((s) => s.chores);
  const toggleChore = useChoresStore((s) => s.toggleChore);
  const profile    = useAuthStore((s) => s.profile);
  const lastSeen   = useBadgeStore((s) => s.lastSeen);
  const myId       = profile?.id ?? '';
  const myChore    = chores.find((ch) => !ch.isComplete && ch.claimedBy === myId);
  const pending    = chores.filter((ch) => !ch.isComplete);
  const done       = chores.filter((ch) => ch.isComplete);
  const newChores  = countNewSimple(pending, lastSeen.chores);

  return (
    <WidgetCard onPress={() => router.push('/(tabs)/chores')}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconWrap, { backgroundColor: '#1A1000' }]}>
          <Ionicons name="checkmark-done-outline" size={18} color="#E0B24D" />
        </View>
        <Text style={[styles.cardTitle, { color: c.textPrimary }]}>Your Chore</Text>
        {newChores > 0
          ? <View style={styles.cardBadge}><Text style={styles.cardBadgeText}>{newChores}</Text></View>
          : chores.length > 0
          ? <View style={[styles.badgePill, { backgroundColor: c.surfaceSecondary }]}>
              <Text style={[styles.badgePillText, { color: c.textSecondary }]}>{done.length}/{chores.length} done</Text>
            </View>
          : null
        }
      </View>
      {myChore ? (
        <>
          <View style={[styles.choreBox, { backgroundColor: '#1A1000' }]}>
            <Ionicons name="brush-outline" size={22} color="#E0B24D" />
            <Text style={[styles.choreName, { color: c.textPrimary }]} numberOfLines={2}>{myChore.name}</Text>
          </View>
          <Pressable
            style={[styles.doneBtn, { backgroundColor: c.positive + '18' }]}
            onPress={(e) => { e.stopPropagation?.(); toggleChore(myChore.id); }}
            accessibilityRole="button"
          >
            <Ionicons name="checkmark" size={14} color={c.positive} />
            <Text style={[styles.doneBtnText, { color: c.positive }]}>Mark as Done</Text>
          </Pressable>
        </>
      ) : pending.length > 0 ? (
        <>
          <Text style={[styles.bigNumber, { color: c.textPrimary }]} numberOfLines={1}>{pending[0].name}</Text>
          <Text style={[styles.cardMuted, { color: c.textSecondary }]}>Not yet claimed</Text>
        </>
      ) : (
        <>
          <View style={styles.doneAllWrap}>
            <Ionicons name="checkmark-circle" size={32} color={c.positive} />
          </View>
          <Text style={[styles.cardMuted, { color: c.textSecondary }]}>All chores done!</Text>
        </>
      )}
    </WidgetCard>
  );
}

// ── Parking Card ──────────────────────────────────────────────────────────────
function ParkingCard(): React.JSX.Element {
  const c            = useColors();
  const current      = useParkingStore((s) => s.current);
  const reservations = useParkingStore((s) => s.reservations);
  const claim        = useParkingStore((s) => s.claim);
  const release      = useParkingStore((s) => s.release);
  const profile      = useAuthStore((s) => s.profile);
  const houseId      = useAuthStore((s) => s.houseId);
  const housemates   = useHousematesStore((s) => s.housemates);
  const myId         = profile?.id ?? '';
  const myName       = profile?.name ?? '';
  const isFree       = !current;
  const isMine       = current?.occupant === myId;

  const lastSeen           = useBadgeStore((s) => s.lastSeen);
  const sortedReservations = [...reservations].sort((a, b) => a.date.localeCompare(b.date));
  const pendingFromOthers  = sortedReservations.filter((r) => r.status === 'pending' && r.requestedBy !== myId);
  const myReservation      = sortedReservations.find((r) => r.requestedBy === myId) ?? null;
  const pendingCount       = reservations.filter((r) => r.status === 'pending').length;
  const newReservations    = countNew(reservations as unknown as Array<{ createdAt: string; [k: string]: unknown }>, lastSeen.parking, myId, 'requestedBy');

  const handleClaim   = useCallback(async (): Promise<void> => { await claim(myId, myName, houseId ?? '').catch(() => {}); }, [claim, myId, myName, houseId]);
  const handleRelease = useCallback(async (): Promise<void> => { await release(houseId ?? '').catch(() => {}); }, [release, houseId]);

  return (
    <WidgetCard onPress={() => router.push('/(tabs)/parking')}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconWrap, { backgroundColor: isFree ? '#0A2418' : '#2A0A0A' }]}>
          <Ionicons name={isFree ? 'car-outline' : 'car'} size={18} color={isFree ? c.positive : c.negative} />
        </View>
        <Text style={[styles.cardTitle, { color: c.textPrimary }]}>Parking Spot</Text>
        {newReservations > 0
          ? <View style={styles.cardBadge}><Text style={styles.cardBadgeText}>{newReservations}</Text></View>
          : pendingCount > 0
          ? <View style={[styles.badgePill, { backgroundColor: '#2A1A00' }]}>
              <Text style={[styles.badgePillText, { color: '#E0B24D' }]}>{pendingCount} pending</Text>
            </View>
          : <Ionicons name="chevron-forward" size={16} color={c.textSecondary} />
        }
      </View>
      <View style={[styles.parkingStatus, { backgroundColor: isFree ? c.positive + '14' : c.negative + '14' }]}>
        <Text style={[styles.parkingStatusText, { color: isFree ? c.positive : c.negative }]}>
          {isFree ? 'Available now' : isMine ? 'Your car' : resolveName(current?.occupant ?? '', housemates)}
        </Text>
        {current && !isFree && <Text style={[styles.parkingAge, { color: c.textSecondary }]}>{parkingAge(current.startTime)}</Text>}
      </View>
      <Text style={[styles.cardMuted, { color: c.textSecondary }]}>
        {isFree ? 'No one is using the spot' : isMine ? `In use for ${parkingAge(current?.startTime ?? '')}` : `Used by ${resolveName(current?.occupant ?? '', housemates)} · ${parkingAge(current?.startTime ?? '')}`}
      </Text>
      {pendingFromOthers.map((r) => (
        <View key={r.id} style={[styles.parkingPendingRow, { backgroundColor: '#2A1A00' }]}>
          <View style={styles.parkingPendingInfo}>
            <Ionicons name="time-outline" size={14} color="#E0B24D" />
            <Text style={[styles.parkingPendingText, { color: '#E0B24D', flex: 1 }]}>
              {resolveName(r.requestedBy, housemates)} wants {r.date}{r.startTime ? ` at ${r.startTime}` : ''}
            </Text>
          </View>
          <View style={[styles.approveBtn, { backgroundColor: c.positive }]}>
            <Text style={styles.approveBtnText}>Vote</Text>
          </View>
        </View>
      ))}
      {myReservation && pendingFromOthers.length === 0 && (
        <View style={[styles.parkingReservationRow, {
          backgroundColor: myReservation.status === 'approved' ? c.positive + '14' : myReservation.status === 'rejected' ? c.negative + '14' : '#2A1A00',
        }]}>
          <Ionicons
            name={myReservation.status === 'approved' ? 'checkmark-circle-outline' : myReservation.status === 'rejected' ? 'close-circle-outline' : 'time-outline'}
            size={14}
            color={myReservation.status === 'approved' ? c.positive : myReservation.status === 'rejected' ? c.negative : '#E0B24D'}
          />
          <Text style={[styles.parkingReservationText, {
            color: myReservation.status === 'approved' ? c.positive : myReservation.status === 'rejected' ? c.negative : '#E0B24D',
          }]}>
            {myReservation.status === 'approved' ? 'Your spot confirmed' : myReservation.status === 'rejected' ? 'Request rejected' : 'Your request pending'}
            {' · '}{myReservation.date}{myReservation.startTime ? ` at ${myReservation.startTime}` : ''}
          </Text>
        </View>
      )}
      {isFree && (
        <Pressable style={[styles.claimBtn, { backgroundColor: c.positive }]} onPress={(e) => { e.stopPropagation?.(); handleClaim(); }} accessibilityRole="button" accessibilityLabel="Claim parking spot">
          <Ionicons name="car" size={14} color="#fff" />
          <Text style={styles.claimBtnText}>Claim Spot</Text>
        </Pressable>
      )}
      {isMine && (
        <Pressable style={[styles.releaseBtn, { borderColor: c.negative + '40' }]} onPress={(e) => { e.stopPropagation?.(); handleRelease(); }} accessibilityRole="button" accessibilityLabel="Release parking spot">
          <Ionicons name="exit-outline" size={14} color={c.negative} />
          <Text style={[styles.releaseBtnText, { color: c.negative }]}>Release Spot</Text>
        </Pressable>
      )}
    </WidgetCard>
  );
}

// ── Grocery Widget ────────────────────────────────────────────────────────────
interface GroceryWidgetRowProps {
  item: GroceryItem;
  myId: string;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

function GroceryWidgetRow({ item, myId, onToggle, onDelete }: GroceryWidgetRowProps): React.JSX.Element {
  const c         = useColors();
  const swipeRef  = useRef<Swipeable>(null);
  const canDelete = item.addedBy === myId;

  const handleToggle = useCallback((): void => { swipeRef.current?.close(); onToggle(item.id); }, [item.id, onToggle]);
  const handleDelete = useCallback((): void => { swipeRef.current?.close(); onDelete(item.id); }, [item.id, onDelete]);

  const renderCheckAction = useCallback((): React.JSX.Element => (
    <Pressable accessible style={[styles.widgetSwipeCheck, item.isChecked && styles.widgetSwipeUncheck]} onPress={handleToggle} accessibilityRole="button" accessibilityLabel={item.isChecked ? 'Mark as needed' : 'Mark as done'}>
      <Ionicons name={item.isChecked ? 'arrow-undo-outline' : 'checkmark'} size={16} color="#fff" />
    </Pressable>
  ), [item.isChecked, handleToggle]);

  const renderDeleteAction = useCallback((): React.JSX.Element => (
    <Pressable accessible style={styles.widgetSwipeDelete} onPress={handleDelete} accessibilityRole="button" accessibilityLabel="Delete item">
      <Ionicons name="trash-outline" size={16} color="#fff" />
    </Pressable>
  ), [handleDelete]);

  return (
    <Swipeable ref={swipeRef} renderLeftActions={renderCheckAction} renderRightActions={canDelete ? renderDeleteAction : undefined} overshootLeft={false} overshootRight={false} friction={2}>
      <Pressable style={[styles.groceryRow, { backgroundColor: c.surface }]} onPress={handleToggle} accessibilityRole="checkbox" accessibilityState={{ checked: item.isChecked }}>
        <Ionicons name={item.isChecked ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={item.isChecked ? c.positive : c.border} />
        <Text style={[styles.groceryItemText, { color: c.textPrimary }, item.isChecked && styles.groceryItemDone]}>
          {item.name}
        </Text>
        {item.quantity && item.quantity !== '1' && (
          <Text style={[styles.groceryQty, { color: c.textSecondary }]}>×{item.quantity}</Text>
        )}
      </Pressable>
    </Swipeable>
  );
}

function GroceryWidget(): React.JSX.Element {
  const c                  = useColors();
  const items              = useGroceryStore((s) => s.items);
  const addItem            = useGroceryStore((s) => s.addItem);
  const toggleItem         = useGroceryStore((s) => s.toggleItem);
  const deleteItem         = useGroceryStore((s) => s.deleteItem);
  const publishDraftItems  = useGroceryStore((s) => s.publishDraftItems);
  const profile            = useAuthStore((s) => s.profile);
  const houseId            = useAuthStore((s) => s.houseId);
  const lastSeen           = useBadgeStore((s) => s.lastSeen);
  const draftEnabled       = useSettingsStore((s) => s.features.find((f) => f.key === 'grocery_draft')?.enabled ?? true);
  const myId               = profile?.id ?? '';

  const [input, setInput]               = useState('');
  const [qty, setQty]                   = useState('');
  const [addError, setAddError]         = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const myDraftItems  = useMemo(() => items.filter((i) => i.isDraft && i.addedBy === myId), [items, myId]);
  const sharedPending = useMemo(() => items.filter((i) => !i.isPersonal && !i.isChecked).slice(0, 5), [items]);
  const totalShared   = useMemo(() => items.filter((i) => !i.isPersonal && !i.isChecked).length, [items]);

  const newGrocery = countNew(items.filter((i) => !i.isChecked) as unknown as Array<{ createdAt: string; [k: string]: unknown }>, lastSeen.grocery, myId, 'addedBy');

  const handleAdd = useCallback(async (): Promise<void> => {
    const n = input.trim();
    if (!n) return;
    try {
      await addItem(n, qty.trim(), myId, houseId ?? '', draftEnabled ? 'draft' : 'shared');
      setInput(''); setQty(''); setAddError(null);
    } catch { setAddError('Could not add item. Try again.'); }
  }, [input, qty, addItem, myId, houseId, draftEnabled]);

  const handlePublish = useCallback(async (): Promise<void> => {
    if (isPublishing || !myId) return;
    setAddError(null); setIsPublishing(true);
    try { await publishDraftItems(myId); }
    catch { setAddError('Could not share draft. Try again.'); }
    finally { setIsPublishing(false); }
  }, [publishDraftItems, myId, isPublishing]);

  const handleToggle = useCallback((id: string): void => { toggleItem(id); }, [toggleItem]);
  const handleDelete = useCallback((id: string): void => { deleteItem(id).catch(() => {}); }, [deleteItem]);

  const draftHeader = myDraftItems.length > 0 ? (
    <>
      <View style={styles.groceryDraftHeader}>
        <Text style={styles.groceryDraftTitle}>📝 My Draft</Text>
        <Pressable onPress={handlePublish} disabled={isPublishing || !myId} style={[styles.groceryDraftApproveBtn, (isPublishing || !myId) && styles.groceryDraftApproveBtnDisabled]} accessible accessibilityRole="button" accessibilityState={{ disabled: isPublishing || !myId }} accessibilityLabel="Share draft with housemates">
          {isPublishing ? <ActivityIndicator size="small" color="#E0B24D" /> : <Ionicons name="checkmark-circle" size={22} color="#E0B24D" />}
        </Pressable>
      </View>
      {myDraftItems.map((item) => (<GroceryWidgetRow key={item.id} item={item} myId={myId} onToggle={handleToggle} onDelete={handleDelete} />))}
      {sharedPending.length > 0 && <Text style={[styles.grocerySharedLabel, { color: c.textSecondary }]}>🏠 Shared</Text>}
    </>
  ) : null;

  return (
    <WidgetCard>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconWrap, { backgroundColor: '#0A2418' }]}>
          <Ionicons name="cart-outline" size={18} color="#4FB071" />
        </View>
        <Text style={[styles.cardTitle, { color: c.textPrimary }]}>Shared Groceries</Text>
        {newGrocery > 0
          ? <View style={styles.cardBadge}><Text style={styles.cardBadgeText}>{newGrocery}</Text></View>
          : <Pressable onPress={() => router.push('/(tabs)/grocery')} accessibilityRole="button"><Text style={[styles.viewAll, { color: c.primary }]}>View all</Text></Pressable>
        }
      </View>
      <View style={[styles.groceryInputRow, { backgroundColor: c.surfaceSecondary, borderColor: c.border }]}>
        <Ionicons name="add" size={16} color={c.textSecondary} />
        <TextInput style={[styles.groceryInput, { color: c.textPrimary }]} value={input} onChangeText={(t) => { setInput(t); if (addError) setAddError(null); }} placeholder="Add an item..." placeholderTextColor={c.textSecondary} returnKeyType="next" onSubmitEditing={handleAdd} accessibilityLabel="Grocery item name" />
        <View style={[styles.groceryQtySep, { backgroundColor: c.border }]} />
        <TextInput style={[styles.groceryQtyInput, { color: c.textPrimary }]} value={qty} onChangeText={setQty} placeholder="Qty" placeholderTextColor={c.textSecondary} keyboardType="number-pad" returnKeyType="done" onSubmitEditing={handleAdd} accessibilityLabel="Quantity" />
        {input.trim().length > 0 && (
          <Pressable accessible onPress={handleAdd} style={[styles.groceryAddBtn, { backgroundColor: c.primary }]} accessibilityRole="button" accessibilityLabel="Add item" accessibilityState={{ disabled: false }}>
            <Ionicons name="return-down-back-outline" size={15} color="#fff" />
          </Pressable>
        )}
      </View>
      {!!addError && <Text style={[styles.groceryAddError, { color: c.negative }]}>{addError}</Text>}
      <FlatList
        data={sharedPending}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <GroceryWidgetRow item={item} myId={myId} onToggle={handleToggle} onDelete={handleDelete} />}
        ListHeaderComponent={draftHeader}
        ListEmptyComponent={myDraftItems.length === 0 ? <Text style={[styles.cardMuted, { color: c.textSecondary }]}>List is empty — add something above</Text> : null}
        scrollEnabled={false}
        nestedScrollEnabled
      />
      {totalShared > 5 && (
        <Pressable onPress={() => router.push('/(tabs)/grocery')} accessibilityRole="button">
          <Text style={[styles.viewAll, { color: c.primary }]}>+{totalShared - 5} more items</Text>
        </Pressable>
      )}
    </WidgetCard>
  );
}

// ── Votes Widget ──────────────────────────────────────────────────────────────
function VotesWidget(): React.JSX.Element {
  const c          = useColors();
  const proposals  = useVotingStore((s) => s.proposals);
  const profile    = useAuthStore((s) => s.profile);
  const housemates = useHousematesStore((s) => s.housemates);
  const lastSeen   = useBadgeStore((s) => s.lastSeen);
  const myId       = profile?.id ?? '';
  const totalPeople = Math.max(1, housemates.length);
  const active     = proposals.filter((p) => p.isOpen);
  const newVotes   = countNew(active as unknown as Array<{ createdAt: string; [k: string]: unknown }>, lastSeen.voting, myId, 'createdBy');

  if (active.length === 0) {
    return (
      <WidgetCard onPress={() => router.push('/(tabs)/voting')}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconWrap, { backgroundColor: '#1A0F2A' }]}>
            <Ionicons name="hand-left-outline" size={18} color="#7C4DFF" />
          </View>
          <Text style={[styles.cardTitle, { color: c.textPrimary }]}>Active Votes</Text>
        </View>
        <Text style={[styles.cardMuted, { color: c.textSecondary }]}>No open votes right now</Text>
      </WidgetCard>
    );
  }

  const top        = active[0];
  const yesCount   = top.votes.filter((v) => v.choice === 'yes').length;
  const noCount    = top.votes.filter((v) => v.choice === 'no').length;
  const totalVotes = yesCount + noCount;
  const yesWidth   = totalVotes > 0 ? (yesCount / totalVotes) * 100 : 0;
  const myVote     = top.votes.find((v) => v.person === myId)?.choice ?? null;
  const allVoted   = totalVotes >= totalPeople;

  type BadgeState = { label: string; bg: string; color: string };
  const badge: BadgeState = ((): BadgeState => {
    if (!myVote) return { label: 'Vote now', bg: c.danger + '20', color: c.danger };
    if (!allVoted) return { label: `Waiting (${totalVotes}/${totalPeople})`, bg: c.textSecondary + '18', color: c.textSecondary };
    if (yesCount > noCount) return { label: 'Passed', bg: c.positive + '20', color: c.positive };
    return { label: 'Rejected', bg: c.negative + '20', color: c.negative };
  })();

  return (
    <WidgetCard onPress={() => router.push('/(tabs)/voting')}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconWrap, { backgroundColor: '#1A0F2A' }]}>
          <Ionicons name="hand-left-outline" size={18} color="#7C4DFF" />
        </View>
        <Text style={[styles.cardTitle, { color: c.textPrimary }]}>Active Votes</Text>
        {newVotes > 0
          ? <View style={styles.cardBadge}><Text style={styles.cardBadgeText}>{newVotes}</Text></View>
          : <View style={[styles.badgePill, { backgroundColor: badge.bg }]}><Text style={[styles.badgePillText, { color: badge.color }]}>{badge.label}</Text></View>
        }
      </View>
      <Text style={[styles.voteQuestion, { color: c.textPrimary }]} numberOfLines={2}>{top.title}</Text>
      <View style={styles.voteBarRow}>
        <Text style={[styles.voteBarLabel, { color: c.textSecondary }]}>Yes</Text>
        <View style={[styles.voteTrack, { backgroundColor: c.surfaceSecondary }]}>
          <View style={[styles.voteBar, { width: `${yesWidth}%` as `${number}%`, backgroundColor: '#7C4DFF' }]} />
        </View>
        <Text style={[styles.voteCount, { color: c.textPrimary }]}>{yesCount}</Text>
      </View>
      <View style={styles.voteBarRow}>
        <Text style={[styles.voteBarLabel, { color: c.textSecondary }]}>No</Text>
        <View style={[styles.voteTrack, { backgroundColor: c.surfaceSecondary }]}>
          <View style={[styles.voteBar, { width: `${100 - yesWidth}%` as `${number}%`, backgroundColor: c.border }]} />
        </View>
        <Text style={[styles.voteCount, { color: c.textPrimary }]}>{noCount}</Text>
      </View>
    </WidgetCard>
  );
}

// ── Mini Calendar Widget ──────────────────────────────────────────────────────
const CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CAL_DAYS   = ['S','M','T','W','T','F','S'];

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function MiniCalendarWidget(): React.JSX.Element {
  const c                  = useColors();
  const events             = useEventsStore((s) => s.events);
  const reservations       = useParkingStore((s) => s.reservations);
  const recurringBills     = useRecurringBillsStore((s) => s.bills);
  const recurringPayments  = useRecurringBillsStore((s) => s.payments);
  const chores             = useChoresStore((s) => s.chores);
  const showRecurring      = useSettingsStore((s) => s.showRecurringBillsOnCalendar);

  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const eventMap = useMemo((): Record<string, Array<{ title: string; color: string }>> => {
    const map: Record<string, Array<{ title: string; color: string }>> = {};
    const push = (date: string, title: string, color: string): void => {
      if (!date) return;
      if (!map[date]) map[date] = [];
      map[date].push({ title, color });
    };
    const billNameById = new Map(recurringBills.map((b) => [b.id, b.name]));
    events.forEach((e) => push(e.date, e.title, '#6366f1'));
    reservations.forEach((r) => push(r.date, 'Parking', '#f59e0b'));
    if (showRecurring) recurringPayments.forEach((p) => push(p.paidAt, billNameById.get(p.billId) ?? 'Recurring', '#ef4444'));
    chores.forEach((ch) => { if (ch.recurrence === 'once' && ch.recurrenceDay) push(ch.recurrenceDay, ch.name, '#22c55e'); });
    return map;
  }, [events, reservations, recurringPayments, recurringBills, chores, showRecurring]);

  const grid = useMemo((): Date[] => {
    const first = new Date(viewYear, viewMonth, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    const days: Date[] = [];
    for (let i = 0; i < 35; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [viewYear, viewMonth]);

  const prevMonth = useCallback((): void => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); } else setViewMonth((m) => m - 1);
  }, [viewMonth]);
  const nextMonth = useCallback((): void => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); } else setViewMonth((m) => m + 1);
  }, [viewMonth]);

  const todayStr = toYMD(today);

  return (
    <WidgetCard>
      <View style={styles.calHeader}>
        <Pressable style={styles.calTitleRow} onPress={() => router.push('/(tabs)/calendar')} accessibilityRole="button" accessibilityLabel="Open calendar">
          <View style={[styles.cardIconWrap, { backgroundColor: '#1A0F2A' }]}>
            <Ionicons name="calendar-outline" size={18} color="#6366f1" />
          </View>
          <Text style={[styles.cardTitle, { color: c.textPrimary }]}>Calendar</Text>
          <Ionicons name="chevron-forward" size={16} color={c.textSecondary} />
        </Pressable>
        <View style={styles.calNavRow}>
          <Pressable onPress={prevMonth} style={[styles.calNavBtn, { backgroundColor: c.surfaceSecondary }]} accessibilityRole="button">
            <Ionicons name="chevron-back" size={15} color={c.textSecondary} />
          </Pressable>
          <Text style={[styles.calMonthLabel, { color: c.textPrimary }]}>{CAL_MONTHS[viewMonth].slice(0, 3)} {viewYear}</Text>
          <Pressable onPress={nextMonth} style={[styles.calNavBtn, { backgroundColor: c.surfaceSecondary }]} accessibilityRole="button">
            <Ionicons name="chevron-forward" size={15} color={c.textSecondary} />
          </Pressable>
        </View>
      </View>
      <View style={styles.calWeekRow}>
        {CAL_DAYS.map((d, i) => <Text key={i} style={[styles.calWeekDay, { color: c.textSecondary }]}>{d}</Text>)}
      </View>
      <View style={styles.calGrid}>
        {[0, 1, 2, 3, 4].map((row) => (
          <View key={row} style={styles.calRow}>
            {grid.slice(row * 7, row * 7 + 7).map((day, idx) => {
              const ymd         = toYMD(day);
              const isToday     = ymd === todayStr;
              const isCurrentMonth = day.getMonth() === viewMonth;
              const dayEvents   = eventMap[ymd] ?? [];
              return (
                <Pressable key={idx} style={styles.calDayCell} onPress={() => router.push('/(tabs)/calendar')} accessibilityRole="button">
                  <View style={[styles.calDayInner, isToday && { backgroundColor: c.primary }]}>
                    <Text style={[styles.calDayNum, { color: c.textPrimary }, !isCurrentMonth && { color: c.textDisabled }, isToday && { color: c.white, ...font.bold }]}>
                      {day.getDate()}
                    </Text>
                  </View>
                  {dayEvents[0] && (
                    <View style={[styles.calEventChip, { backgroundColor: dayEvents[0].color }]}>
                      <Text style={styles.calEventChipText} numberOfLines={1}>{dayEvents[0].title}</Text>
                    </View>
                  )}
                  {dayEvents.length > 1 && <Text style={[styles.calMoreText, { color: c.textSecondary }]}>+{dayEvents.length - 1}</Text>}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <View style={styles.calLegend}>
        {([['#6366f1','Events'],['#ef4444','Recurring'],['#22c55e','Chores'],['#f59e0b','Parking']] as [string,string][]).map(([col, label]) => (
          <View key={label} style={styles.calLegendItem}>
            <View style={[styles.calLegendDot, { backgroundColor: col }]} />
            <Text style={[styles.calLegendLabel, { color: c.textSecondary }]}>{label}</Text>
          </View>
        ))}
      </View>
    </WidgetCard>
  );
}

// ── Activity feed ─────────────────────────────────────────────────────────────
interface ActivityEvent {
  id: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  actor: string;
  text: string;
  time: string;
}

function buildActivityEvents(bills: Bill[], groceryItems: GroceryItem[], chores: Chore[], myId: string, housemates: Housemate[]): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  bills.filter((b) => new Date(b.createdAt).getTime() > cutoff).forEach((b) => {
    events.push({ id: `bill-${b.id}`, icon: 'card-outline', iconColor: '#FF4757', iconBg: '#2A0A0A', actor: b.paidBy === myId ? 'You' : resolveName(b.paidBy, housemates), text: `added a bill — ${b.title}`, time: b.createdAt });
  });
  groceryItems.filter((i) => new Date(i.createdAt).getTime() > cutoff).forEach((i) => {
    events.push({ id: `grocery-${i.id}`, icon: 'cart-outline', iconColor: '#4FB071', iconBg: '#0A2418', actor: i.addedBy === myId ? 'You' : resolveName(i.addedBy, housemates), text: `added "${i.name}" to groceries`, time: i.createdAt });
  });
  chores.filter((ch) => ch.isComplete && ch.completedAt && new Date(ch.completedAt).getTime() > cutoff).forEach((ch) => {
    events.push({ id: `chore-${ch.id}`, icon: 'checkmark-done-outline', iconColor: '#E0B24D', iconBg: '#1A1000', actor: !ch.claimedBy ? 'Someone' : ch.claimedBy === myId ? 'You' : resolveName(ch.claimedBy, housemates), text: `completed "${ch.name}"`, time: ch.completedAt! });
  });
  return events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8);
}

function ActivityFeed(): React.JSX.Element {
  const c            = useColors();
  const bills        = useBillsStore((s) => s.bills);
  const groceryItems = useGroceryStore((s) => s.items);
  const chores       = useChoresStore((s) => s.chores);
  const profile      = useAuthStore((s) => s.profile);
  const housemates   = useHousematesStore((s) => s.housemates);
  const myId         = profile?.id ?? '';
  const events       = useMemo(() => buildActivityEvents(bills, groceryItems, chores, myId, housemates), [bills, groceryItems, chores, myId, housemates]);

  return (
    <WidgetCard>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconWrap, { backgroundColor: '#0A1A30' }]}>
          <Ionicons name="pulse-outline" size={18} color="#4F78B6" />
        </View>
        <Text style={[styles.cardTitle, { color: c.textPrimary }]}>Recent Activity</Text>
      </View>
      {events.length === 0
        ? <Text style={[styles.cardMuted, { color: c.textSecondary }]}>No activity in the last 7 days</Text>
        : events.map((event) => (
          <View key={event.id} style={[styles.activityRow, { borderTopColor: c.border }]}>
            <View style={[styles.activityIconWrap, { backgroundColor: event.iconBg }]}>
              <Ionicons name={event.icon as never} size={14} color={event.iconColor} />
            </View>
            <View style={styles.activityContent}>
              <Text style={[styles.activityText, { color: c.textPrimary }]} numberOfLines={2}>
                <Text style={[styles.activityActor, { color: c.textPrimary }]}>{event.actor} </Text>
                {event.text}
              </Text>
              <Text style={[styles.activityTime, { color: c.textSecondary }]}>{timeAgo(event.time)}</Text>
            </View>
          </View>
        ))
      }
    </WidgetCard>
  );
}

// ── Floating Chat Bubble ──────────────────────────────────────────────────────
function FloatingChatBubble(): React.JSX.Element {
  const c           = useColors();
  const unreadCount = useChatStore((s) => s.unreadCount);
  return (
    <Pressable style={[styles.chatBubble, { backgroundColor: c.primary }]} onPress={() => router.push('/(tabs)/more/chat')} accessibilityRole="button" accessibilityLabel={`House chat${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}>
      <Ionicons name="chatbubble-ellipses" size={22} color="#fff" />
      {unreadCount > 0 && (
        <View style={[styles.chatBubbleBadge, { borderColor: c.background }]}>
          <Text style={styles.chatBubbleBadgeText}>{unreadCount > 9 ? '9+' : String(unreadCount)}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function DashboardScreen(): React.JSX.Element {
  const c          = useColors();
  const profile    = useAuthStore((s) => s.profile);
  const houseName  = useHousematesStore((s) => s.houseName);
  const isEnabled  = useSettingsStore((s) => s.isEnabled);
  const { width }  = useWindowDimensions();

  const isWide = width >= 680;
  const myName = profile?.name ?? 'there';
  const initials = myName.charAt(0).toUpperCase();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      <View style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.scroll, isWide && styles.scrollWide]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Hero greeting ─────────────────────────────────────────── */}
          <View style={styles.hero}>
            <View style={styles.heroLeft}>
              <Text style={[styles.heroDate, { color: c.textSecondary }]}>{todayDateLabel()}</Text>
              <Text style={[styles.greeting, { color: c.textPrimary }]}>{greetingText(myName)}</Text>
              {houseName ? <Text style={[styles.greetingSub, { color: c.textSecondary }]}>{houseName}</Text> : null}
            </View>
            <View style={styles.heroRight}>
              <Pressable
                style={[styles.heroAvatar, { backgroundColor: c.primary }]}
                onPress={() => router.push('/(tabs)/profile')}
                accessibilityRole="button"
                accessibilityLabel="Open profile"
              >
                <Text style={styles.heroAvatarText}>{initials}</Text>
              </Pressable>
            </View>
          </View>

          {/* Quick actions */}
          <View style={styles.quickActions}>
            <Pressable style={[styles.quickBtn, { backgroundColor: c.primary }]} onPress={() => router.push('/(tabs)/bills/add')} accessibilityRole="button" accessibilityLabel="Add new expense">
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.quickBtnText}>Expense</Text>
            </Pressable>
            <Pressable style={[styles.quickBtnOutline, { borderColor: c.border, backgroundColor: c.surface }]} onPress={() => router.push('/(tabs)/bills?openRecurring=1')} accessibilityRole="button" accessibilityLabel="Add house bill">
              <Ionicons name="home-outline" size={16} color={c.primary} />
              <Text style={[styles.quickBtnOutlineText, { color: c.primary }]}>House Bill</Text>
            </Pressable>
          </View>

          {/* ── Balance Hero ──────────────────────────────────────────── */}
          <View style={styles.row}>
            <BalanceHeroCard />
          </View>

          {/* ── Today at home ─────────────────────────────────────────── */}
          {(isEnabled('parking') || isEnabled('chores') || isEnabled('grocery')) && (
            <View style={styles.row}>
              <TodayAtHome />
            </View>
          )}

          {/* ── Recent expenses ───────────────────────────────────────── */}
          <View style={styles.row}>
            <RecentExpenses />
          </View>

          {/* ── Chore + Parking detail cards ──────────────────────────── */}
          <View style={[styles.row, isWide && styles.rowWide]}>
            {isEnabled('chores') && (
              <View style={isWide ? styles.colHalf : styles.colFull}>
                <ChoreCard />
              </View>
            )}
            {isEnabled('parking') && (
              <View style={isWide ? styles.colHalf : styles.colFull}>
                <ParkingCard />
              </View>
            )}
          </View>

          {/* ── Grocery · Votes ───────────────────────────────────────── */}
          <View style={[styles.row, isWide && styles.rowWide]}>
            {isEnabled('grocery') && (
              <View style={isWide ? styles.colHalf : styles.colFull}>
                <GroceryWidget />
              </View>
            )}
            {isEnabled('voting') && (
              <View style={isWide ? styles.colHalf : styles.colFull}>
                <VotesWidget />
              </View>
            )}
          </View>

          {/* ── Calendar ──────────────────────────────────────────────── */}
          <View style={styles.row}>
            <View style={styles.colFull}>
              <MiniCalendarWidget />
            </View>
          </View>

          {/* ── Activity feed ─────────────────────────────────────────── */}
          <View style={styles.row}>
            <View style={styles.colFull}>
              <ActivityFeed />
            </View>
          </View>

          <View style={styles.bottomPad} />
        </ScrollView>
        <FloatingChatBubble />
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
// Colors here use dark values (dark is the default theme).
// Dynamic color overrides are passed via inline style arrays in each component.
const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  scrollWide: { paddingHorizontal: 24 },

  // ── Hero
  hero: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingVertical: 16, gap: 12 },
  heroLeft: { flex: 1, gap: 2 },
  heroRight: { alignItems: 'center', gap: 8 },
  heroDate: { fontSize: 13, ...font.regular },
  greeting: { fontSize: 26, ...font.extrabold, letterSpacing: -0.6, marginTop: 2 },
  greetingSub: { fontSize: 13, ...font.regular, marginTop: 2 },
  heroAvatar: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  heroAvatarText: { fontSize: 18, ...font.bold, color: '#fff' },

  quickActions: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  quickBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, shadowColor: '#4F78B6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 6 },
  quickBtnText: { fontSize: 14, ...font.semibold, color: '#fff' },
  quickBtnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1 },
  quickBtnOutlineText: { fontSize: 14, ...font.semibold },

  // ── Balance hero card
  balanceHero: {
    borderRadius: 20,
    padding: 20,
    gap: 8,
    overflow: 'hidden',
    backgroundColor: '#1A3578',
    shadowColor: '#1E3578',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
  },
  balanceHeroDeco: {
    position: 'absolute', top: -40, right: -30,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  balanceHeroTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balanceHeroLabel: { fontSize: 14, ...font.semibold, color: 'rgba(255,255,255,0.80)' },
  balanceHeroSub: { fontSize: 12, ...font.regular, color: 'rgba(255,255,255,0.55)', marginLeft: 'auto' },
  balanceHeroNewBadge: { backgroundColor: '#D9534F', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  balanceHeroNewBadgeText: { fontSize: 11, ...font.bold, color: '#fff' },
  balanceHeroAmt: { fontSize: 48, ...font.extrabold, color: '#fff', letterSpacing: -1.5, lineHeight: 56 },
  balanceHeroBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  balanceHeroSettleBtn: { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20, minHeight: 44, justifyContent: 'center' },
  balanceHeroSettleBtnText: { fontSize: 14, ...font.bold, color: '#1A3578' },
  balanceHeroDetailsBtn: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20, minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  balanceHeroDetailsBtnText: { fontSize: 14, ...font.semibold, color: 'rgba(255,255,255,0.85)' },

  // ── Today at home
  todaySection: { gap: 10 },
  sectionTitle: { fontSize: 17, ...font.bold },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionSeeAll: { fontSize: 14, ...font.semibold },
  todayRow: { flexDirection: 'row', gap: 10 },
  todayCard: { flex: 1, borderRadius: 16, padding: 14, gap: 4, borderWidth: 1, alignItems: 'flex-start' },
  todayIconWrap: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  todayCardCat: { fontSize: 10, ...font.extrabold, color: '#4D5870', letterSpacing: 0.8 },
  todayCardStatus: { fontSize: 16, ...font.extrabold, letterSpacing: -0.3 },
  todayCardSub: { fontSize: 12, ...font.regular },

  // ── Recent expenses
  recentSection: { gap: 10 },
  recentCard: { borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  recentSep: { height: StyleSheet.hairlineWidth },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  recentIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  recentInfo: { flex: 1, gap: 3 },
  recentTitle: { fontSize: 14, ...font.semibold },
  recentSub: { fontSize: 12, ...font.regular },
  recentRight: { alignItems: 'flex-end', gap: 4 },
  recentAmt: { fontSize: 14, ...font.bold },
  recentBadge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  recentBadgeText: { fontSize: 11, ...font.semibold },

  // ── Grid
  row: { flexDirection: 'column', gap: 12, marginBottom: 12 },
  rowWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  colFull: {},
  colHalf: { flex: 1 },
  colThird: { flex: 1 },

  // ── Base card
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' } as never,
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardIconWrap: { width: 32, height: 32, borderRadius: 9, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  cardTitle: { fontSize: 15, ...font.semibold, flex: 1 },
  cardMuted: { fontSize: 13, ...font.regular, lineHeight: 18 },
  cardBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#D9534F', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  cardBadgeText: { color: '#fff', fontSize: 11, ...font.bold },
  bigNumber: { fontSize: 28, ...font.extrabold, letterSpacing: -0.8 },
  viewAll: { fontSize: 13, ...font.semibold },

  statusPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  statusPillText: { fontSize: 12, ...font.semibold },
  badgePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  badgePillText: { fontSize: 11, ...font.bold },

  // ── Chore card
  choreBox: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, padding: 12 },
  choreName: { flex: 1, fontSize: 15, ...font.semibold },
  doneBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 9 },
  doneBtnText: { fontSize: 13, ...font.semibold },
  doneAllWrap: { alignItems: 'center', paddingVertical: 8 },

  // ── Parking card
  parkingStatus: { borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  parkingStatusText: { fontSize: 15, ...font.bold },
  parkingAge: { fontSize: 12, ...font.regular },
  parkingReservationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginTop: 8 },
  parkingReservationText: { fontSize: 13, ...font.semibold, flex: 1 },
  parkingPendingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginTop: 8, gap: 8 },
  parkingPendingInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  parkingPendingText: { fontSize: 13, ...font.medium },
  approveBtn: { borderRadius: 7, paddingHorizontal: 10, paddingVertical: 5 },
  approveBtnText: { fontSize: 12, ...font.bold, color: '#fff' },
  claimBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 9, paddingVertical: 10, paddingHorizontal: 14, boxShadow: '0 4px 12px rgba(79,176,113,0.28)' } as never,
  claimBtnText: { fontSize: 13, ...font.semibold, color: '#fff' },
  releaseBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'transparent', borderWidth: 1, borderRadius: 9, paddingVertical: 10, paddingHorizontal: 14 },
  releaseBtnText: { fontSize: 13, ...font.semibold },

  // ── Grocery widget
  groceryInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1 },
  groceryInput: { flex: 1, fontSize: 14, ...font.regular },
  groceryQtySep: { width: StyleSheet.hairlineWidth, height: 18 },
  groceryQtyInput: { width: 40, fontSize: 14, ...font.regular, textAlign: 'center' },
  groceryAddBtn: { minWidth: 44, minHeight: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  groceryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, minHeight: 44 },
  groceryAddError: { fontSize: 12, ...font.regular, marginTop: 4 },
  groceryDraftHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 2 },
  groceryDraftTitle: { fontSize: 12, ...font.bold, color: '#E0B24D', textTransform: 'uppercase', letterSpacing: 0.5 },
  groceryDraftApproveBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  groceryDraftApproveBtnDisabled: { opacity: 0.4 },
  grocerySharedLabel: { fontSize: 12, ...font.bold, textTransform: 'uppercase', letterSpacing: 0.5, paddingTop: 10, paddingBottom: 2 },
  widgetSwipeCheck: { backgroundColor: '#22c55e', justifyContent: 'center', alignItems: 'center', width: 48, borderRadius: 10, marginRight: 4 },
  widgetSwipeUncheck: { backgroundColor: '#94a3b8' },
  widgetSwipeDelete: { backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center', width: 48, borderRadius: 10, marginLeft: 4 },
  groceryItemText: { flex: 1, fontSize: 14, ...font.regular },
  groceryItemDone: { textDecorationLine: 'line-through' },
  groceryQty: { fontSize: 12, ...font.regular },

  // ── Votes widget
  voteQuestion: { fontSize: 14, ...font.semibold, lineHeight: 20 },
  voteBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  voteBarLabel: { width: 28, fontSize: 12, ...font.medium },
  voteTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  voteBar: { height: 8, borderRadius: 4 },
  voteCount: { width: 20, fontSize: 12, ...font.bold, textAlign: 'right' },

  // ── Activity feed
  activityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth },
  activityIconWrap: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 1 },
  activityContent: { flex: 1, gap: 2 },
  activityActor: { fontSize: 13, ...font.semibold },
  activityText: { fontSize: 13, ...font.regular, lineHeight: 18 },
  activityTime: { fontSize: 11, ...font.regular },

  // ── Floating chat bubble
  chatBubble: { position: 'absolute', bottom: 20, right: 16, width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', boxShadow: '0 4px 16px rgba(79,120,182,0.4)' } as never,
  chatBubbleBadge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#D9534F', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 2 },
  chatBubbleBadgeText: { color: '#fff', fontSize: 10, ...font.bold },

  bottomPad: { height: 40 },

  // ── Mini Calendar
  calHeader: { gap: 6 },
  calTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  calNavRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  calNavBtn: { width: 26, height: 26, justifyContent: 'center', alignItems: 'center', borderRadius: 13 },
  calMonthLabel: { flex: 1, fontSize: 12, ...font.semibold, textAlign: 'center' },
  calWeekRow: { flexDirection: 'row', marginTop: 4, marginBottom: 2 },
  calWeekDay: { flex: 1, textAlign: 'center', fontSize: 9, ...font.bold, letterSpacing: 0.3, paddingVertical: 2 },
  calGrid: { gap: 0 },
  calRow: { flexDirection: 'row' },
  calDayCell: { flex: 1, alignItems: 'stretch', paddingVertical: 1, paddingHorizontal: 1, minHeight: 40 },
  calDayInner: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 1 },
  calDayNum: { fontSize: 11, ...font.medium },
  calEventChip: { borderRadius: 2, paddingHorizontal: 2, paddingVertical: 1, marginTop: 0 },
  calEventChipText: { fontSize: 7, ...font.semibold, color: '#fff', lineHeight: 10 },
  calMoreText: { fontSize: 7, ...font.regular, paddingHorizontal: 2 },
  calLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  calLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  calLegendDot: { width: 6, height: 6, borderRadius: 3 },
  calLegendLabel: { fontSize: 10, ...font.regular },
});
