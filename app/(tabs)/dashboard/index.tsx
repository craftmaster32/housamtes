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
import { colors } from '@constants/colors';
import { font } from '@constants/typography';

// ── Design tokens ─────────────────────────────────────────────────────────────
const SURFACE = 'rgba(251,248,245,0.98)';
const CARD_SHADOW = '0 4px 20px rgba(44,51,61,0.06)';

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

// ── Widget Card wrapper ───────────────────────────────────────────────────────
function WidgetCard({ children, style, onPress }: {
  children: React.ReactNode;
  style?: object;
  onPress?: () => void;
}): React.JSX.Element {
  if (onPress) {
    return (
      <Pressable style={[styles.card, style]} onPress={onPress} accessibilityRole="button">
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

// ── Balance Card ──────────────────────────────────────────────────────────────
function BalanceCard(): React.JSX.Element {
  const currency = useSettingsStore((s) => s.currency);
  const bills = useBillsStore((s) => s.bills);
  const profile = useAuthStore((s) => s.profile);
  const lastSeen = useBadgeStore((s) => s.lastSeen);
  const housemates = useHousematesStore((s) => s.housemates);
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
  const newBills = countNewSimple(bills.filter((b) => !b.settled), lastSeen.bills);

  return (
    <WidgetCard onPress={() => router.push('/(tabs)/bills')}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconWrap, { backgroundColor: '#FFF0F0' }]}>
          <Ionicons name="card-outline" size={18} color="#FF4757" />
        </View>
        <Text style={styles.cardTitle}>Balances</Text>
        {newBills > 0
          ? <View style={styles.cardBadge}><Text style={styles.cardBadgeText}>{newBills}</Text></View>
          : <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        }
      </View>
      <Text style={[styles.bigNumber, { color: netAmount >= 0 ? colors.positive : colors.negative }]}>
        {netAmount >= 0 ? '+' : ''}{currency}{Math.abs(netAmount).toFixed(2)}
      </Text>
      {netAmount > 0 && (
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>You are owed</Text>
        </View>
      )}
      {netAmount < 0 && (
        <View style={[styles.statusPill, { backgroundColor: colors.negative + '20' }]}>
          <Text style={[styles.statusPillText, { color: colors.negative }]}>You owe</Text>
        </View>
      )}
      {balances.slice(0, 2).map((b) => (
        <View key={b.person} style={styles.balanceRow}>
          <View style={[styles.personDot, { backgroundColor: b.amount > 0 ? colors.positive : colors.negative }]} />
          <Text style={styles.balancePerson} numberOfLines={1}>{resolveName(b.person, housemates)}</Text>
          <Text style={[styles.balanceAmt, { color: b.amount > 0 ? colors.positive : colors.negative }]}>
            {b.amount > 0 ? '+' : ''}{currency}{b.amount.toFixed(2)}
          </Text>
        </View>
      ))}
      {balances.length === 0 && (
        <Text style={styles.cardMuted}>All settled up</Text>
      )}
    </WidgetCard>
  );
}

// ── Chore Card ────────────────────────────────────────────────────────────────
function ChoreCard(): React.JSX.Element {
  const chores = useChoresStore((s) => s.chores);
  const toggleChore = useChoresStore((s) => s.toggleChore);
  const profile = useAuthStore((s) => s.profile);
  const lastSeen = useBadgeStore((s) => s.lastSeen);
  const myId = profile?.id ?? '';
  const myChore = chores.find((c) => !c.isComplete && c.claimedBy === myId);
  const pending = chores.filter((c) => !c.isComplete);
  const done = chores.filter((c) => c.isComplete);
  const newChores = countNewSimple(pending, lastSeen.chores);

  return (
    <WidgetCard onPress={() => router.push('/(tabs)/chores')}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconWrap, { backgroundColor: '#FFF8F0' }]}>
          <Ionicons name="checkmark-done-outline" size={18} color="#FF8C00" />
        </View>
        <Text style={styles.cardTitle}>Your Chore</Text>
        {newChores > 0
          ? <View style={styles.cardBadge}><Text style={styles.cardBadgeText}>{newChores}</Text></View>
          : chores.length > 0
          ? <View style={styles.badgePill}><Text style={styles.badgePillText}>{done.length}/{chores.length} done</Text></View>
          : null
        }
      </View>
      {myChore ? (
        <>
          <View style={styles.choreBox}>
            <Ionicons name="brush-outline" size={22} color="#FF8C00" />
            <Text style={styles.choreName} numberOfLines={2}>{myChore.name}</Text>
          </View>
          <Pressable
            style={styles.doneBtn}
            onPress={(e) => { e.stopPropagation?.(); toggleChore(myChore.id); }}
            accessibilityRole="button"
          >
            <Ionicons name="checkmark" size={14} color={colors.positive} />
            <Text style={styles.doneBtnText}>Mark as Done</Text>
          </Pressable>
        </>
      ) : pending.length > 0 ? (
        <>
          <Text style={styles.bigNumber} numberOfLines={1}>
            {pending[0].name}
          </Text>
          <Text style={styles.cardMuted}>Not yet claimed</Text>
        </>
      ) : (
        <>
          <View style={styles.doneAllWrap}>
            <Ionicons name="checkmark-circle" size={32} color={colors.positive} />
          </View>
          <Text style={styles.cardMuted}>All chores done!</Text>
        </>
      )}
    </WidgetCard>
  );
}

