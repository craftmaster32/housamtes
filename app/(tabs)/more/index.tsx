import { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  TextInput,
  type ImageStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { Alert } from '@lib/alert';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { getErrorMessage } from '@utils/errors';

function MenuItem({
  icon,
  label,
  sub,
  onPress,
  danger,
  rightText,
  rtl,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  sub?: string;
  onPress: () => void;
  danger?: boolean;
  rightText?: string;
  rtl?: boolean;
}): React.JSX.Element {
  const c = useThemedColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={sub}
    >
      <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
        <Ionicons name={icon} size={18} color={danger ? c.negative : c.primary} />
      </View>
      <View style={styles.menuText}>
        <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
        {sub ? <Text style={styles.menuSub}>{sub}</Text> : null}
      </View>
      {rightText ? (
        <Text style={styles.menuRightText}>{rightText}</Text>
      ) : (
        <Ionicons
          name={rtl ? 'chevron-back' : 'chevron-forward'}
          size={18}
          color={c.textTertiary}
        />
      )}
    </Pressable>
  );
}

function SectionDivider({ label }: { label: string }): React.JSX.Element {
  const c = useThemedColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function RowDivider(): React.JSX.Element {
  const c = useThemedColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return <View style={styles.rowDivider} />;
}

export default function ProfileScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const headingFont = useHeadingFont();
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const changePassword = useAuthStore((s) => s.changePassword);
  const housemates = useHousematesStore((s) => s.housemates);
  const inviteCode = useHousematesStore((s) => s.inviteCode);
  const houseName = useHousematesStore((s) => s.houseName);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const language = useLanguageStore((s) => s.language);
  const rtl = isRTL(language);
  const initial = (profile?.name ?? '?')[0].toUpperCase();
  const email = user?.email ?? '';

  const handleLogout = useCallback((): void => {
    if (Platform.OS === 'web') {
      signOut()
        .then(() => router.replace('/(auth)/welcome'))
        .catch(() => {
          Alert.alert(t('common.error'), t('profile.sign_out_failed'));
        });
      return;
    }
    Alert.alert(t('profile.sign_out'), t('profile.sign_out_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.sign_out'),
        style: 'destructive',
        onPress: async (): Promise<void> => {
          try {
            await signOut();
            router.replace('/(auth)/welcome');
          } catch {
            Alert.alert(t('common.error'), t('profile.sign_out_failed'));
          }
        },
      },
    ]);
  }, [signOut, t]);

  const handleChangePassword = useCallback(async () => {
    if (!currentPassword) {
      setPasswordError(t('profile.enter_current_password'));
      return;
    }
    if (!newPassword) {
      setPasswordError(t('profile.enter_new_password'));
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(t('profile.password_min'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('profile.passwords_no_match'));
      return;
    }
    setPasswordSaving(true);
    setPasswordError('');
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      Alert.alert(t('common.done'), t('profile.password_updated'));
    } catch (err) {
      setPasswordError(getErrorMessage(err, t('profile.could_not_update')));
    } finally {
      setPasswordSaving(false);
    }
  }, [currentPassword, newPassword, confirmPassword, changePassword, t]);

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
          <View
            style={[
              styles.avatarLarge,
              {
                backgroundColor: profile?.avatarUrl
                  ? 'transparent'
                  : (profile?.avatarColor ?? c.primary),
              },
            ]}
          >
            {profile?.avatarUrl ? (
              <Image
                source={{ uri: profile.avatarUrl }}
                style={styles.avatarLargeImg as ImageStyle}
                contentFit="cover"
              />
            ) : (
              <Text style={styles.avatarLargeText}>{initial}</Text>
            )}
          </View>
          <Text style={[styles.profileName, headingFont]}>{profile?.name ?? 'You'}</Text>
          {!!email && <Text style={styles.profileEmail}>{email}</Text>}
          {!!houseName && (
            <View style={styles.housePill}>
              <Ionicons name="home" size={12} color={c.primary} style={styles.housePillIcon} />
              <Text style={styles.housePillText}>{houseName}</Text>
            </View>
          )}
        </View>

        {/* ── Account ── */}
        <SectionDivider label={t('profile.account_section')} />
        <View style={styles.menuGroup}>
          <MenuItem
            icon="key-outline"
            label={t('profile.change_password')}
            sub={showPasswordForm ? t('profile.password_prompt') : t('profile.change_password_sub')}
            onPress={() => {
              setShowPasswordForm((v) => !v);
              setPasswordError('');
            }}
            rtl={rtl}
          />
          {showPasswordForm && (
            <View style={styles.passwordForm}>
              <View style={styles.passwordField}>
                <Text style={styles.fieldLabel}>{t('profile.current_password')}</Text>
                <PasswordInput
                  value={currentPassword}
                  onChange={(v) => {
                    setCurrentPassword(v);
                    setPasswordError('');
                  }}
                  placeholder={t('profile.current_password_placeholder')}
                />
              </View>
              <View style={styles.passwordField}>
                <Text style={styles.fieldLabel}>{t('profile.new_password')}</Text>
                <PasswordInput
                  value={newPassword}
                  onChange={(v) => {
                    setNewPassword(v);
                    setPasswordError('');
                  }}
                  placeholder={t('profile.password_hint')}
                />
              </View>
              <View style={styles.passwordField}>
                <Text style={styles.fieldLabel}>{t('profile.confirm_password')}</Text>
                <PasswordInput
                  value={confirmPassword}
                  onChange={(v) => {
                    setConfirmPassword(v);
                    setPasswordError('');
                  }}
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
                  <Text style={styles.saveBtnText}>
                    {passwordSaving ? t('profile.saving') : t('profile.save_password')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setShowPasswordForm(false);
                    setPasswordError('');
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                >
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
            icon="people-outline"
            label={t('profile.housemates')}
            sub={
              housemates.length > 0
                ? housemates.map((h) => h.name).join(', ')
                : t('profile.no_housemates')
            }
            onPress={() => router.push('/(tabs)/bills/setup')}
            rtl={rtl}
          />
          {!!inviteCode && (
            <>
              <RowDivider />
              <MenuItem
                icon="ticket-outline"
                label={t('profile.invite_code')}
                sub={t('profile.invite_code_sub')}
                rightText={inviteCode}
                onPress={handleCopyInviteCode}
                rtl={rtl}
              />
            </>
          )}
        </View>

        {/* ── Preferences ── */}
        <SectionDivider label={t('profile.preferences_section')} />
        <View style={styles.menuGroup}>
          <MenuItem
            icon="settings-outline"
            label={t('profile.settings')}
            sub={t('profile.settings_sub')}
            onPress={() => router.push('/(tabs)/more/settings')}
            rtl={rtl}
          />
          <RowDivider />
          <MenuItem
            icon="chatbubble-ellipses-outline"
            label={t('profile.chat')}
            sub={t('profile.chat_sub')}
            onPress={() => router.push('/(tabs)/more/chat')}
            rtl={rtl}
          />
        </View>

        {/* ── Danger ── */}
        <SectionDivider label={t('profile.account_section')} />
        <View style={styles.menuGroup}>
          <MenuItem
            icon="log-out-outline"
            label={t('profile.sign_out')}
            sub={t('profile.sign_out_sub')}
            onPress={handleLogout}
            danger
            rtl={rtl}
          />
        </View>

        <Text style={styles.version}>{t('profile.footer')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (t: string) => void;
  placeholder: string;
}): React.JSX.Element {
  const c = useThemedColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <TextInput
      style={styles.textInput}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={c.textDisabled}
      secureTextEntry
      autoCapitalize="none"
    />
  );
}

const makeStyles = (C: ColorTokens): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
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
      overflow: 'hidden',
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    } as never,
    avatarLargeImg: { width: 96, height: 96 },
    avatarLargeText: { color: '#fff', fontSize: 40, ...font.bold },
    profileName: { fontSize: 24, ...font.extrabold, color: C.textPrimary, letterSpacing: -0.5 },
    profileEmail: { fontSize: 14, ...font.regular, color: C.textSecondary },
    housePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: C.primary + '15',
      paddingHorizontal: sizes.md,
      paddingVertical: 4,
      borderRadius: sizes.borderRadiusFull,
      marginTop: sizes.xs,
    },
    housePillIcon: {},
    housePillText: { fontSize: 13, ...font.semibold, color: C.primary },

    // Section labels
    sectionLabel: {
      color: C.textSecondary,
      fontSize: 11,
      ...font.bold,
      letterSpacing: 1.2,
      marginBottom: sizes.sm,
      marginTop: sizes.xs,
      marginStart: 4,
    },

    // Menu
    menuGroup: {
      backgroundColor: C.surface,
      borderRadius: sizes.borderRadiusLg,
      marginBottom: sizes.lg,
      overflow: 'hidden',
    },
    menuItem: { flexDirection: 'row', alignItems: 'center', padding: sizes.md, gap: sizes.sm },
    menuItemPressed: { backgroundColor: C.background },
    menuIcon: {
      width: 36,
      height: 36,
      borderRadius: sizes.borderRadiusSm,
      backgroundColor: C.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    menuIconDanger: { backgroundColor: C.negative + '15' },
    menuIconText: { fontSize: 18 },
    menuText: { flex: 1 },
    menuLabel: { color: C.textPrimary, ...font.semibold, fontSize: 15 },
    menuLabelDanger: { color: C.negative },
    menuSub: { color: C.textSecondary, fontSize: 13, ...font.regular, marginTop: 1 },
    menuChevron: { color: C.textDisabled, fontSize: 22 },
    menuRightText: { color: C.primary, ...font.bold, fontSize: 15 },
    rowDivider: { height: 1, backgroundColor: C.border, marginStart: sizes.md + 36 + sizes.sm },

    // Password form
    passwordForm: {
      padding: sizes.md,
      paddingTop: 0,
      gap: sizes.sm,
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    passwordField: { gap: 4 },
    fieldLabel: { fontSize: 12, ...font.semibold, color: C.textSecondary, marginStart: 2 },
    textInput: {
      backgroundColor: C.background,
      borderRadius: 10,
      paddingHorizontal: sizes.md,
      paddingVertical: 12,
      fontSize: 15,
      ...font.regular,
      color: C.textPrimary,
      borderWidth: 1,
      borderColor: C.border,
    },
    fieldError: { color: C.danger, fontSize: 13, ...font.regular },
    passwordButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sizes.md,
      marginTop: sizes.xs,
    },
    saveBtn: {
      backgroundColor: C.primary,
      paddingVertical: 10,
      paddingHorizontal: sizes.lg,
      borderRadius: 10,
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { color: '#fff', ...font.semibold, fontSize: 14 },
    cancelText: { color: C.textSecondary, fontSize: 14, ...font.regular },

    version: {
      color: C.textDisabled,
      fontSize: 13,
      ...font.regular,
      textAlign: 'center',
      marginTop: sizes.md,
    },
  });
