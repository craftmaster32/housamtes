import { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { supabase } from '@lib/supabase';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

function MenuItem({
  icon,
  label,
  sub,
  onPress,
  danger,
  rightText,
}: {
  icon: string;
  label: string;
  sub?: string;
  onPress: () => void;
  danger?: boolean;
  rightText?: string;
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
      {rightText ? (
        <Text style={styles.menuRightText}>{rightText}</Text>
      ) : (
        <Text style={styles.menuChevron}>›</Text>
      )}
    </Pressable>
  );
}

function SectionDivider({ label }: { label: string }): React.JSX.Element {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function RowDivider(): React.JSX.Element {
  return <View style={styles.rowDivider} />;
}

export default function ProfileScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const housemates = useHousematesStore((s) => s.housemates);
  const inviteCode = useHousematesStore((s) => s.inviteCode);
  const houseName = useHousematesStore((s) => s.houseName);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const initial = (profile?.name ?? '?')[0].toUpperCase();
  const email = user?.email ?? '';

  const handleLogout = useCallback(() => {
    Alert.alert(t('profile.sign_out'), t('profile.sign_out_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.sign_out'),
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  }, [signOut, t]);

  const handleChangePassword = useCallback(async () => {
    if (!newPassword) { setPasswordError(t('profile.enter_new_password')); return; }
    if (newPassword.length < 6) { setPasswordError(t('profile.password_min')); return; }
    if (newPassword !== confirmPassword) { setPasswordError(t('profile.passwords_no_match')); return; }
    setPasswordSaving(true);
    setPasswordError('');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      Alert.alert(t('common.done'), t('profile.password_updated'));
    } catch {
      setPasswordError(t('profile.could_not_update'));
    } finally {
      setPasswordSaving(false);
    }
  }, [newPassword, confirmPassword, t]);

  const handleCopyInviteCode = useCallback(() => {
    Alert.alert(t('profile.invite_code'), `${t('profile.share_code')}\n\n${inviteCode}`, [
      { text: t('common.ok') },
    ]);
  }, [inviteCode, t]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Profile header ── */}
        <View style={styles.profileHeader}>
          <View style={[styles.avatarLarge, { backgroundColor: profile?.avatarColor ?? colors.primary }]}>
            <Text style={styles.avatarLargeText}>{initial}</Text>
          </View>
          <Text style={styles.profileName}>{profile?.name ?? 'You'}</Text>
          {!!email && <Text style={styles.profileEmail}>{email}</Text>}
          {!!houseName && (
            <View style={styles.housePill}>
              <Text style={styles.housePillText}>🏠 {houseName}</Text>
            </View>
          )}
        </View>

        {/* ── Account ── */}
        <SectionDivider label={t('profile.account_section')} />
        <View style={styles.menuGroup}>
          <MenuItem
            icon="🔑"
            label={t('profile.change_password')}
            sub={showPasswordForm ? t('profile.password_prompt') : t('profile.change_password_sub')}
            onPress={() => { setShowPasswordForm((v) => !v); setPasswordError(''); }}
          />
          {showPasswordForm && (
            <View style={styles.passwordForm}>
              <View style={styles.passwordField}>
                <Text style={styles.fieldLabel}>{t('profile.new_password')}</Text>
                <PasswordInput
                  value={newPassword}
                  onChange={(v) => { setNewPassword(v); setPasswordError(''); }}
                  placeholder={t('profile.password_hint')}
                />
              </View>
              <View style={styles.passwordField}>
                <Text style={styles.fieldLabel}>{t('profile.confirm_password')}</Text>
                <PasswordInput
                  value={confirmPassword}
                  onChange={(v) => { setConfirmPassword(v); setPasswordError(''); }}
                  placeholder={t('profile.repeat_password')}
                />
              </View>
              {!!passwordError && <Text style={styles.fieldError}>{passwordError}</Text>}
              <View style={styles.passwordButtons}>
                <Pressable
                  style={[styles.saveBtn, passwordSaving && styles.saveBtnDisabled]}
                  onPress={handleChangePassword}
                  disabled={passwordSaving}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t('profile.save_password')}
                >
                  <Text style={styles.saveBtnText}>{passwordSaving ? t('profile.saving') : t('profile.save_password')}</Text>
                </Pressable>
                <Pressable onPress={() => { setShowPasswordForm(false); setPasswordError(''); setNewPassword(''); setConfirmPassword(''); }}>
                  <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* ── House ── */}
        <SectionDivider label={t('profile.house_section')} />
        <View style={styles.menuGroup}>
          <MenuItem
            icon="👥"
            label={t('profile.housemates')}
            sub={housemates.length > 0
              ? housemates.map((h) => h.name).join(', ')
              : t('profile.no_housemates')}
            onPress={() => router.push('/(tabs)/bills/setup')}
          />
          {!!inviteCode && (
            <>
              <RowDivider />
              <MenuItem
                icon="🎟️"
                label={t('profile.invite_code')}
                sub={t('profile.invite_code_sub')}
                rightText={inviteCode}
                onPress={handleCopyInviteCode}
              />
            </>
          )}
        </View>

        {/* ── Preferences ── */}
        <SectionDivider label={t('profile.preferences_section')} />
        <View style={styles.menuGroup}>
          <MenuItem
            icon="⚙️"
            label={t('profile.settings')}
            sub={t('profile.settings_sub')}
            onPress={() => router.push('/(tabs)/more/settings')}
          />
          <RowDivider />
          <MenuItem
            icon="💬"
            label={t('profile.chat')}
            sub={t('profile.chat_sub')}
            onPress={() => router.push('/(tabs)/more/chat')}
          />
        </View>

        {/* ── Danger ── */}
        <SectionDivider label={t('profile.account_section')} />
        <View style={styles.menuGroup}>
          <MenuItem
            icon="🚪"
            label={t('profile.sign_out')}
            sub={t('profile.sign_out_sub')}
            onPress={handleLogout}
            danger
          />
        </View>

        <Text style={styles.version}>{t('profile.footer')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// Simple inline secure text input using Pressable + TextInput
import { TextInput } from 'react-native';
function PasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (t: string) => void;
  placeholder: string;
}): React.JSX.Element {
  return (
    <TextInput
      style={styles.textInput}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.textDisabled}
      secureTextEntry
      autoCapitalize="none"
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: sizes.lg, paddingBottom: 60 },

  // Profile header
  profileHeader: {
    alignItems: 'center',
    paddingVertical: sizes.xl,
    gap: sizes.xs,
    marginBottom: sizes.lg,
  },
  avatarLarge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: sizes.sm,
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
  } as never,
  avatarLargeText: { color: colors.white, fontSize: 40, ...font.bold },
  profileName: { fontSize: 24, ...font.extrabold, color: colors.textPrimary, letterSpacing: -0.5 },
  profileEmail: { fontSize: 14, ...font.regular, color: colors.textSecondary },
  housePill: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: sizes.md,
    paddingVertical: 4,
    borderRadius: sizes.borderRadiusFull,
    marginTop: sizes.xs,
  },
  housePillText: { fontSize: 13, ...font.semibold, color: colors.primary },

  // Section labels
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    ...font.bold,
    letterSpacing: 1.2,
    marginBottom: sizes.sm,
    marginTop: sizes.xs,
    marginLeft: 4,
  },

  // Menu
  menuGroup: {
    backgroundColor: colors.white,
    borderRadius: sizes.borderRadiusLg,
    marginBottom: sizes.lg,
    overflow: 'hidden',
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: sizes.md, gap: sizes.sm },
  menuItemPressed: { backgroundColor: colors.background },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: sizes.borderRadiusSm,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuIconDanger: { backgroundColor: colors.negative + '15' },
  menuIconText: { fontSize: 18 },
  menuText: { flex: 1 },
  menuLabel: { color: colors.textPrimary, ...font.semibold, fontSize: 15 },
  menuLabelDanger: { color: colors.negative },
  menuSub: { color: colors.textSecondary, fontSize: 13, ...font.regular, marginTop: 1 },
  menuChevron: { color: colors.textDisabled, fontSize: 22 },
  menuRightText: { color: colors.primary, ...font.bold, fontSize: 15 },
  rowDivider: { height: 1, backgroundColor: colors.border, marginLeft: sizes.md + 36 + sizes.sm },

  // Password form
  passwordForm: {
    padding: sizes.md,
    paddingTop: 0,
    gap: sizes.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  passwordField: { gap: 4 },
  fieldLabel: { fontSize: 12, ...font.semibold, color: colors.textSecondary, marginLeft: 2 },
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
  passwordButtons: { flexDirection: 'row', alignItems: 'center', gap: sizes.md, marginTop: sizes.xs },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: sizes.lg,
    borderRadius: 10,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: colors.white, ...font.semibold, fontSize: 14 },
  cancelText: { color: colors.textSecondary, fontSize: 14, ...font.regular },

  version: { color: colors.textDisabled, fontSize: 13, ...font.regular, textAlign: 'center', marginTop: sizes.md },
});