// ── Parking Card ──────────────────────────────────────────────────────────────
function ParkingCard(): React.JSX.Element {
  const current = useParkingStore((s) => s.current);
  const reservations = useParkingStore((s) => s.reservations);
  const approveReservation = useParkingStore((s) => s.approveReservation);
  const claim = useParkingStore((s) => s.claim);
  const release = useParkingStore((s) => s.release);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const housemates = useHousematesStore((s) => s.housemates);
  const myId   = profile?.id ?? '';
  const myName = profile?.name ?? '';
  const isFree = !current;
  const isMine = current?.occupant === myId;

  const lastSeen = useBadgeStore((s) => s.lastSeen);
  const sortedReservations = [...reservations].sort((a, b) => a.date.localeCompare(b.date));
  // Pending requests from others — these need approval
  const pendingFromOthers = sortedReservations.filter((r) => r.status === 'pending' && r.requestedBy !== myId);
  // My own reservations (any status)
  const myReservation = sortedReservations.find((r) => r.requestedBy === myId) ?? null;
  const pendingCount = reservations.filter((r) => r.status === 'pending').length;
  const newReservations = countNew(reservations as unknown as Array<{ createdAt: string; [k: string]: unknown }>, lastSeen.parking, myId, 'requestedBy');

  const handleClaim = useCallback(async (): Promise<void> => {
    await claim(myId, myName, houseId ?? '').catch(() => {});
  }, [claim, myId, myName, houseId]);

  const handleRelease = useCallback(async (): Promise<void> => {
    await release(houseId ?? '').catch(() => {});
  }, [release, houseId]);

  const handleApprove = useCallback(async (id: string): Promise<void> => {
    await approveReservation(id, houseId ?? '').catch(() => {});
  }, [approveReservation, houseId]);

  return (
    <WidgetCard onPress={() => router.push('/(tabs)/parking')}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconWrap, { backgroundColor: isFree ? '#F0FFF4' : '#FFF0F0' }]}>
          <Ionicons name={isFree ? 'car-outline' : 'car'} size={18} color={isFree ? colors.positive : colors.negative} />
        </View>
        <Text style={styles.cardTitle}>Parking Spot</Text>
        {newReservations > 0
          ? <View style={styles.cardBadge}><Text style={styles.cardBadgeText}>{newReservations}</Text></View>
          : pendingCount > 0
          ? <View style={[styles.badgePill, { backgroundColor: '#FFF3CD' }]}><Text style={[styles.badgePillText, { color: '#856404' }]}>{pendingCount} pending</Text></View>
          : <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        }
      </View>
      <View style={[styles.parkingStatus, { backgroundColor: isFree ? colors.positive + '14' : colors.negative + '14' }]}>
        <Text style={[styles.parkingStatusText, { color: isFree ? colors.positive : colors.negative }]}>
          {isFree ? 'Available now' : isMine ? 'Your car' : resolveName(current?.occupant ?? '', housemates)}
        </Text>
        {current && !isFree && (
          <Text style={styles.parkingAge}>{parkingAge(current.startTime)}</Text>
        )}
      </View>
      <Text style={styles.cardMuted}>
        {isFree
          ? 'No one is using the spot'
          : isMine
          ? `In use for ${parkingAge(current!.startTime)}`
          : `Used by ${resolveName(current!.occupant, housemates)} · ${parkingAge(current!.startTime)}`}
      </Text>
      {/* Pending requests from others — show approve button */}
      {pendingFromOthers.map((r) => (
        <View key={r.id} style={styles.parkingPendingRow}>
          <View style={styles.parkingPendingInfo}>
            <Ionicons name="time-outline" size={14} color="#856404" />
            <Text style={styles.parkingPendingText}>
              {resolveName(r.requestedBy, housemates)} wants {r.date}{r.startTime ? ` at ${r.startTime}` : ''}
            </Text>
          </View>
          <Pressable
            style={styles.approveBtn}
            onPress={(e) => { e.stopPropagation?.(); handleApprove(r.id); }}
            accessibilityRole="button"
            accessibilityLabel={`Approve parking request from ${resolveName(r.requestedBy, housemates)}`}
          >
            <Text style={styles.approveBtnText}>Approve</Text>
          </Pressable>
        </View>
      ))}
      {/* My own reservation status */}
      {myReservation && pendingFromOthers.length === 0 && (
        <View style={[styles.parkingReservationRow, { backgroundColor: myReservation.status === 'approved' ? colors.positive + '14' : '#FFF3CD' }]}>
          <Ionicons
            name={myReservation.status === 'approved' ? 'checkmark-circle-outline' : 'time-outline'}
            size={14}
            color={myReservation.status === 'approved' ? colors.positive : '#856404'}
          />
          <Text style={[styles.parkingReservationText, { color: myReservation.status === 'approved' ? colors.positive : '#856404' }]}>
            {myReservation.status === 'approved' ? 'Your spot confirmed' : 'Your request pending'}
            {' · '}{myReservation.date}{myReservation.startTime ? ` at ${myReservation.startTime}` : ''}
          </Text>
        </View>
      )}
      {isFree && (
        <Pressable
          style={styles.claimBtn}
          onPress={(e) => { e.stopPropagation?.(); handleClaim(); }}
          accessibilityRole="button"
          accessibilityLabel="Claim parking spot"
        >
          <Ionicons name="car" size={14} color="#fff" />
          <Text style={styles.claimBtnText}>Claim Spot</Text>
        </Pressable>
      )}
      {isMine && (
        <Pressable
          style={styles.releaseBtn}
          onPress={(e) => { e.stopPropagation?.(); handleRelease(); }}
          accessibilityRole="button"
          accessibilityLabel="Release parking spot"
        >
          <Ionicons name="exit-outline" size={14} color={colors.negative} />
          <Text style={styles.releaseBtnText}>Release Spot</Text>
        </Pressable>
      )}
    </WidgetCard>
  );
}

