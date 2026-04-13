import { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert, TextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useBillsStore } from '@stores/billsStore';
import { useSpendingStore, CATEGORY_META } from '@stores/spendingStore';
import { supabase } from '@lib/supabase';
import { SpendingAnalytics } from '@components/profile/SpendingAnalytics';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import type { Bill } from '@stores/billsStore';
import type { Housemate } from '@stores/housematesStore';

// ── Date helpers ───────────────────────────────────────────────────────────────
function isSameDay(d: Date, ref: Date): boolean {
  return d.getFullYear() === ref.getFullYear()
    && d.getMonth() === ref.getMonth()
    && d.getDate() === ref.getDate();
}
function billDayLabel(dateStr: string): 'today' | 'yesterday' | 'older' {
  const d = new Date(dateStr);
  const now = new Date();
  if (isSameDay(d, now)) return 'today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(d, yesterday)) return 'yesterday';
  return 'older';
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function QuickAction({
  icon, label, onPress,
}: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }): React.JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [styles.quickCard, pressed && styles.quickCardPressed]}
      onPress={onPress}
      accessible
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

function ProfileRow({
  iconName, title, sub, onPress,
}: {
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  title: string; sub: string; onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [styles.profileRow, pressed && styles.profileRowPressed]}
      onPress={onPress}
      accessible
      accessibilityRole="button"
    >
      <View style={styles.profileRowIcon}>
        <Ionicons name={iconName} size={18} color={colors.primary} />
      </View>
      <View style={styles.profileRowText}>
        <Text style={styles.profileRowTitle}>{title}</Text>
        <Text style={styles.profileRowSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

function HousemateAvatars({ housemates }: { housemates: Housemate[] }): React.JSX.Element {
  const shown = housemates.slice(0, 4);
  return (
    <View style={styles.avatarStack}>
      {shown.map((h, i) => (
        <View
          key={h.id}
          style={[styles.stackAvatar, { backgroundColor: h.color, marginLeft: i === 0 ? 0 : -10 }]}
        >
          <Text style={styles.stackAvatarText}>{h.name[0].toUpperCase()}</Text>
        </View>
      ))}
    </View>
  );
}

function ActivityItem({ bill, userName }: { bill: Bill; userName: string }): React.JSX.Element {
  const splits = bill.splitBetween.length || 1;
  const share  = bill.splitAmounts ? (bill.splitAmounts[userName] ?? bill.amount / splits) : bill.amount / splits;
  const isPayer = bill.paidBy === userName;
  const meta = CATEGORY_META[bill.category?.toLowerCase() ?? ''] ?? CATEGORY_META['other'];
  return (
    <View style={styles.activityItem}>
      <View style={[styles.activityIcon, { backgroundColor: meta.color + '20' }]}>
        <Text style={styles.activityIconText}>{meta.icon}</Text>
      </View>
      <View style={styles.activityInfo}>
        <Text style={styles.activityTitle} numberOfLines={1}>{bill.title}</Text>
        <Text style={styles.activitySub}>{isPayer ? 'Paid by you' : `Paid by ${bill.paidBy}`}</Text>
      </View>
      <View style={styles.activityAmt}>
        <Text style={styles.activityAmtText}>-£{share.toFixed(2)}</Text>
        <Text style={styles.activityAmtSub}>Your share</Text>
      </View>
    </View>
  );
}

// ── Password form ──────────────────────────────────────────────────────────────
function PasswordForm({ onDone }: { onDone: () => void }): React.JSX.Element {
  const { t } = useTranslation();
  const [newPw, setNewPw]     = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError]     = useState('');
  const [saving, setSaving]   = useState(false);

  const save = useCallback(async (): Promise<void> => {
    if (!newPw) { setError(t('profile.enter_new_password')); return; }
    if (newPw.length < 6) { setError(t('profile.password_min')); return; }
    if (newPw !== confirm) { setError(t('profile.passwords_no_match')); return; }
    setSaving(true);
    setError('');
    try {
      const { error: e } = await supabase.auth.updateUser({ password: newPw });
      if (e) throw e;
      onDone();
      Alert.alert(t('common.done'), t('profile.password_updated'));
    } catch { setError(t('profile.could_not_update')); }
    finally { setSaving(false); }
  }, [newPw, confirm, t, onDone]);

  return (
    <View style={styles.pwForm}>
      <TextInput style={styles.textInput} value={newPw} onChangeText={(v) => { setNewPw(v); setError(''); }}
        placeholder={t('profile.password_hint')} placeholderTextColor={colors.textDisabled}
        secureTextEntry autoCapitalize="none" />
      <TextInput style={styles.textInput} value={confirm} onChangeText={(v) => { setConfirm(v); setError(''); }}
        placeholder={t('profile.repeat_password')} placeholderTextColor={colors.textDisabled}
        secureTextEntry autoCapitalize="none" />
      {!!error && <Text style={styles.fieldError}>{error}</Text>}
      <View style={styles.pwBtns}>
        <Pressable style={[styles.saveBtn, saving && styles.saveBtnOff]} onPress={save} disabled={saving} accessibilityRole="button">
          <Text style={styles.saveBtnText}>{saving ? t('profile.saving') : t('profile.save_password')}</Text>
        </Pressable>
        <Pressable onPress={onDone} accessibilityRole="button">
          <Text style={styles.cancelText}>{t('common.cancel')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function ProfileScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const profile    = useAuthStore((s) => s.profile);
  const user       = useAuthStore((s) => s.user);
  const role       = useAuthStore((s) => s.role);
  const signOut    = useAuthStore((s) => s.signOut);
  const houseId    = useAuthStore((s) => s.houseId);
  const housemates = useHousematesStore((s) => s.housemates);
  const houseName  = useHousematesStore((s) => s.houseName);
  const bills      = useBillsStore((s) => s.bills);
  const loadBills  = useBillsStore((s) => s.load);
  const months     = useSpendingStore((s) => s.months);

  const [showPwForm, setShowPwForm] = useState(false);

  // Load bills for recent activity if not already loaded
  useEffect(() => {
    if (houseId && bills.length === 0) loadBills(houseId);
  }, [houseId, bills.length, loadBills]);

  const initial = (profile?.name ?? '?')[0].toUpperCase();
  const isOwnerOrAdmin = role === 'owner' || role === 'admin';

  // Top 4 expense categories from current month
  const topCategories = months[0]?.categories.slice(0, 4) ?? [];

  // Recent bills grouped as today / yesterday
  const recentBills = [...bills]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
  const todayBills     = recentBills.filter((b) => billDayLabel(b.date) === 'today');
  const yesterdayBills = recentBills.filter((b) => billDayLabel(b.date) === 'yesterday');

  const handleLogout = useCallback(() => {
    Alert.alert(t('profile.sign_out'), t('profile.sign_out_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.sign_out'), style: 'destructive', onPress: async () => {
        await signOut();
        router.replace('/(auth)/welcome');
      }},
    ]);
  }, [signOut, t]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Profile header ──────────────────────────────────────────── */}
        <View style={styles.profileHeader}>
          <View style={styles.decoCircleTL} />
          <View style={styles.decoCircleTR} />
          <View style={styles.avatarWrap}>
            <View style={[styles.avatarRing, { backgroundColor: profile?.avatarColor ?? colors.primary }]}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
            <View style={styles.avatarBadge}>
              <Ionicons name="pencil" size={12} color={colors.primary} />
            </View>
          </View>
          <Text style={styles.profileName}>{profile?.name ?? 'You'}</Text>
          <Text style={styles.profileSub}>{houseName || 'Your House'}</Text>
        </View>

        <View style={styles.content}>

          {/* ── Quick actions ──────────────────────────────────────────── */}
          <View style={styles.quickRow}>
            <QuickAction icon="card-outline" label="Payment" onPress={() => router.push('/(tabs)/bills/setup')} />
            <QuickAction icon="notifications-outline" label="Alerts" onPress={() => router.push('/(tabs)/settings/notifications')} />
            <QuickAction icon="shield-outline" label="Privacy" onPress={() => router.push('/(tabs)/settings/privacy-policy')} />
          </View>

          {/* ── Spending card ──────────────────────────────────────────── */}
          {houseId && profile?.name && (
            <SpendingAnalytics houseId={houseId} userName={profile.name} />
          )}

          {/* ── Expense summary ────────────────────────────────────────── */}
          {topCategories.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Expense summary</Text>
                <Pressable onPress={() => {}} accessibilityRole="button">
                  <Text style={styles.sectionAction}>See all</Text>
                </Pressable>
              </View>
              <View style={styles.expenseGrid}>
                {topCategories.map((cat) => (
                  <View key={cat.name} style={styles.expenseCard}>
                    <View style={styles.expenseIconWrap}>
                      <Text style={styles.expenseIcon}>{cat.icon}</Text>
                    </View>
                    <Text style={styles.expenseName}>{cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}</Text>
                    <Text style={styles.expenseAmt}>£{cat.amount.toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── House ──────────────────────────────────────────────────── */}
          <View style={styles.card}>
            <View style={styles.cardInnerRow}>
              <Text style={styles.sectionTitle}>House</Text>
              <Pressable onPress={() => router.push('/(tabs)/bills/setup')} accessibilityRole="button">
                <Text style={styles.sectionAction}>Manage</Text>
              </Pressable>
            </View>
            <View style={styles.houseRow}>
              <View style={styles.houseInfo}>
                <Text style={styles.houseName}>{houseName || 'The House'}</Text>
                <Text style={styles.houseSub}>
                  {housemates.length} housemate{housemates.length !== 1 ? 's' : ''} connected
                </Text>
              </View>
              <HousemateAvatars housemates={housemates} />
            </View>
          </View>

          {/* ── Profile settings ───────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profile</Text>
            <View style={styles.card}>
              <ProfileRow
                iconName="person-outline"
                title="Personal details"
                sub="Name, email and room info"
                onPress={() => setShowPwForm((v) => !v)}
              />
              {showPwForm && (
                <>
                  <View style={styles.rowDivider} />
                  <PasswordForm onDone={() => setShowPwForm(false)} />
                </>
              )}
              <View style={styles.rowDivider} />
              <ProfileRow
                iconName="card-outline"
                title="Payouts & refunds"
                sub="Where repayments should go"
                onPress={() => router.push('/(tabs)/bills/setup')}
              />
              <View style={styles.rowDivider} />
              <ProfileRow
                iconName="time-outline"
                title="Expense history"
                sub="Monthly statements and export"
                onPress={() => {}}
              />
              <View style={styles.rowDivider} />
              <ProfileRow
                iconName="settings-outline"
                title="App settings"
                sub="Notifications, theme and account"
                onPress={() => router.push('/(tabs)/more/settings')}
              />
            </View>
          </View>

          {/* ── Owner tools ────────────────────────────────────────────── */}
          {isOwnerOrAdmin && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>House management</Text>
              <View style={styles.card}>
                <ProfileRow
                  iconName="pricetag-outline"
                  title="Expense categories"
                  sub="Add or edit spending categories"
                  onPress={() => router.push('/(tabs)/settings/categories')}
                />
                <View style={styles.rowDivider} />
                <ProfileRow
                  iconName="people-outline"
                  title="Member permissions"
                  sub="Control what each housemate can see"
                  onPress={() => router.push('/(tabs)/settings/members')}
                />
              </View>
            </View>
          )}

          {/* ── Recent activity ────────────────────────────────────────── */}
          {(todayBills.length > 0 || yesterdayBills.length > 0) && (
            <View style={styles.card}>
              <View style={styles.cardInnerRow}>
                <Text style={styles.sectionTitle}>Recent activity</Text>
                <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
              </View>
              {todayBills.length > 0 && (
                <>
                  <Text style={styles.dayLabel}>TODAY</Text>
                  {todayBills.map((b) => (
                    <ActivityItem key={b.id} bill={b} userName={profile?.name ?? ''} />
                  ))}
                </>
              )}
              {yesterdayBills.length > 0 && (
                <>
                  <Text style={styles.dayLabel}>YESTERDAY</Text>
                  {yesterdayBills.map((b) => (
                    <ActivityItem key={b.id} bill={b} userName={profile?.name ?? ''} />
                  ))}
                </>
              )}
              <Pressable
                style={({ pressed }) => [styles.viewMoreBtn, pressed && styles.viewMoreBtnPressed]}
                onPress={() => router.push('/(tabs)/bills/index')}
                accessibilityRole="button"
              >
                <Text style={styles.viewMoreText}>View previous months</Text>
              </Pressable>
            </View>
          )}

          {/* ── Sign out ───────────────────────────────────────────────── */}
          <Pressable
            style={({ pressed }) => [styles.signOutBtn, pressed && styles.signOutBtnPressed]}
            onPress={handleLogout}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('profile.sign_out')}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.negative} />
            <Text style={styles.signOutText}>{t('profile.sign_out')}</Text>
          </Pressable>

          <Text style={styles.version}>{t('profile.footer')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll:    { paddingBottom: 80 },
  content:   { paddingHorizontal: sizes.md, gap: sizes.md, paddingBottom: sizes.lg },

  // Profile header
  profileHeader: {
    alignItems: 'center',
    paddingTop: sizes.xl,
    paddingBottom: sizes.lg,
    gap: sizes.xs,
    position: 'relative',
    overflow: 'hidden',
  },
  decoCircleTL: {
    position: 'absolute',
    top: 45,
    left: -39,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.secondary,
    opacity: 0.9,
  },
  decoCircleTR: {
    position: 'absolute',
    top: 108,
    right: 78,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.secondary,
    opacity: 0.9,
  },
  avatarWrap: { position: 'relative' },
  avatarRing: {
    width: 102,
    height: 102,
    borderRadius: 51,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  avatarInitial: { color: colors.white, fontSize: 40, ...font.bold },
  avatarBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.secondary,
    borderWidth: 2,
    borderColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileName: { fontSize: 28, ...font.extrabold, color: colors.textPrimary, letterSpacing: -0.56, marginTop: 4 },
  profileSub:  { fontSize: 15, ...font.regular, color: colors.textSecondary },

  // Quick actions
  quickRow: { flexDirection: 'row', gap: sizes.sm },
  quickCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: sizes.borderRadius,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: sizes.md + 3,
    alignItems: 'center',
    gap: sizes.sm,
  },
  quickCardPressed: { opacity: 0.75 },
  quickLabel: { fontSize: 12, ...font.bold, color: colors.textPrimary, textAlign: 'center' },

  // Section
  section: { gap: sizes.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 18, ...font.extrabold, color: colors.textPrimary },
  sectionAction: { fontSize: 13, ...font.bold, color: colors.primary },

  // Generic card
  card: {
    backgroundColor: colors.white,
    borderRadius: sizes.borderRadiusLg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: sizes.md,
    gap: sizes.sm,
  },
  cardInnerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  // Expense summary grid
  expenseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.sm },
  expenseCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.secondary,
    borderRadius: sizes.borderRadius,
    padding: sizes.md,
    gap: sizes.xs,
  },
  expenseIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expenseIcon: { fontSize: 20 },
  expenseName: { fontSize: 13, ...font.bold, color: colors.textSecondary },
  expenseAmt:  { fontSize: 18, ...font.extrabold, color: colors.textPrimary },

  // House section
  houseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  houseInfo: { gap: 2 },
  houseName: { fontSize: 15, ...font.extrabold, color: colors.textPrimary },
  houseSub:  { fontSize: 13, ...font.bold, color: colors.textSecondary },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  stackAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stackAvatarText: { color: colors.white, fontSize: 13, ...font.bold },

  // Profile row
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sizes.sm,
    paddingVertical: sizes.sm,
  },
  profileRowPressed: { opacity: 0.7 },
  profileRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileRowText: { flex: 1 },
  profileRowTitle: { fontSize: 15, ...font.extrabold, color: colors.textPrimary },
  profileRowSub:   { fontSize: 13, ...font.regular, color: colors.textSecondary },

  rowDivider: { height: 1, backgroundColor: colors.border, marginLeft: 40 + sizes.sm },

  // Activity
  dayLabel: {
    fontSize: 13,
    ...font.extrabold,
    color: colors.textSecondary,
    letterSpacing: 0.65,
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: sizes.xs,
    marginTop: sizes.xs,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sizes.sm,
    paddingVertical: sizes.sm,
  },
  activityIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityIconText: { fontSize: 20 },
  activityInfo: { flex: 1 },
  activityTitle: { fontSize: 15, ...font.extrabold, color: colors.textPrimary },
  activitySub:   { fontSize: 13, ...font.regular, color: colors.textSecondary },
  activityAmt:   { alignItems: 'flex-end' },
  activityAmtText: { fontSize: 16, ...font.extrabold, color: colors.textPrimary },
  activityAmtSub:  { fontSize: 12, ...font.regular, color: colors.textSecondary },
  viewMoreBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: sizes.md,
    alignItems: 'center',
    marginTop: sizes.xs,
  },
  viewMoreBtnPressed: { opacity: 0.7 },
  viewMoreText: { fontSize: 14, ...font.bold, color: colors.textPrimary },

  // Sign out
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sizes.sm,
    paddingVertical: sizes.md,
    borderRadius: sizes.borderRadius,
    borderWidth: 1,
    borderColor: colors.negative + '30',
    backgroundColor: colors.negative + '08',
    marginTop: sizes.sm,
  },
  signOutBtnPressed: { opacity: 0.7 },
  signOutText: { fontSize: 15, ...font.semibold, color: colors.negative },

  // Password form
  pwForm: { padding: sizes.sm, gap: sizes.sm },
  textInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: sizes.md,
    paddingVertical: 12,
    fontSize: 15,
    ...font.regular,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldError: { color: colors.danger, fontSize: 13, ...font.regular },
  pwBtns:     { flexDirection: 'row', alignItems: 'center', gap: sizes.md, marginTop: sizes.xs },
  saveBtn:    { backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: sizes.lg, borderRadius: 10 },
  saveBtnOff: { opacity: 0.6 },
  saveBtnText:  { color: colors.white, ...font.semibold, fontSize: 14 },
  cancelText:   { color: colors.textSecondary, fontSize: 14, ...font.regular },

  version: { color: colors.textDisabled, fontSize: 13, ...font.regular, textAlign: 'center', marginTop: sizes.sm },
});
