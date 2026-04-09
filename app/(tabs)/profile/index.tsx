import { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert, TextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { supabase } from '@lib/supabase';
import { SpendingAnalytics } from '@components/profile/SpendingAnalytics';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

// ── Shared sub-components ──────────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }): React.JSX.Element {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function RowDivider(): React.JSX.Element {
  return <View style={styles.rowDivider} />;
}

function MenuItem({
  icon, label, sub, onPress, danger, rightText,
}: {
  icon: string; label: string; sub?: string;
  onPress: () => void; danger?: boolean; rightText?: string;
}): React.JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
      onPress={onPress}
      accessible
      accessibilityRole="button"
    >
      <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
        <Text style={styles.menuIconText}>{icon}</Text>
      </View>
      <View style={styles.menuText}>
        <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
        {sub ? <Text style={styles.menuSub}>{sub}</Text> : null}
      </View>
      {rightText
        ? <Text style={styles.menuRightText}>{rightText}</Text>
        : <Text style={styles.menuChevron}>›</Text>}
    </Pressable>
  );
}

// ── Password form ──────────────────────────────────────────────────────────────
function PasswordForm({ onDone }: { onDone: () => void }): React.JSX.Element {
  const { t } = useTranslation();
  const [newPw, setNewPw]       = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);

  const save = useCallback(async () => {
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
        placeholder={t('profile.password_hint')} placeholderTextColor={colors.textDisabled} secureTextEntry autoCapitalize="none" />
      <TextInput style={styles.textInput} value={confirm} onChangeText={(v) => { setConfirm(v); setError(''); }}
        placeholder={t('profile.repeat_password')} placeholderTextColor={colors.textDisabled} secureTextEntry autoCapitalize="none" />
      {!!error && <Text style={styles.fieldError}>{error}</Text>}
      <View style={styles.pwBtns}>
        <Pressable style={[styles.saveBtn, saving && styles.saveBtnOff]} onPress={save} disabled={saving} accessibilityRole="button">
          <Text style={styles.saveBtnText}>{saving ? t('profile.saving') : t('profile.save_password')}</Text>
        </Pressable>
        <Pressable onPress={onDone}><Text style={styles.cancelText}>{t('common.cancel')}</Text></Pressable>
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
  const inviteCode = useHousematesStore((s) => s.inviteCode);
  const houseName  = useHousematesStore((s) => s.houseName);

  const [showPwForm, setShowPwForm] = useState(false);

  const initial = (profile?.name ?? '?')[0].toUpperCase();
  const isOwnerOrAdmin = role === 'owner' || role === 'admin';

  const handleLogout = useCallback(() => {
    Alert.alert(t('profile.sign_out'), t('profile.sign_out_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.sign_out'), style: 'destructive', onPress: async () => {
        await signOut();
        router.replace('/(auth)/welcome');
      }},
    ]);
  }, [signOut, t]);

  const handleCopyCode = useCallback(() => {
    Alert.alert(t('profile.invite_code'), `${t('profile.share_code')}\n\n${inviteCode}`, [{ text: t('common.ok') }]);
  }, [inviteCode, t]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Profile header ──────────────────────────────────────────── */}
        <View style={styles.profileHeader}>
          <View style={[styles.avatarLarge, { backgroundColor: profile?.avatarColor ?? colors.primary }]}>
            <Text style={styles.avatarLargeText}>{initial}</Text>
          </View>
          <Text style={styles.profileName}>{profile?.name ?? 'You'}</Text>
          {!!user?.email && <Text style={styles.profileEmail}>{user.email}</Text>}
          <View style={styles.pillRow}>
            {!!houseName && (
              <View style={styles.housePill}>
                <Text style={styles.housePillText}>🏠 {houseName}</Text>
              </View>
            )}
            {role && (
              <View style={[styles.rolePill, role === 'owner' && styles.rolePillOwner, role === 'admin' && styles.rolePillAdmin]}>
                <Text style={[styles.rolePillText, (role === 'owner' || role === 'admin') && styles.rolePillTextElevated]}>
                  {role === 'owner' ? '👑 Owner' : role === 'admin' ? '🛡 Admin' : '· Member'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Spending analytics ──────────────────────────────────────── */}
        {houseId && profile?.name && (
          <>
            <SectionLabel label="My Spending" />
            <SpendingAnalytics houseId={houseId} userName={profile.name} />
          </>
        )}

        {/* ── House ───────────────────────────────────────────────────── */}
        <SectionLabel label={t('profile.house_section')} />
        <View style={styles.menuGroup}>
          <MenuItem
            icon="👥"
            label={t('profile.housemates')}
            sub={housemates.length > 0 ? housemates.map((h) => h.name).join(', ') : t('profile.no_housemates')}
            onPress={() => router.push('/(tabs)/bills/setup')}
          />
          {!!inviteCode && (
            <>
              <RowDivider />
              <MenuItem icon="🎟️" label={t('profile.invite_code')} sub={t('profile.invite_code_sub')}
                rightText={inviteCode} onPress={handleCopyCode} />
            </>
          )}
        </View>

        {/* ── Owner tools ─────────────────────────────────────────────── */}
        {isOwnerOrAdmin && (
          <>
            <SectionLabel label="House Management" />
            <View style={styles.menuGroup}>
              <MenuItem icon="🏷️" label="Expense Categories"
                sub="Add or edit the categories used for tracking spending"
                onPress={() => router.push('/(tabs)/settings/categories')} />
              <RowDivider />
              <MenuItem icon="👁️" label="Member Permissions"
                sub="Control what each housemate can see in the app"
                onPress={() => router.push('/(tabs)/settings/members')} />
            </View>
          </>
        )}

        {/* ── Account ─────────────────────────────────────────────────── */}
        <SectionLabel label={t('profile.account_section')} />
        <View style={styles.menuGroup}>
          <MenuItem icon="🔑" label={t('profile.change_password')}
            sub={showPwForm ? t('profile.password_prompt') : t('profile.change_password_sub')}
            onPress={() => { setShowPwForm((v) => !v); }} />
          {showPwForm && (
            <>
              <RowDivider />
              <PasswordForm onDone={() => setShowPwForm(false)} />
            </>
          )}
          <RowDivider />
          <MenuItem icon="⚙️" label={t('profile.settings')} sub={t('profile.settings_sub')}
            onPress={() => router.push('/(tabs)/more/settings')} />
        </View>

        {/* ── Sign out ────────────────────────────────────────────────── */}
        <View style={styles.menuGroup}>
          <MenuItem icon="🚪" label={t('profile.sign_out')} sub={t('profile.sign_out_sub')}
            onPress={handleLogout} danger />
        </View>

        <Text style={styles.version}>{t('profile.footer')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll:    { padding: sizes.lg, paddingBottom: 60, gap: 0 },

  profileHeader: { alignItems: 'center', paddingVertical: sizes.xl, gap: sizes.xs, marginBottom: sizes.lg },
  avatarLarge: {
    width: 96, height: 96, borderRadius: 48,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: sizes.sm, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
  } as never,
  avatarLargeText: { color: colors.white, fontSize: 40, ...font.bold },
  profileName:  { fontSize: 24, ...font.extrabold, color: colors.textPrimary, letterSpacing: -0.5 },
  profileEmail: { fontSize: 14, ...font.regular, color: colors.textSecondary },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 },
  housePill: {
    backgroundColor: colors.primary + '15', paddingHorizontal: sizes.md,
    paddingVertical: 4, borderRadius: sizes.borderRadiusFull,
  },
  housePillText: { fontSize: 13, ...font.semibold, color: colors.primary },
  rolePill: {
    paddingHorizontal: sizes.sm, paddingVertical: 4,
    borderRadius: sizes.borderRadiusFull, backgroundColor: colors.surfaceSecondary,
  },
  rolePillOwner: { backgroundColor: '#FEF3C7' },
  rolePillAdmin: { backgroundColor: '#EDE9FE' },
  rolePillText:  { fontSize: 12, ...font.semibold, color: colors.textSecondary },
  rolePillTextElevated: { color: colors.textPrimary },

  sectionLabel: {
    color: colors.textSecondary, fontSize: 11, ...font.bold,
    letterSpacing: 1.2, marginBottom: sizes.sm, marginTop: sizes.md, marginLeft: 4,
  },

  menuGroup: {
    backgroundColor: colors.white, borderRadius: sizes.borderRadiusLg,
    marginBottom: sizes.sm, overflow: 'hidden',
  },
  menuItem:        { flexDirection: 'row', alignItems: 'center', padding: sizes.md, gap: sizes.sm },
  menuItemPressed: { backgroundColor: colors.background },
  menuIcon:        { width: 36, height: 36, borderRadius: sizes.borderRadiusSm, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  menuIconDanger:  { backgroundColor: colors.negative + '15' },
  menuIconText:    { fontSize: 18 },
  menuText:        { flex: 1 },
  menuLabel:       { color: colors.textPrimary, ...font.semibold, fontSize: 15 },
  menuLabelDanger: { color: colors.negative },
  menuSub:         { color: colors.textSecondary, fontSize: 13, ...font.regular, marginTop: 1 },
  menuChevron:     { color: colors.textDisabled, fontSize: 22 },
  menuRightText:   { color: colors.primary, ...font.bold, fontSize: 15 },
  rowDivider:      { height: 1, backgroundColor: colors.border, marginLeft: sizes.md + 36 + sizes.sm },

  pwForm:  { padding: sizes.md, paddingTop: 0, gap: sizes.sm, borderTopWidth: 1, borderTopColor: colors.border },
  textInput: {
    backgroundColor: colors.background, borderRadius: 10, paddingHorizontal: sizes.md,
    paddingVertical: 12, fontSize: 15, ...font.regular, color: colors.textPrimary,
    borderWidth: 1, borderColor: colors.border,
  },
  fieldError: { color: colors.danger, fontSize: 13, ...font.regular },
  pwBtns:  { flexDirection: 'row', alignItems: 'center', gap: sizes.md, marginTop: sizes.xs },
  saveBtn: { backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: sizes.lg, borderRadius: 10 },
  saveBtnOff:  { opacity: 0.6 },
  saveBtnText: { color: colors.white, ...font.semibold, fontSize: 14 },
  cancelText:  { color: colors.textSecondary, fontSize: 14, ...font.regular },

  version: { color: colors.textDisabled, fontSize: 13, ...font.regular, textAlign: 'center', marginTop: sizes.lg },
});