// ── Grocery Widget ────────────────────────────────────────────────────────────
// ── Grocery widget row (needs its own ref for Swipeable) ─────────────────────
interface GroceryWidgetRowProps {
  item: GroceryItem;
  myId: string;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

function GroceryWidgetRow({ item, myId, onToggle, onDelete }: GroceryWidgetRowProps): React.JSX.Element {
  const swipeRef = useRef<Swipeable>(null);
  const canDelete = item.addedBy === myId;

  const handleToggle = useCallback((): void => {
    swipeRef.current?.close();
    onToggle(item.id);
  }, [item.id, onToggle]);

  const handleDelete = useCallback((): void => {
    swipeRef.current?.close();
    onDelete(item.id);
  }, [item.id, onDelete]);

  const renderCheckAction = useCallback((): React.JSX.Element => (
    <Pressable
      accessible
      style={[styles.widgetSwipeCheck, item.isChecked && styles.widgetSwipeUncheck]}
      onPress={handleToggle}
      accessibilityRole="button"
      accessibilityLabel={item.isChecked ? 'Mark as needed' : 'Mark as done'}
    >
      <Ionicons name={item.isChecked ? 'arrow-undo-outline' : 'checkmark'} size={16} color="#fff" />
    </Pressable>
  ), [item.isChecked, handleToggle]);

  const renderDeleteAction = useCallback((): React.JSX.Element => (
    <Pressable
      accessible
      style={styles.widgetSwipeDelete}
      onPress={handleDelete}
      accessibilityRole="button"
      accessibilityLabel="Delete item"
    >
      <Ionicons name="trash-outline" size={16} color="#fff" />
    </Pressable>
  ), [handleDelete]);

  return (
    <Swipeable
      ref={swipeRef}
      renderLeftActions={renderCheckAction}
      renderRightActions={canDelete ? renderDeleteAction : undefined}
      overshootLeft={false}
      overshootRight={false}
      friction={2}
    >
      <Pressable
        style={styles.groceryRow}
        onPress={handleToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.isChecked }}
      >
        <Ionicons
          name={item.isChecked ? 'checkmark-circle' : 'ellipse-outline'}
          size={18}
          color={item.isChecked ? colors.positive : colors.border}
        />
        <Text style={[styles.groceryItemText, item.isChecked && styles.groceryItemDone]}>
          {item.name}
        </Text>
        {item.quantity && item.quantity !== '1' && (
          <Text style={styles.groceryQty}>×{item.quantity}</Text>
        )}
      </Pressable>
    </Swipeable>
  );
}

