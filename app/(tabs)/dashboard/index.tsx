import { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { useBillsStore, calculateBalances } from '@stores/billsStore';
import { useParkingStore } from '@stores/parkingStore';
import { useGroceryStore } from '@stores/groceryStore';
import { useChoresStore } from '@stores/choresStore';
import { useMaintenanceStore } from '@stores/maintenanceStore';
import { useVotingStore } from '@stores/votingStore';
import { useConditionStore } from '@stores/conditionStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useEventsStore, type HouseEvent } from '@stores/eventsStore';
import { useAnnouncementsStore, type Announcement } from '@stores/announcementsStore';
import { MiniCalendar, type CalendarEvent } from '@components/shared/MiniCalendar';
import { DateInput } from '@components/shared/DateInput';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

// ── Feature color palette — each feature has its own identity ─────────────────
const FEATURE_COLORS = {
  bills:       { bg: '#FFF0F0', accent: '#FF4757', dark: '#CC1C2D' },
  parking:     { bg: '#F0F7FF', accent: '#1E90FF', dark: '#0060CC' },
  grocery:     { bg: '#F0FFF4', accent: '#2ED573', dark: '#18A84A' },
  chores:      { bg: '#FFF8F0', accent: '#FF8C00', dark: '#CC6E00' },
  maintenance: { bg: '#FFF0FA', accent: '#FF6B9D', dark: '#CC3A6B' },
  voting:      { bg: '#F3F0FF', accent: '#7C4DFF', dark: '#5225CC' },
  condition:   { bg: '#F0FFFD', accent: '#00BCD4', dark: '#008BA3' },
} as const;

type FeatureKey = keyof typeof FEATURE_COLORS;

// ── Helpers ───────────────────────────────────────────────────────────────────

function greetingText(name: string, t: (k: string) => string): string {
  const h = new Date().getHours();
  const salute = h < 12 ? t('dashboard.greeting_morning') : h < 18 ? t('dashboard.greeting_afternoon') : t('dashboard.greeting_evening');
  return `${salute}, ${name} 👋`;
}

function formatSubtitleDate(): string {
  return new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatSelectedDay(dateStr: string, t: (k: string) => string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (date.getTime() === today.getTime()) return t('common.today');
  if (date.getTime() === tomorrow.getTime()) return t('common.tomorrow');
  return date.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatEventBadge(dateStr: string, t: (k: string) => string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (date.getTime() === today.getTime()) return t('common.today');
  if (date.getTime() === tomorrow.getTime()) return t('common.tomorrow');
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function timeAgo(iso: string, t: (k: string, opts?: Record<string, unknown>) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('common.just_now');
  if (mins < 60) return t('common.minutes_ago', { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('common.hours_ago', { n: hours });
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function parkingAge(startTime: string): string {
  const diff = Date.now() - new Date(startTime).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `For ${h}h ${m > 0 ? `${m}m` : ''}`.trimEnd();
  if (m > 0) return `For ${m} min`;
  return 'Just claimed';
}

// ── FeatureCard — the new card design ────────────────────────────────────────

interface FeatureCardProps {
  featureKey: FeatureKey;
  icon: string;
  label: string;
  value: string;
  sub: string;
  badge?: string;
  onPress: () => void;
}

function FeatureCard({ featureKey, icon, label, value, sub, badge, onPress }: FeatureCardProps): React.JSX.Element {
  const theme = FEATURE_COLORS[featureKey];
  return (
    <Pressable
      style={styles.featureCard}
      onPress={onPress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
    >
      {/* Colored top band */}
      <View style={[styles.featureBand, { backgroundColor: theme.bg }]}>
        {/* Icon circle */}
        <View style={[styles.featureIconCircle, { backgroundColor: theme.accent }]}>
          <Text style={styles.featureIconEmoji}>{icon}</Text>
        </View>
        {/* Action badge — only renders when there's something to act on */}
        {badge != null && badge.length > 0 ? (
          <View style={[styles.featureBadge, { backgroundColor: theme.accent + '22' }]}>
            <Text style={[styles.featureBadgeText, { color: theme.dark }]}>{badge}</Text>
          </View>
        ) : null}
      </View>

      {/* Content below the band */}
      <View style={styles.featureBody}>
        <Text style={styles.featureLabel}>{label}</Text>
        <Text style={[styles.featureValue, { color: theme.dark }]}>{value}</Text>
        <Text style={styles.featureSub} numberOfLines={1}>{sub}</Text>
      </View>
    </Pressable>
  );
}

// ── EventRow ─────────────────────────────────────────────────────────────────

function EventRow({ event, onRemove }: { event: HouseEvent; onRemove: (id: string) => void }): React.JSX.Element {
  const { t } = useTranslation();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isPast = new Date(event.date + 'T00:00:00') < today;
  return (
    <View style={[styles.eventRow, isPast && styles.eventRowPast]}>
      <View style={[styles.eventDateBadge, isPast && styles.eventDateBadgePast]}>
        <Text style={[styles.eventDateText, isPast && styles.eventDateTextPast]}>
          {formatEventBadge(event.date, t)}
        </Text>
      </View>
      <View style={styles.eventInfo}>
        <Text style={[styles.eventTitle, isPast && styles.eventTitlePast]}>{event.title}</Text>
        <Text style={styles.eventBy}>{t('common.by')} {event.createdBy}</Text>
      </View>
      <Pressable onPress={() => onRemove(event.id)} style={styles.removeBtn}>
        <Text style={styles.removeBtnText}>✕</Text>
      </Pressable>
    </View>
  );
}

// ── NoteBubble ────────────────────────────────────────────────────────────────

function NoteBubble({ item, myName, onDelete }: { item: Announcement; myName: string; onDelete: (id: string) => void }): React.JSX.Element {
  const { t } = useTranslation();
  const isMine = item.author === myName;
  return (
    <View style={[styles.noteBubble, isMine && styles.noteBubbleMine]}>
      {!isMine && <Text style={styles.noteAuthor}>{item.author}</Text>}
      <Text style={styles.noteText}>{item.text}</Text>
      <View style={styles.noteMeta}>
        <Text style={styles.noteTime}>{timeAgo(item.createdAt, t)}</Text>
        {isMine && (
          <Pressable onPress={() => onDelete(item.id)}>
            <Text style={styles.noteDelete}>{t('dashboard.delete')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function DashboardScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const bills = useBillsStore((state) => state.bills);
  const current = useParkingStore((state) => state.current);
  const reservations = useParkingStore((state) => state.reservations);
  const groceryItems = useGroceryStore((state) => state.items);
  const chores = useChoresStore((state) => state.chores);
  const requests = useMaintenanceStore((state) => state.requests);
  const proposals = useVotingStore((state) => state.proposals);
  const conditionEntries = useConditionStore((state) => state.entries);
  const features = useSettingsStore((s) => s.features);
  const dashboardWidgets = useSettingsStore((s) => s.dashboardWidgets);
  const toggleDashboardWidget = useSettingsStore((s) => s.toggleDashboardWidget);

  const isDashboardWidget = useCallback(
    (key: string): boolean => {
      const enabled = features.find((f) => f.key === key)?.enabled ?? false;
      return enabled && dashboardWidgets.includes(key);
    },
    [features, dashboardWidgets]
  );

  const events = useEventsStore((state) => state.events);
  const addEvent = useEventsStore((state) => state.addEvent);
  const removeEvent = useEventsStore((state) => state.removeEvent);
  const notes = useAnnouncementsStore((state) => state.items);
  const postNote = useAnnouncementsStore((state) => state.post);
  const removeNote = useAnnouncementsStore((state) => state.remove);

  const [editingDashboard, setEditingDashboard] = useState(false);
  const [eventError, setEventError] = useState('');

  const myName = profile?.name ?? '';
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [eventTitle, setEventTitle] = useState('');
  const [note, setNote] = useState('');

  // ── Bills ──────────────────────────────────────────────────────────────────
  const balances = calculateBalances(bills.filter((b) => !b.settled), myName);
  const totalOwed = balances.filter((b) => b.amount > 0).reduce((s, b) => s + b.amount, 0);
  const totalOwe = balances.filter((b) => b.amount < 0).reduce((s, b) => s + Math.abs(b.amount), 0);
  const billValue = totalOwed > 0 ? `+₪${totalOwed.toFixed(0)}` : totalOwe > 0 ? `-₪${totalOwe.toFixed(0)}` : '₪0';
  const topBalance = [...balances].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))[0];
  const billSub = topBalance
    ? topBalance.amount > 0
      ? `${topBalance.person} owes ₪${topBalance.amount.toFixed(0)}`
      : `Owe ${topBalance.person} ₪${Math.abs(topBalance.amount).toFixed(0)}`
    : t('dashboard.all_settled');
  const billBadge = totalOwe > 0 ? `Owe ₪${totalOwe.toFixed(0)}` : totalOwed > 0 ? `Owed ₪${totalOwed.toFixed(0)}` : '';

  // ── Parking ────────────────────────────────────────────────────────────────
  const isFree = !current;
  const parkingValue = isFree ? t('parking.spot_free') : t('parking.taken_by', { name: current.occupant });
  const parkingSub = isFree ? t('dashboard.spot_available') : `${current.occupant} · ${parkingAge(current.startTime)}`;
  const pendingRes = reservations.filter((r) => r.status === 'pending').length;
  const parkingBadge = pendingRes > 0 ? `${pendingRes} pending` : '';

  // ── Grocery ────────────────────────────────────────────────────────────────
  const pendingGrocery = groceryItems.filter((i) => !i.isChecked).length;
  const checkedGrocery = groceryItems.filter((i) => i.isChecked).length;
  const groceryValue = pendingGrocery > 0 ? t('dashboard.grocery_pending', { n: pendingGrocery }) : t('chores.done_section');
  const grocerySub = groceryItems.length > 0 ? t('dashboard.grocery_checked', { n: checkedGrocery }) : t('grocery.empty');
  const groceryBadge = pendingGrocery > 0 ? t('dashboard.grocery_pending', { n: pendingGrocery }) : '';

  // ── Chores ─────────────────────────────────────────────────────────────────
  const pending = chores.filter((c) => !c.isComplete);
  const done = chores.filter((c) => c.isComplete);
  const myClaimedCount = chores.filter((c) => !c.isComplete && c.claimedBy === myName).length;
  const choreValue = chores.length > 0 ? `${done.length}/${chores.length}` : '—';
  const choreSub = pending.length > 0 ? t('dashboard.chores_still_todo', { n: pending.length }) : chores.length > 0 ? t('dashboard.chores_all_done_emoji') : t('chores.no_chores');
  const choreBadge = myClaimedCount > 0 ? `You: ${myClaimedCount}` : pending.length > 0 ? t('dashboard.chores_left', { n: pending.length }) : '';

  // ── Maintenance ────────────────────────────────────────────────────────────
  const openRequests = requests.filter((r) => r.status === 'open').length;
  const inProgressRequests = requests.filter((r) => r.status === 'in_progress').length;
  const maintenanceValue = openRequests > 0 ? t('dashboard.maintenance_open', { n: openRequests }) : inProgressRequests > 0 ? t('dashboard.maintenance_in_progress') : t('dashboard.maintenance_none');
  const maintenanceSub = inProgressRequests > 0 ? t('dashboard.maintenance_in_progress') : openRequests === 0 ? t('dashboard.maintenance_none') : t('dashboard.maintenance_attention');
  const maintenanceBadge = openRequests > 0 ? t('dashboard.maintenance_open', { n: openRequests }) : '';

  // ── Voting ──────────────────────────────────────────────────────────────────
  const activeVotes = proposals.filter((p) => p.isOpen).length;
  const closedVotes = proposals.filter((p) => !p.isOpen).length;
  const votingValue = activeVotes > 0 ? `${activeVotes} active` : t('dashboard.votes_none');
  const votingSub = activeVotes > 0 ? t('dashboard.votes_waiting') : closedVotes > 0 ? t('dashboard.votes_closed_other', { count: closedVotes }) : t('dashboard.votes_none');
  const votingBadge = activeVotes > 0 ? `${activeVotes} active` : '';

  // ── Condition ───────────────────────────────────────────────────────────────
  const damageCount = conditionEntries.filter((e) => e.type === 'damage').length;
  const poorAreas = new Set(conditionEntries.filter((e) => e.condition === 'poor').map((e) => e.area)).size;
  const totalAreas = new Set(conditionEntries.map((e) => e.area)).size;
  const hasConditionIssues = damageCount > 0 || poorAreas > 0;
  const conditionValue = totalAreas === 0 ? t('dashboard.condition_no_records') : hasConditionIssues ? (damageCount > 0 ? t('dashboard.condition_issues_other', { count: damageCount }) : t('dashboard.condition_issues_other', { count: poorAreas })) : t('dashboard.condition_all_good');
  const conditionSub = totalAreas > 0 ? t('dashboard.condition_areas_other', { count: totalAreas }) : t('condition.no_records_hint').split('.')[0];
  const conditionBadge = damageCount > 0 ? `${damageCount} damage` : poorAreas > 0 ? `${poorAreas} poor` : '';

  // ── Calendar & Events ──────────────────────────────────────────────────────
  const calendarEvents: CalendarEvent[] = events.map((e) => ({ date: e.date, title: e.title }));
  const selectedDayEvents = events.filter((e) => e.date === selectedDate);
  const upcomingOtherEvents = events
    .filter((e) => new Date(e.date + 'T00:00:00') >= today && e.date !== selectedDate)
    .sort((a, b) => a.date.localeCompare(b.date));
  const pastEvents = events
    .filter((e) => new Date(e.date + 'T00:00:00') < today)
    .sort((a, b) => b.date.localeCompare(a.date));

  const handleAddEvent = useCallback(async () => {
    if (!eventTitle.trim()) return;
    try {
      setEventError('');
      await addEvent(eventTitle.trim(), selectedDate || todayStr, myName || 'Someone', houseId ?? '');
      setEventTitle('');
    } catch {
      setEventError(t('dashboard.event_save_failed'));
    }
  }, [eventTitle, selectedDate, todayStr, myName, houseId, addEvent]);

  const handleRemoveEvent = useCallback((id: string) => { removeEvent(id); }, [removeEvent]);

  const handlePostNote = useCallback(async () => {
    if (!note.trim()) return;
    await postNote(note.trim(), myName || 'Someone', houseId ?? '');
    setNote('');
  }, [note, myName, houseId, postNote]);

  const handleDeleteNote = useCallback((id: string) => { removeNote(id); }, [removeNote]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* ── Hero greeting — no card, just text on grey ── */}
        <View style={styles.heroRow}>
          <View style={styles.heroText}>
            <Text style={styles.greeting}>{greetingText(myName || 'there', t)}</Text>
            <Text style={styles.greetingDate}>{formatSubtitleDate()}</Text>
          </View>
          <Pressable
            style={[styles.editBtn, editingDashboard && styles.editBtnActive]}
            onPress={() => setEditingDashboard((v) => !v)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={editingDashboard ? 'Done editing dashboard' : 'Edit dashboard'}
          >
            <Text style={[styles.editBtnText, editingDashboard && styles.editBtnTextActive]}>
              {editingDashboard ? t('dashboard.done') : `✏️ ${t('dashboard.edit')}`}
            </Text>
          </Pressable>
        </View>

        {/* ── Edit dashboard panel ── */}
        {editingDashboard && (
          <View style={styles.editPanel}>
            <Text style={styles.editPanelTitle}>{t('dashboard.customise_title')}</Text>
            <View style={styles.editChips}>
              {features.filter((f) => f.enabled).map((f) => {
                const on = isDashboardWidget(f.key);
                return (
                  <Pressable
                    key={f.key}
                    style={[styles.editChip, on && styles.editChipOn]}
                    onPress={() => toggleDashboardWidget(f.key)}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`${on ? 'Remove' : 'Add'} ${f.label} widget`}
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={styles.editChipIcon}>{f.icon}</Text>
                    <Text style={[styles.editChipLabel, on && styles.editChipLabelOn]}>{f.label}</Text>
                    <Text style={[styles.editChipCheck, on && styles.editChipCheckOn]}>{on ? '✓' : '+'}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Feature cards grid ── */}
        <View style={styles.grid}>
          {/* Bills — always shown */}
          <FeatureCard
            featureKey="bills"
            icon="💰"
            label={t('nav.bills')}
            value={billValue}
            sub={billSub}
            badge={billBadge}
            onPress={() => router.push('/(tabs)/bills')}
          />
          {isDashboardWidget('parking') && (
            <FeatureCard
              featureKey="parking"
              icon="🚗"
              label={t('nav.parking')}
              value={parkingValue}
              sub={parkingSub}
              badge={parkingBadge}
              onPress={() => router.push('/(tabs)/parking')}
            />
          )}
          {isDashboardWidget('grocery') && (
            <FeatureCard
              featureKey="grocery"
              icon="🛒"
              label={t('nav.grocery')}
              value={groceryValue}
              sub={grocerySub}
              badge={groceryBadge}
              onPress={() => router.push('/(tabs)/grocery')}
            />
          )}
          {isDashboardWidget('chores') && (
            <FeatureCard
              featureKey="chores"
              icon="🧹"
              label={t('nav.chores')}
              value={choreValue}
              sub={choreSub}
              badge={choreBadge}
              onPress={() => router.push('/(tabs)/chores')}
            />
          )}
          {isDashboardWidget('maintenance') && (
            <FeatureCard
              featureKey="maintenance"
              icon="🔧"
              label={t('nav.maintenance')}
              value={maintenanceValue}
              sub={maintenanceSub}
              badge={maintenanceBadge}
              onPress={() => router.push('/(tabs)/maintenance')}
            />
          )}
          {isDashboardWidget('voting') && (
            <FeatureCard
              featureKey="voting"
              icon="🗳️"
              label={t('nav.votes')}
              value={votingValue}
              sub={votingSub}
              badge={votingBadge}
              onPress={() => router.push('/(tabs)/voting')}
            />
          )}
          {isDashboardWidget('condition') && (
            <FeatureCard
              featureKey="condition"
              icon="🏠"
              label={t('nav.condition')}
              value={conditionValue}
              sub={conditionSub}
              badge={conditionBadge}
              onPress={() => router.push('/(tabs)/condition')}
            />
          )}
        </View>

        {/* ── Calendar ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('dashboard.calendar_widget')}</Text>
        </View>

        <MiniCalendar
          events={calendarEvents}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />

        {/* ── Events for selected day ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{formatSelectedDay(selectedDate, t)}</Text>
        </View>

        {/* Add event form */}
        <View style={styles.addEventForm}>
          <TextInput
            style={styles.eventTitleInput}
            placeholder={t('dashboard.add_event_placeholder')}
            placeholderTextColor={colors.textDisabled}
            value={eventTitle}
            onChangeText={setEventTitle}
            returnKeyType="done"
            onSubmitEditing={handleAddEvent}
          />
          <View style={styles.addEventRow}>
            <DateInput
              value={selectedDate}
              onChange={setSelectedDate}
              style={styles.addEventDateInput}
            />
            <Pressable
              style={[styles.addEventBtn, !eventTitle.trim() && styles.addEventBtnDisabled]}
              onPress={handleAddEvent}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Add event"
              accessibilityState={{ disabled: !eventTitle.trim() }}
            >
              <Text style={styles.addEventBtnText}>{t('common.add')}</Text>
            </Pressable>
          </View>
        </View>

        {!!eventError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{eventError}</Text>
          </View>
        )}

        {selectedDayEvents.length > 0 ? (
          <View style={styles.eventList}>
            {selectedDayEvents.map((e) => (
              <EventRow key={e.id} event={e} onRemove={handleRemoveEvent} />
            ))}
          </View>
        ) : (
          <View style={styles.emptySection}>
            <Text style={styles.emptyText}>{t('dashboard.no_events')}</Text>
          </View>
        )}

        {/* Upcoming on other days */}
        {upcomingOtherEvents.length > 0 && (
          <>
            <Text style={styles.subSectionLabel}>Other upcoming</Text>
            <View style={styles.eventList}>
              {upcomingOtherEvents.map((e) => (
                <EventRow key={e.id} event={e} onRemove={handleRemoveEvent} />
              ))}
            </View>
          </>
        )}

        {/* Past events */}
        {pastEvents.length > 0 && (
          <>
            <Text style={styles.subSectionLabel}>Past</Text>
            <View style={styles.eventList}>
              {pastEvents.map((e) => (
                <EventRow key={e.id} event={e} onRemove={handleRemoveEvent} />
              ))}
            </View>
          </>
        )}

        {/* ── House notes ── */}
        <View style={[styles.sectionHeader, { marginTop: sizes.lg }]}>
          <Text style={styles.sectionTitle}>{t('dashboard.announcements_title')}</Text>
          <Pressable onPress={() => router.push('/(tabs)/more/chat')}>
            <Text style={styles.chatLink}>Open chat ›</Text>
          </Pressable>
        </View>

        <View style={styles.noteInputRow}>
          <TextInput
            style={styles.noteInput}
            placeholder={t('dashboard.announce_placeholder')}
            placeholderTextColor={colors.textDisabled}
            value={note}
            onChangeText={setNote}
            returnKeyType="send"
            onSubmitEditing={handlePostNote}
          />
          <Pressable
            style={[styles.postBtn, !note.trim() && styles.postBtnDisabled]}
            onPress={handlePostNote}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Post note"
            accessibilityState={{ disabled: !note.trim() }}
          >
            <Text style={styles.postBtnText}>{t('common.send')}</Text>
          </Pressable>
        </View>

        {notes.length === 0 ? (
          <View style={styles.emptySection}>
            <Text style={styles.emptyText}>{t('dashboard.no_announcements')}</Text>
          </View>
        ) : (
          <View style={styles.notesFeed}>
            {notes.slice(0, 8).map((item) => (
              <NoteBubble key={item.id} item={item} myName={myName} onDelete={handleDeleteNote} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: sizes.lg, paddingBottom: 60 },

  // Hero greeting
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: sizes.lg,
  },
  heroText: { flex: 1, paddingRight: sizes.sm },
  greeting: {
    fontSize: 26,
    ...font.extrabold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  greetingDate: {
    fontSize: 14,
    ...font.medium,
    color: colors.textSecondary,
    marginTop: 3,
  },

  // Edit button
  editBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: sizes.borderRadiusFull,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    marginTop: 4,
  },
  editBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
  editBtnText: {
    fontSize: 11,
    ...font.semibold,
    color: colors.textSecondary,
  },
  editBtnTextActive: { color: colors.primary },

  // Edit panel
  editPanel: {
    backgroundColor: colors.white,
    borderRadius: sizes.borderRadius,
    padding: sizes.md,
    marginBottom: sizes.lg,
    gap: sizes.sm,
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  } as never,
  editPanelTitle: {
    fontSize: sizes.fontSm,
    ...font.medium,
    color: colors.textSecondary,
  },
  editChips: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.xs },
  editChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: sizes.sm,
    paddingVertical: 7,
    borderRadius: sizes.borderRadiusFull,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  } as never,
  editChipOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  editChipIcon: { fontSize: 14 },
  editChipLabel: {
    fontSize: sizes.fontSm,
    ...font.semibold,
    color: colors.textSecondary,
  },
  editChipLabelOn: { color: colors.white },
  editChipCheck: {
    fontSize: 12,
    ...font.bold,
    color: colors.textDisabled,
  },
  editChipCheckOn: { color: colors.white },

  // Feature card grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sizes.sm,
    marginBottom: sizes.lg,
  },

  // Individual feature card
  featureCard: {
    width: '47.5%',
    backgroundColor: colors.white,
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  } as never,

  // Top colored band (56px tall)
  featureBand: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },

  // Icon circle inside band
  featureIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIconEmoji: {
    fontSize: 18,
    color: colors.white,
    lineHeight: 22,
  },

  // Badge inside band (top right)
  featureBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: sizes.borderRadiusFull,
  },
  featureBadgeText: {
    fontSize: 10,
    ...font.bold,
    letterSpacing: 0.2,
  },

  // Content area below band
  featureBody: {
    padding: 12,
    paddingTop: 10,
    gap: 2,
  },
  featureLabel: {
    fontSize: 11,
    ...font.semibold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 1,
  },
  featureValue: {
    fontSize: 22,
    ...font.bold,
    fontVariant: ['tabular-nums'],
  } as never,
  featureSub: {
    fontSize: 13,
    ...font.regular,
    color: colors.textSecondary,
  },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sizes.sm,
  },
  sectionTitle: {
    fontSize: 17,
    ...font.bold,
    color: colors.textPrimary,
  },
  subSectionLabel: {
    fontSize: sizes.fontXs,
    ...font.semibold,
    color: colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: sizes.md,
    marginBottom: sizes.sm,
  },
  chatLink: {
    color: colors.primary,
    fontSize: sizes.fontSm,
    ...font.semibold,
  },

  // Add event form
  addEventForm: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: sizes.md,
    marginBottom: sizes.sm,
    gap: sizes.sm,
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  } as never,
  eventTitleInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: sizes.md,
    paddingVertical: 12,
    fontSize: sizes.fontSm,
    ...font.regular,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addEventRow: { flexDirection: 'row', gap: sizes.sm, alignItems: 'center' },
  addEventDateInput: { flex: 1 },
  addEventBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: sizes.md,
    paddingVertical: 11,
    borderRadius: 10,
  },
  addEventBtnDisabled: { backgroundColor: colors.border },
  addEventBtnText: {
    color: colors.white,
    ...font.semibold,
    fontSize: sizes.fontSm,
  },

  // Events list
  eventList: { gap: sizes.xs, marginBottom: sizes.sm },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: sizes.sm,
    gap: sizes.sm,
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  } as never,
  eventRowPast: { opacity: 0.45 },
  eventDateBadge: {
    backgroundColor: colors.primary + '18',
    paddingHorizontal: sizes.sm,
    paddingVertical: 4,
    borderRadius: sizes.borderRadiusSm,
    minWidth: 76,
    alignItems: 'center',
  },
  eventDateBadgePast: { backgroundColor: colors.border },
  eventDateText: {
    color: colors.primary,
    fontSize: sizes.fontXs,
    ...font.bold,
  },
  eventDateTextPast: { color: colors.textSecondary },
  eventInfo: { flex: 1 },
  eventTitle: {
    color: colors.textPrimary,
    ...font.semibold,
    fontSize: sizes.fontSm,
  },
  eventTitlePast: { textDecorationLine: 'line-through', color: colors.textSecondary },
  eventBy: {
    color: colors.textSecondary,
    fontSize: 11,
    ...font.regular,
  },
  removeBtn: { padding: 4 },
  removeBtnText: { color: colors.textSecondary, fontSize: sizes.fontSm },

  // House notes
  noteInputRow: { flexDirection: 'row', gap: sizes.sm, marginBottom: sizes.sm },
  noteInput: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: sizes.borderRadius,
    paddingHorizontal: sizes.md,
    paddingVertical: sizes.sm,
    fontSize: sizes.fontSm,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  postBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: sizes.md,
    borderRadius: sizes.borderRadius,
    justifyContent: 'center',
  },
  postBtnDisabled: { backgroundColor: colors.textDisabled },
  postBtnText: {
    color: colors.white,
    ...font.bold,
    fontSize: sizes.fontSm,
  },
  notesFeed: { gap: sizes.xs },
  noteBubble: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.border,
  },
  noteBubbleMine: { borderLeftColor: colors.primary },
  noteAuthor: {
    color: colors.primary,
    fontSize: 12,
    ...font.semibold,
    marginBottom: 2,
  },
  noteText: {
    color: colors.textPrimary,
    fontSize: 14,
    ...font.regular,
  },
  noteMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  noteTime: {
    color: colors.textTertiary,
    fontSize: 11,
    ...font.regular,
  },
  noteDelete: {
    color: colors.danger,
    fontSize: 11,
    ...font.regular,
  },

  // Empty states
  emptySection: { alignItems: 'center', paddingVertical: sizes.sm, marginBottom: sizes.sm },
  emptyText: { color: colors.textDisabled, fontSize: sizes.fontSm },

  // Error
  errorBox: { backgroundColor: colors.danger + '12', borderRadius: 10, padding: sizes.sm, marginBottom: sizes.sm },
  errorText: { color: colors.danger, fontSize: sizes.fontSm, ...font.regular },
});