function GroceryWidget(): React.JSX.Element {
  const items             = useGroceryStore((s) => s.items);
  const addItem           = useGroceryStore((s) => s.addItem);
  const toggleItem        = useGroceryStore((s) => s.toggleItem);
  const deleteItem        = useGroceryStore((s) => s.deleteItem);
  const publishDraftItems = useGroceryStore((s) => s.publishDraftItems);
  const profile   = useAuthStore((s) => s.profile);
  const houseId   = useAuthStore((s) => s.houseId);
  const lastSeen  = useBadgeStore((s) => s.lastSeen);
  const myId      = profile?.id ?? '';

  const [input, setInput]         = useState('');
  const [qty, setQty]             = useState('');
  const [addError, setAddError]   = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const myDraftItems = useMemo(
    () => items.filter((i) => i.isDraft && i.addedBy === myId && !i.isChecked),
    [items, myId]
  );
  const sharedPending = useMemo(
    () => items.filter((i) => !i.isPersonal && !i.isChecked).slice(0, 5),
    [items]
  );
  const totalShared = useMemo(
    () => items.filter((i) => !i.isPersonal && !i.isChecked).length,
    [items]
  );

  const newGrocery = countNew(
    items.filter((i) => !i.isChecked) as unknown as Array<{ createdAt: string; [k: string]: unknown }>,
    lastSeen.grocery,
    myId,
    'addedBy'
  );

  const handleAdd = useCallback(async (): Promise<void> => {
    const n = input.trim();
    if (!n) return;
    try {
      await addItem(n, qty.trim(), myId, houseId ?? '', 'draft');
      setInput('');
      setQty('');
      setAddError(null);
    } catch (err) {
      setAddError('Could not add item. Try again.');
      console.warn('[GroceryWidget] addItem failed', err);
    }
  }, [input, qty, addItem, myId, houseId]);

  const handlePublish = useCallback(async (): Promise<void> => {
    if (isPublishing || !myId) return;
    setIsPublishing(true);
    try {
      await publishDraftItems(myId);
    } catch {
      setAddError('Could not share draft. Try again.');
    } finally {
      setIsPublishing(false);
    }
  }, [publishDraftItems, myId, isPublishing]);

  const handleToggle = useCallback((id: string): void => { toggleItem(id); }, [toggleItem]);
  const handleDelete = useCallback((id: string): void => {
    deleteItem(id).catch((err: unknown) => { console.warn('[GroceryWidget] deleteItem failed', err); });
  }, [deleteItem]);

  const draftHeader = myDraftItems.length > 0 ? (
    <>
      <View style={styles.groceryDraftHeader}>
        <Text style={styles.groceryDraftTitle}>📝 My Draft</Text>
        <Pressable
          onPress={handlePublish}
          disabled={isPublishing}
          style={[styles.groceryDraftApproveBtn, isPublishing && { opacity: 0.4 }]}
          accessible
          accessibilityRole="button"
          accessibilityState={{ disabled: isPublishing }}
          accessibilityLabel="Share draft with housemates"
          accessibilityHint="Adds all draft items to the shared grocery list"
        >
          {isPublishing
            ? <ActivityIndicator size="small" color="rgb(133,77,14)" />
            : <Ionicons name="checkmark-circle" size={22} color="rgb(133,77,14)" />
          }
        </Pressable>
      </View>
      {myDraftItems.map((item) => (
        <GroceryWidgetRow key={item.id} item={item} myId={myId} onToggle={handleToggle} onDelete={handleDelete} />
      ))}
      {sharedPending.length > 0 && (
        <Text style={styles.grocerySharedLabel}>🏠 Shared</Text>
      )}
    </>
  ) : null;

  return (
    <WidgetCard>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconWrap, { backgroundColor: '#F0FFF4' }]}>
          <Ionicons name="cart-outline" size={18} color="#2ED573" />
        </View>
        <Text style={styles.cardTitle}>Shared Groceries</Text>
        {newGrocery > 0
          ? <View style={styles.cardBadge}><Text style={styles.cardBadgeText}>{newGrocery}</Text></View>
          : <Pressable onPress={() => router.push('/(tabs)/grocery')} accessibilityRole="button"><Text style={styles.viewAll}>View all</Text></Pressable>
        }
      </View>

      <View style={styles.groceryInputRow}>
        <Ionicons name="add" size={16} color={colors.textSecondary} />
        <TextInput
          style={styles.groceryInput}
          value={input}
          onChangeText={(t) => { setInput(t); if (addError) setAddError(null); }}
          placeholder="Add an item..."
          placeholderTextColor={colors.textSecondary}
          returnKeyType="next"
          onSubmitEditing={handleAdd}
          accessibilityLabel="Grocery item name"
          accessibilityHint="Type the name of the item and press enter to add it"
        />
        <View style={styles.groceryQtySep} />
        <TextInput
          style={styles.groceryQtyInput}
          value={qty}
          onChangeText={setQty}
          placeholder="Qty"
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
          returnKeyType="done"
          onSubmitEditing={handleAdd}
          accessibilityLabel="Quantity"
          accessibilityHint="Enter the quantity for this item"
        />
        {input.trim().length > 0 && (
          <Pressable
            accessible
            onPress={handleAdd}
            style={styles.groceryAddBtn}
            accessibilityRole="button"
            accessibilityLabel="Add item"
            accessibilityState={{ disabled: false }}
          >
            <Ionicons name="return-down-back-outline" size={15} color="#fff" />
          </Pressable>
        )}
      </View>
      {!!addError && <Text style={styles.groceryAddError}>{addError}</Text>}

      <FlatList
        data={sharedPending}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <GroceryWidgetRow item={item} myId={myId} onToggle={handleToggle} onDelete={handleDelete} />
        )}
        ListHeaderComponent={draftHeader}
        ListEmptyComponent={myDraftItems.length === 0 ? <Text style={styles.cardMuted}>List is empty — add something above</Text> : null}
        scrollEnabled={false}
        nestedScrollEnabled
      />

      {totalShared > 5 && (
        <Pressable onPress={() => router.push('/(tabs)/grocery')} accessibilityRole="button">
          <Text style={styles.viewAll}>+{totalShared - 5} more items</Text>
        </Pressable>
      )}
    </WidgetCard>
  );
}

// ── Votes Widget ──────────────────────────────────────────────────────────────
function VotesWidget(): React.JSX.Element {
  const proposals = useVotingStore((s) => s.proposals);
  const profile = useAuthStore((s) => s.profile);
  const housemates = useHousematesStore((s) => s.housemates);
  const lastSeen = useBadgeStore((s) => s.lastSeen);
  const myId = profile?.id ?? '';
  const totalPeople = Math.max(1, housemates.length);
  const active = proposals.filter((p) => p.isOpen);
  const newVotes = countNew(
    active as unknown as Array<{ createdAt: string; [k: string]: unknown }>,
    lastSeen.voting,
    myId,
    'createdBy'
  );

  if (active.length === 0) {
    return (
      <WidgetCard onPress={() => router.push('/(tabs)/voting')}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconWrap, { backgroundColor: '#F3F0FF' }]}>
            <Ionicons name="hand-left-outline" size={18} color="#7C4DFF" />
          </View>
          <Text style={styles.cardTitle}>Active Votes</Text>
        </View>
        <Text style={styles.cardMuted}>No open votes right now</Text>
      </WidgetCard>
    );
  }

  const top = active[0];
  const yesCount = top.votes.filter((v) => v.choice === 'yes').length;
  const noCount  = top.votes.filter((v) => v.choice === 'no').length;
  const totalVotes = yesCount + noCount;
  const yesWidth = totalVotes > 0 ? (yesCount / totalVotes) * 100 : 0;
  const myVote = top.votes.find((v) => v.person === myId)?.choice ?? null;
  const allVoted = totalVotes >= totalPeople;

  type BadgeState = { label: string; bg: string; color: string };
  const badge: BadgeState = ((): BadgeState => {
    if (!myVote) return { label: 'Vote now', bg: colors.danger + '20', color: colors.danger };
    if (!allVoted) return { label: `Waiting (${totalVotes}/${totalPeople})`, bg: colors.textSecondary + '18', color: colors.textSecondary };
    if (yesCount > noCount) return { label: 'Passed', bg: colors.positive + '20', color: colors.positive };
    return { label: 'Rejected', bg: colors.negative + '20', color: colors.negative };
  })();

  return (
    <WidgetCard onPress={() => router.push('/(tabs)/voting')}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconWrap, { backgroundColor: '#F3F0FF' }]}>
          <Ionicons name="hand-left-outline" size={18} color="#7C4DFF" />
        </View>
        <Text style={styles.cardTitle}>Active Votes</Text>
        {newVotes > 0
          ? <View style={styles.cardBadge}><Text style={styles.cardBadgeText}>{newVotes}</Text></View>
          : <View style={[styles.badgePill, { backgroundColor: badge.bg }]}>
              <Text style={[styles.badgePillText, { color: badge.color }]}>{badge.label}</Text>
            </View>
        }
      </View>
      <Text style={styles.voteQuestion} numberOfLines={2}>{top.title}</Text>
      <View style={styles.voteBarRow}>
        <Text style={styles.voteBarLabel}>Yes</Text>
        <View style={styles.voteTrack}>
          <View style={[styles.voteBar, { width: `${yesWidth}%` as `${number}%`, backgroundColor: '#7C4DFF' }]} />
        </View>
        <Text style={styles.voteCount}>{yesCount}</Text>
      </View>
      <View style={styles.voteBarRow}>
        <Text style={styles.voteBarLabel}>No</Text>
        <View style={styles.voteTrack}>
          <View style={[styles.voteBar, { width: `${100 - yesWidth}%` as `${number}%`, backgroundColor: colors.border }]} />
        </View>
        <Text style={styles.voteCount}>{noCount}</Text>
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
  const events            = useEventsStore((s) => s.events);
  const reservations      = useParkingStore((s) => s.reservations);
  const recurringBills    = useRecurringBillsStore((s) => s.bills);
  const recurringPayments = useRecurringBillsStore((s) => s.payments);
  const chores            = useChoresStore((s) => s.chores);

  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Map date → [{title, color}] for event chip labels
  const eventMap = useMemo((): Record<string, Array<{ title: string; color: string }>> => {
    const map: Record<string, Array<{ title: string; color: string }>> = {};
    const push = (date: string, title: string, color: string): void => {
      if (!date) return;
      if (!map[date]) map[date] = [];
      map[date].push({ title, color });
    };
    const billNameById = new Map(recurringBills.map((b) => [b.id, b.name]));
    events.forEach((e) => push(e.date, e.title, '#6366f1'));
    reservations.forEach((r) => push(r.date, `Parking`, '#f59e0b'));
    recurringPayments.forEach((p) => push(p.paidAt, billNameById.get(p.billId) ?? 'Recurring', '#ef4444'));
    chores.forEach((c) => { if (c.recurrence === 'once' && c.recurrenceDay) push(c.recurrenceDay, c.name, '#22c55e'); });
    return map;
  }, [events, reservations, recurringPayments, recurringBills, chores]);

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
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }, [viewMonth]);

  const nextMonth = useCallback((): void => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }, [viewMonth]);

  const todayStr = toYMD(today);

  return (
    <WidgetCard>
      {/* Header — title navigates to calendar page */}
      <View style={styles.calHeader}>
        <Pressable
          style={styles.calTitleRow}
          onPress={() => router.push('/(tabs)/calendar')}
          accessibilityRole="button"
          accessibilityLabel="Open calendar"
        >
          <View style={[styles.cardIconWrap, { backgroundColor: '#F3F0FF' }]}>
            <Ionicons name="calendar-outline" size={18} color="#6366f1" />
          </View>
          <Text style={styles.cardTitle}>Calendar</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </Pressable>
        <View style={styles.calNavRow}>
          <Pressable onPress={prevMonth} style={styles.calNavBtn} accessibilityRole="button">
            <Ionicons name="chevron-back" size={15} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.calMonthLabel}>
            {CAL_MONTHS[viewMonth].slice(0, 3)} {viewYear}
          </Text>
          <Pressable onPress={nextMonth} style={styles.calNavBtn} accessibilityRole="button">
            <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Weekday row */}
      <View style={styles.calWeekRow}>
        {CAL_DAYS.map((d, i) => (
          <Text key={i} style={styles.calWeekDay}>{d}</Text>
        ))}
      </View>

      {/* Day grid — 5 explicit rows, each cell shows event chips */}
      <View style={styles.calGrid}>
        {[0, 1, 2, 3, 4].map((row) => (
          <View key={row} style={styles.calRow}>
            {grid.slice(row * 7, row * 7 + 7).map((day, idx) => {
              const ymd = toYMD(day);
              const isToday = ymd === todayStr;
              const isCurrentMonth = day.getMonth() === viewMonth;
              const dayEvents = eventMap[ymd] ?? [];
              return (
                <Pressable
                  key={idx}
                  style={styles.calDayCell}
                  onPress={() => router.push('/(tabs)/calendar')}
                  accessibilityRole="button"
                >
                  <View style={[styles.calDayInner, isToday && styles.calDayToday]}>
                    <Text style={[
                      styles.calDayNum,
                      !isCurrentMonth && styles.calDayFaint,
                      isToday && styles.calDayTodayNum,
                    ]}>
                      {day.getDate()}
                    </Text>
                  </View>
                  {/* Event chip — show first event as colored label */}
                  {dayEvents[0] && (
                    <View style={[styles.calEventChip, { backgroundColor: dayEvents[0].color }]}>
                      <Text style={styles.calEventChipText} numberOfLines={1}>
                        {dayEvents[0].title}
                      </Text>
                    </View>
                  )}
                  {dayEvents.length > 1 && (
                    <Text style={styles.calMoreText}>+{dayEvents.length - 1}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {/* Legend */}
      <View style={styles.calLegend}>
        {([['#6366f1','Events'],['#ef4444','Recurring'],['#22c55e','Chores'],['#f59e0b','Parking']] as [string,string][]).map(([c, label]) => (
          <View key={label} style={styles.calLegendItem}>
            <View style={[styles.calLegendDot, { backgroundColor: c }]} />
            <Text style={styles.calLegendLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </WidgetCard>
  );
}

// ── Activity feed (real household events) ─────────────────────────────────────

interface ActivityEvent {
  id: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  actor: string;
  text: string;
  time: string;
}

function buildActivityEvents(
  bills: Bill[],
  groceryItems: GroceryItem[],
  chores: Chore[],
  myId: string,
  housemates: Housemate[]
): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;

  bills
    .filter((b) => new Date(b.createdAt).getTime() > cutoff)
    .forEach((b) => {
      events.push({
        id: `bill-${b.id}`,
        icon: 'card-outline',
        iconColor: '#FF4757',
        iconBg: '#FFF0F0',
        actor: b.paidBy === myId ? 'You' : resolveName(b.paidBy, housemates),
        text: `added a bill — ${b.title}`,
        time: b.createdAt,
      });
    });

  groceryItems
    .filter((i) => new Date(i.createdAt).getTime() > cutoff)
    .forEach((i) => {
      events.push({
        id: `grocery-${i.id}`,
        icon: 'cart-outline',
        iconColor: '#2ED573',
        iconBg: '#F0FFF4',
        actor: i.addedBy === myId ? 'You' : resolveName(i.addedBy, housemates),
        text: `added "${i.name}" to the grocery list`,
        time: i.createdAt,
      });
    });

  chores
    .filter((c) => c.isComplete && c.completedAt && new Date(c.completedAt).getTime() > cutoff)
    .forEach((c) => {
      events.push({
        id: `chore-${c.id}`,
        icon: 'checkmark-done-outline',
        iconColor: '#FF8C00',
        iconBg: '#FFF8F0',
        actor: !c.claimedBy ? 'Someone' : c.claimedBy === myId ? 'You' : resolveName(c.claimedBy, housemates),
        text: `completed "${c.name}"`,
        time: c.completedAt!,
      });
    });

  return events
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 8);
}

function ActivityEventItem({ event }: { event: ActivityEvent }): React.JSX.Element {
  return (
    <View style={styles.activityRow}>
      <View style={[styles.activityIconWrap, { backgroundColor: event.iconBg }]}>
        <Ionicons name={event.icon as never} size={14} color={event.iconColor} />
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityText} numberOfLines={2}>
          <Text style={styles.activityActor}>{event.actor} </Text>
          {event.text}
        </Text>
        <Text style={styles.activityTime}>{timeAgo(event.time)}</Text>
      </View>
    </View>
  );
}

function ActivityFeed(): React.JSX.Element {
  const bills = useBillsStore((s) => s.bills);
  const groceryItems = useGroceryStore((s) => s.items);
  const chores = useChoresStore((s) => s.chores);
  const profile = useAuthStore((s) => s.profile);
  const housemates = useHousematesStore((s) => s.housemates);
  const myId = profile?.id ?? '';

  const events = useMemo(
    () => buildActivityEvents(bills, groceryItems, chores, myId, housemates),
    [bills, groceryItems, chores, myId, housemates]
  );

  return (
    <WidgetCard>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconWrap, { backgroundColor: '#F0F7FF' }]}>
          <Ionicons name="pulse-outline" size={18} color={colors.primary} />
        </View>
        <Text style={styles.cardTitle}>Recent Activity</Text>
      </View>

      {events.length === 0 ? (
        <Text style={styles.cardMuted}>No activity in the last 7 days</Text>
      ) : (
        events.map((event) => (
          <ActivityEventItem key={event.id} event={event} />
        ))
      )}
    </WidgetCard>
  );
}

// ── Floating Chat Bubble ──────────────────────────────────────────────────────

function FloatingChatBubble(): React.JSX.Element {
  const unreadCount = useChatStore((s) => s.unreadCount);

  return (
    <Pressable
      style={styles.chatBubble}
      onPress={() => router.push('/(tabs)/more/chat')}
      accessibilityRole="button"
      accessibilityLabel={`House chat${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
    >
      <Ionicons name="chatbubble-ellipses" size={22} color="#fff" />
      {unreadCount > 0 && (
        <View style={styles.chatBubbleBadge}>
          <Text style={styles.chatBubbleBadgeText}>{unreadCount > 9 ? '9+' : String(unreadCount)}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function DashboardScreen(): React.JSX.Element {
  const profile = useAuthStore((s) => s.profile);
  const houseName = useHousematesStore((s) => s.houseName);
  const { width } = useWindowDimensions();

  const isWide = width >= 680;
  const myName = profile?.name ?? 'there';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={[styles.scroll, isWide && styles.scrollWide]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Hero greeting ─────────────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={styles.heroText}>
            <Text style={styles.greeting}>{greetingText(myName)}</Text>
            <Text style={styles.greetingSub}>
              Here&apos;s what&apos;s happening
              {houseName ? ` in ${houseName}` : ''} today.
            </Text>
          </View>
          <Pressable
            style={styles.newExpenseBtn}
            onPress={() => router.push('/(tabs)/bills/add')}
            accessibilityRole="button"
          >
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.newExpenseBtnText}>New Expense</Text>
          </Pressable>
        </View>

        {/* ── Top row: Balances · Chore · Parking ──────────────────── */}
        <View style={[styles.row, isWide && styles.rowWide]}>
          <View style={isWide ? styles.colThird : styles.colFull}>
            <BalanceCard />
          </View>
          <View style={isWide ? styles.colThird : styles.colFull}>
            <ChoreCard />
          </View>
          <View style={isWide ? styles.colThird : styles.colFull}>
            <ParkingCard />
          </View>
        </View>

        {/* ── Middle row: Grocery · Votes ───────────────────────────── */}
        <View style={[styles.row, isWide && styles.rowWide]}>
          <View style={isWide ? styles.colHalf : styles.colFull}>
            <GroceryWidget />
          </View>
          <View style={isWide ? styles.colHalf : styles.colFull}>
            <VotesWidget />
          </View>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  scrollWide: { paddingHorizontal: 24 },

  // ── Hero
  hero: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingVertical: 16, gap: 12,
  },
  heroText: { flex: 1, gap: 4 },
  greeting: { fontSize: 24, ...font.extrabold, color: colors.textPrimary, letterSpacing: -0.6 },
  greetingSub: { fontSize: 14, ...font.regular, color: colors.textSecondary, lineHeight: 20 },
  newExpenseBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 10, flexShrink: 0,
    boxShadow: '0 4px 12px rgba(79,120,182,0.22)',
  } as never,
  newExpenseBtnText: { fontSize: 13, ...font.semibold, color: '#fff' },

  // ── Grid
  row: { flexDirection: 'column', gap: 12, marginBottom: 12 },
  rowWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  colFull: {},
  colHalf: { flex: 1 },
  colThird: { flex: 1 },

  // ── Card
  card: {
    backgroundColor: SURFACE,
    borderRadius: 18, borderWidth: 1, borderColor: colors.border,
    padding: 16, gap: 10,
    boxShadow: CARD_SHADOW,
  } as never,
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardIconWrap: {
    width: 32, height: 32, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  cardTitle: { fontSize: 15, ...font.semibold, color: colors.textPrimary, flex: 1 },
  cardMuted: { fontSize: 13, ...font.regular, color: colors.textSecondary, lineHeight: 18 },
  cardBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.danger,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
  },
  cardBadgeText: { color: colors.white, fontSize: 11, ...font.bold },
  bigNumber: { fontSize: 30, ...font.extrabold, color: colors.textPrimary, letterSpacing: -1 },
  viewAll: { fontSize: 13, ...font.semibold, color: colors.primary },

  // Status / badges
  statusPill: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 9999, backgroundColor: colors.positive + '20',
  },
  statusPillText: { fontSize: 12, ...font.semibold, color: colors.positive },
  badgePill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999,
    backgroundColor: colors.secondary,
  },
  badgePillText: { fontSize: 11, ...font.bold, color: colors.secondaryForeground },

  // ── Balance card
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  personDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  balancePerson: { flex: 1, fontSize: 14, ...font.medium, color: colors.textPrimary },
  balanceAmt: { fontSize: 14, ...font.bold },

  // ── Chore card
  choreBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFF8F0', borderRadius: 10, padding: 12,
  },
  choreName: { flex: 1, fontSize: 15, ...font.semibold, color: colors.textPrimary },
  doneBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.positive + '18',
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 9,
  },
  doneBtnText: { fontSize: 13, ...font.semibold, color: colors.positive },
  doneAllWrap: { alignItems: 'center', paddingVertical: 8 },

  // ── Parking card
  parkingStatus: {
    borderRadius: 10, padding: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  parkingStatusText: { fontSize: 15, ...font.bold },
  parkingAge: { fontSize: 12, ...font.regular, color: colors.textSecondary },
  parkingReservationRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginTop: 8,
  },
  parkingReservationText: { fontSize: 13, ...font.semibold, flex: 1 },
  parkingPendingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFF3CD', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, marginTop: 8, gap: 8,
  },
  parkingPendingInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  parkingPendingText: { fontSize: 13, ...font.medium, color: '#856404', flex: 1 },
  approveBtn: {
    backgroundColor: colors.positive, borderRadius: 7,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  approveBtnText: { fontSize: 12, ...font.bold, color: '#fff' },
  claimBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.positive, borderRadius: 9,
    paddingVertical: 10, paddingHorizontal: 14,
    boxShadow: '0 4px 12px rgba(34,197,94,0.22)',
  } as never,
  claimBtnText: { fontSize: 13, ...font.semibold, color: '#fff' },
  releaseBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.negative + '12',
    borderWidth: 1, borderColor: colors.negative + '40',
    borderRadius: 9,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  releaseBtnText: { fontSize: 13, ...font.semibold, color: colors.negative },

  // ── Grocery widget
  groceryInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surfaceSecondary, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  groceryInput: {
    flex: 1, fontSize: 14, ...font.regular, color: colors.textPrimary,
  },
  groceryQtySep: {
    width: StyleSheet.hairlineWidth, height: 18, backgroundColor: colors.border,
  },
  groceryQtyInput: {
    width: 40, fontSize: 14, ...font.regular, color: colors.textPrimary, textAlign: 'center',
  },
  groceryAddBtn: {
    minWidth: 44, minHeight: 44, borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  groceryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, minHeight: 44, backgroundColor: colors.surface },
  groceryAddError: { fontSize: 12, ...font.regular, color: colors.negative, marginTop: 4 },
  groceryDraftHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 2 },
  groceryDraftTitle:  { fontSize: 12, ...font.bold, color: 'rgb(133,77,14)', textTransform: 'uppercase', letterSpacing: 0.5 },
  groceryDraftApproveBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  grocerySharedLabel: { fontSize: 12, ...font.bold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, paddingTop: 10, paddingBottom: 2 },
  widgetSwipeCheck:   { backgroundColor: '#22c55e', justifyContent: 'center', alignItems: 'center', width: 48, borderRadius: 10, marginRight: 4 },
  widgetSwipeUncheck: { backgroundColor: '#94a3b8' },
  widgetSwipeDelete:  { backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center', width: 48, borderRadius: 10, marginLeft: 4 },
  groceryItemText: { flex: 1, fontSize: 14, ...font.regular, color: colors.textPrimary },
  groceryItemDone: { textDecorationLine: 'line-through', color: colors.textSecondary },
  groceryQty: { fontSize: 12, ...font.regular, color: colors.textSecondary },

  // ── Votes widget
  voteQuestion: { fontSize: 14, ...font.semibold, color: colors.textPrimary, lineHeight: 20 },
  voteBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  voteBarLabel: { width: 28, fontSize: 12, ...font.medium, color: colors.textSecondary },
  voteTrack: { flex: 1, height: 8, backgroundColor: colors.surfaceSecondary, borderRadius: 4, overflow: 'hidden' },
  voteBar: { height: 8, borderRadius: 4 },
  voteCount: { width: 20, fontSize: 12, ...font.bold, color: colors.textPrimary, textAlign: 'right' },

  flex: { flex: 1 },

  // ── Activity feed
  activityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  activityIconWrap: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 1 },
  activityContent: { flex: 1, gap: 2 },
  activityActor: { fontSize: 13, ...font.semibold, color: colors.textPrimary },
  activityText: { fontSize: 13, ...font.regular, color: colors.textPrimary, lineHeight: 18 },
  activityTime: { fontSize: 11, ...font.regular, color: colors.textSecondary },

  // ── Floating chat bubble
  chatBubble: {
    position: 'absolute', bottom: 20, right: 16,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    boxShadow: '0 4px 16px rgba(79,120,182,0.4)',
  } as never,
  chatBubbleBadge: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.danger,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2, borderColor: colors.background,
  },
  chatBubbleBadgeText: { color: '#fff', fontSize: 10, ...font.bold },

  bottomPad: { height: 40 },

  // ── Mini Calendar
  calHeader: { gap: 6 },
  calTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  calNavRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  calNavBtn: { width: 26, height: 26, justifyContent: 'center', alignItems: 'center', borderRadius: 13, backgroundColor: colors.surfaceSecondary },
  calMonthLabel: { flex: 1, fontSize: 12, ...font.semibold, color: colors.textPrimary, textAlign: 'center' },
  calWeekRow: { flexDirection: 'row', marginTop: 4, marginBottom: 2 },
  calWeekDay: {
    flex: 1, textAlign: 'center', fontSize: 9, ...font.bold,
    color: colors.textSecondary, letterSpacing: 0.3, paddingVertical: 2,
  },
  calGrid: { gap: 0 },
  calRow: { flexDirection: 'row' },
  calDayCell: { flex: 1, alignItems: 'stretch', paddingVertical: 1, paddingHorizontal: 1, minHeight: 40 },
  calDayInner: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 1 },
  calDayToday: { backgroundColor: colors.primary },
  calDayNum: { fontSize: 11, ...font.medium, color: colors.textPrimary },
  calDayFaint: { color: colors.textDisabled },
  calDayTodayNum: { color: colors.white, ...font.bold },
  // Event chip labels on day cells
  calEventChip: { borderRadius: 2, paddingHorizontal: 2, paddingVertical: 1, marginTop: 0 },
  calEventChipText: { fontSize: 7, ...font.semibold, color: '#fff', lineHeight: 10 },
  calMoreText: { fontSize: 7, ...font.regular, color: colors.textSecondary, paddingHorizontal: 2 },
  calLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  calLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  calLegendDot: { width: 6, height: 6, borderRadius: 3 },
  calLegendLabel: { fontSize: 10, ...font.regular, color: colors.textSecondary },
});
