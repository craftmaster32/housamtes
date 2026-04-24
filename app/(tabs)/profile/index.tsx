import { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert, TextInput, ActivityIndicator, Platform, Modal } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useBillsStore } from '@stores/billsStore';
import { useSpendingStore, CATEGORY_META } from '@stores/spendingStore';
import { useSettingsStore } from '@stores/settingsStore';
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
          style={[styles.stackAvatar, { backgroundColor: h.avatarUrl ? 'transparent' : h.color, marginLeft: i === 0 ? 0 : -10 }]}
        >
          {h.avatarUrl
            ? <Image source={{ uri: h.avatarUrl }} style={styles.stackAvatarImg} contentFit="cover" />
            : <Text style={styles.stackAvatarText}>{h.name[0].toUpperCase()}</Text>
          }
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
  const currency = useSettingsStore((s) => s.currency);
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
        <Text style={styles.activityAmtText}>-{currency}{share.toFixed(2)}</Text>
        <Text style={styles.activityAmtSub}>Your share</Text>
      </View>
    </View>
  );
}

// ── Personal details form ──────────────────────────────────────────────────────
function PersonalDetailsForm({
  currentName, currentEmail, onDone,
}: {
  currentName: string; currentEmail: string; onDone: () => void;
}): React.JSX.Element {
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const updateEmail   = useAuthStore((s) => s.updateEmail);
  const [name, setName]       = useState(currentName);
  const [email, setEmail]     = useState(currentEmail);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const handleSave = useCallback(async (): Promise<void> => {
    const trimName  = name.trim();
    const trimEmail = email.trim();
    if (!trimName) { setError('Name cannot be empty.'); return; }
    if (!trimEmail) { setError('Email cannot be empty.'); return; }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const nameChanged  = trimName !== currentName;
      const emailChanged = trimEmail !== currentEmail;
      if (nameChanged)  await updateProfile(trimName);
      if (emailChanged) await updateEmail(trimEmail);
      if (nameChanged && emailChanged) {
        setSuccess('Name updated. A confirmation link has been sent to your new email address.');
      } else if (nameChanged) {
        setSuccess('Name updated.');
      } else if (emailChanged) {
        setSuccess('A confirmation link has been sent to your new email address.');
      } else {
        onDone();
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [name, email, currentName, currentEmail, updateProfile, updateEmail, onDone]);

  return (
    <View style={styles.pwForm}>
      <View>
        <Text style={styles.detailsLabel}>Display name</Text>
        <TextInput
          style={styles.textInput}
          value={name}
          onChangeText={(v) => { setName(v); setError(''); setSuccess(''); }}
          placeholder="Your name"
          placeholderTextColor={colors.textDisabled}
          autoCapitalize="words"
        />
      </View>
      <View>
        <Text style={styles.detailsLabel}>Email address</Text>
        <TextInput
          style={styles.textInput}
          value={email}
          onChangeText={(v) => { setEmail(v); setError(''); setSuccess(''); }}
          placeholder="your@email.com"
          placeholderTextColor={colors.textDisabled}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <Text style={styles.detailsHint}>Changing email sends a confirmation link to the new address.</Text>
      </View>
      {!!error   && <Text style={styles.fieldError}>{error}</Text>}
      {!!success && <Text style={styles.detailsSuccess}>{success}</Text>}
      <View style={styles.pwBtns}>
        <Pressable
          style={[styles.saveBtn, saving && styles.saveBtnOff]}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save changes'}</Text>
        </Pressable>
        <Pressable onPress={onDone} accessibilityRole="button">
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Change password form ───────────────────────────────────────────────────────
function ChangePasswordForm({ onDone }: { onDone: () => void }): React.JSX.Element {
  const changePassword = useAuthStore((s) => s.changePassword);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);

  const handleSave = useCallback(async (): Promise<void> => {
    if (!currentPassword) { setError('Please enter your current password.'); return; }
    if (newPassword.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    setSaving(true);
    setError('');
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [currentPassword, newPassword, confirmPassword, changePassword]);

  if (success) {
    return (
      <View style={styles.pwForm}>
        <Text style={styles.detailsSuccess}>Password updated successfully.</Text>
        <Pressable onPress={onDone} accessibilityRole="button">
          <Text style={styles.cancelText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.pwForm}>
      <View>
        <Text style={styles.detailsLabel}>Current password</Text>
        <TextInput
          style={styles.textInput}
          value={currentPassword}
          onChangeText={(v) => { setCurrentPassword(v); setError(''); }}
          placeholder="Your current password"
          placeholderTextColor={colors.textDisabled}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="off"
          accessibilityLabel="Current password"
        />
      </View>
      <View>
        <Text style={styles.detailsLabel}>New password</Text>
        <TextInput
          style={styles.textInput}
          value={newPassword}
          onChangeText={(v) => { setNewPassword(v); setError(''); }}
          placeholder="At least 8 characters"
          placeholderTextColor={colors.textDisabled}
          secureTextEntry
          autoCapitalize="none"
          accessibilityLabel="New password"
        />
      </View>
      <View>
        <Text style={styles.detailsLabel}>Confirm new password</Text>
        <TextInput
          style={styles.textInput}
          value={confirmPassword}
          onChangeText={(v) => { setConfirmPassword(v); setError(''); }}
          placeholder="Repeat new password"
          placeholderTextColor={colors.textDisabled}
          secureTextEntry
          autoCapitalize="none"
          accessibilityLabel="Confirm new password"
        />
      </View>
      {!!error && <Text style={styles.fieldError}>{error}</Text>}
      <View style={styles.pwBtns}>
        <Pressable
          style={[styles.saveBtn, saving && styles.saveBtnOff]}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Update password'}</Text>
        </Pressable>
        <Pressable onPress={onDone} accessibilityRole="button">
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
      <Pressable
        onPress={() => router.push('/(auth)/forgot-password')}
        accessibilityRole="button"
        style={styles.forgotLink}
      >
        <Text style={styles.forgotLinkText}>Forgot your password?</Text>
      </Pressable>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function ProfileScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const profile       = useAuthStore((s) => s.profile);
  const user          = useAuthStore((s) => s.user);
  const role          = useAuthStore((s) => s.role);
  const signOut       = useAuthStore((s) => s.signOut);
  const houseId       = useAuthStore((s) => s.houseId);
  const uploadAvatar  = useAuthStore((s) => s.uploadAvatar);
  const removeAvatar  = useAuthStore((s) => s.removeAvatar);
  const uploadCover   = useAuthStore((s) => s.uploadCover);
  const removeCover   = useAuthStore((s) => s.removeCover);
  const currency   = useSettingsStore((s) => s.currency);
  const housemates = useHousematesStore((s) => s.housemates);
  const houseName  = useHousematesStore((s) => s.houseName);
  const bills      = useBillsStore((s) => s.bills);
  const loadBills  = useBillsStore((s) => s.load);
  const months     = useSpendingStore((s) => s.months);

  const [showDetailsForm, setShowDetailsForm]   = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [cropPending, setCropPending] = useState<{ uri: string; base64?: string } | null>(null);

  // Load bills for recent activity if not already loaded by the root layout
  useEffect(() => {
    if (houseId && bills.length === 0) loadBills(houseId);
    // Intentionally omit bills.length — we only want to trigger on houseId change,
    // not every time a bill is added/deleted (which would cause a redundant fetch when count hits 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [houseId, loadBills]);

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

  const handleCropConfirm = useCallback(async (): Promise<void> => {
    if (!cropPending) return;
    setUploading(true);
    try {
      await uploadAvatar(cropPending.uri, 'image/jpeg', cropPending.base64);
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Could not upload photo.');
    } finally {
      setUploading(false);
      setCropPending(null);
    }
  }, [cropPending, uploadAvatar]);

  const pickImage = useCallback(async (source: 'camera' | 'library'): Promise<void> => {
    // Web browsers don't support allowsEditing — pick the file, auto-center-crop it,
    // then show a preview so the user can confirm before uploading.
    if (Platform.OS === 'web') {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'] as ImagePicker.MediaType[],
        quality: 1,
      });
      if (res.canceled || !res.assets[0]) return;
      const a = res.assets[0];
      const w = a.width ?? 0;
      const h = a.height ?? 0;
      try {
        const ops: ImageManipulator.Action[] = [];
        if (w > 0 && h > 0 && w !== h) {
          const size = Math.min(w, h);
          ops.push({ crop: { originX: Math.round((w - size) / 2), originY: Math.round((h - size) / 2), width: size, height: size } });
        }
        ops.push({ resize: { width: 512, height: 512 } });
        const cropped = await ImageManipulator.manipulateAsync(
          a.uri, ops,
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        setCropPending({ uri: cropped.uri, base64: cropped.base64 ?? undefined });
      } catch {
        setCropPending({ uri: a.uri });
      }
      return;
    }

    // Native iOS/Android: allowsEditing shows the built-in square crop UI.
    const opts = {
      mediaTypes: ['images'] as ImagePicker.MediaType[],
      allowsEditing: true,
      aspect: [1, 1] as [number, number],
      quality: 0.8,
      base64: true,
    };
    let result: ImagePicker.ImagePickerResult;
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera access is required to take a photo.');
        return;
      }
      result = await ImagePicker.launchCameraAsync(opts);
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library access is required to choose a photo.');
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync(opts);
    }
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      await uploadAvatar(asset.uri, asset.mimeType ?? 'image/jpeg', asset.base64 ?? undefined);
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Could not upload photo.');
    } finally {
      setUploading(false);
    }
  }, [uploadAvatar]);

  const pickCover = useCallback(async (): Promise<void> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library access is required to choose a cover photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploadingCover(true);
    try {
      await uploadCover(asset.uri, asset.mimeType ?? 'image/jpeg', asset.base64 ?? undefined);
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Could not upload cover photo.');
    } finally {
      setUploadingCover(false);
    }
  }, [uploadCover]);

  const handleCoverPress = useCallback((): void => {
    const options: Parameters<typeof Alert.alert>[2] = [
      { text: 'Choose cover photo', onPress: pickCover },
    ];
    if (profile?.coverUrl) {
      options.push({
        text: 'Remove cover photo',
        style: 'destructive',
        onPress: async () => {
          setUploadingCover(true);
          await removeCover().catch((err: unknown) => {
            Alert.alert('Error', err instanceof Error ? err.message : 'Could not remove cover photo.');
          });
          setUploadingCover(false);
        },
      });
    }
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Cover photo', 'Choose an option', options);
  }, [pickCover, removeCover, profile?.coverUrl]);

  const handleAvatarPress = useCallback((): void => {
    // On web, file pickers must be opened synchronously from a user gesture —
    // calling them inside an Alert callback breaks the browser security model.
    if (Platform.OS === 'web') {
      pickImage('library');
      return;
    }
    const options: Parameters<typeof Alert.alert>[2] = [
      { text: 'Take photo', onPress: (): void => { pickImage('camera'); } },
      { text: 'Choose from library', onPress: (): void => { pickImage('library'); } },
    ];
    if (profile?.avatarUrl) {
      options.push({
        text: 'Remove photo',
        style: 'destructive',
        onPress: async () => {
          setUploading(true);
          await removeAvatar().catch((err: unknown) => {
            Alert.alert('Error', err instanceof Error ? err.message : 'Could not remove photo.');
          });
          setUploading(false);
        },
      });
    }
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Profile photo', 'Choose an option', options);
  }, [pickImage, removeAvatar, profile?.avatarUrl]);

  const handleLogout = useCallback(() => {
    if (Platform.OS === 'web') {
      signOut().then(() => router.replace('/(auth)/welcome')).catch(() => {});
      return;
    }
    Alert.alert(t('profile.sign_out'), t('profile.sign_out_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.sign_out'), style: 'destructive', onPress: async (): Promise<void> => {
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
          {/* Cover photo */}
          <Pressable
            style={styles.coverWrap}
            onPress={handleCoverPress}
            disabled={uploadingCover}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Change cover photo"
          >
            {profile?.coverUrl
              ? <Image source={{ uri: profile.coverUrl }} style={styles.coverImage} contentFit="cover" />
              : (
                <>
                  <View style={styles.decoCircleTL} />
                  <View style={styles.decoCircleTR} />
                </>
              )
            }
            {uploadingCover && (
              <View style={styles.coverOverlay}>
                <ActivityIndicator color={colors.white} size="small" />
              </View>
            )}
            <View style={styles.coverBadge}>
              <Ionicons name="image-outline" size={12} color={colors.primary} />
            </View>
          </Pressable>

          {/* Avatar */}
          <Pressable
            style={styles.avatarWrap}
            onPress={handleAvatarPress}
            disabled={uploading}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
          >
            <View style={[styles.avatarRing, { backgroundColor: profile?.avatarUrl ? 'transparent' : (profile?.avatarColor ?? colors.primary) }]}>
              {profile?.avatarUrl
                ? <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} contentFit="cover" />
                : <Text style={styles.avatarInitial}>{initial}</Text>
              }
              {uploading && (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color={colors.white} size="small" />
                </View>
              )}
            </View>
            <View style={styles.avatarBadge}>
              <Ionicons name="camera" size={12} color={colors.primary} />
            </View>
          </Pressable>

          <Text style={styles.profileName}>{profile?.name ?? 'You'}</Text>
          {!!user?.email && <Text style={styles.profileEmail}>{user.email}</Text>}
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
                    <Text style={styles.expenseAmt}>{currency}{cat.amount.toFixed(2)}</Text>
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
                sub={showDetailsForm ? 'Tap to close' : `${profile?.name ?? ''}  ·  ${user?.email ?? ''}`}
                onPress={() => setShowDetailsForm((v) => !v)}
              />
              {showDetailsForm && (
                <>
                  <View style={styles.rowDivider} />
                  <PersonalDetailsForm
                    currentName={profile?.name ?? ''}
                    currentEmail={user?.email ?? ''}
                    onDone={() => setShowDetailsForm(false)}
                  />
                </>
              )}
              <View style={styles.rowDivider} />
              <ProfileRow
                iconName="lock-closed-outline"
                title="Change password"
                sub={showPasswordForm ? 'Tap to close' : 'Update your login password'}
                onPress={() => { setShowPasswordForm((v) => !v); setShowDetailsForm(false); }}
              />
              {showPasswordForm && (
                <>
                  <View style={styles.rowDivider} />
                  <ChangePasswordForm onDone={() => setShowPasswordForm(false)} />
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
                onPress={() => router.push({ pathname: '/(tabs)/more/settings', params: { from: 'profile' } })}
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

        {/* ── Crop preview modal (web only) ──────────────────────── */}
        <Modal visible={cropPending !== null} transparent animationType="fade">
          <View style={styles.cropOverlay}>
            <View style={styles.cropModal}>
              <Text style={styles.cropTitle}>Use this photo?</Text>
              {cropPending && (
                <Image
                  source={{ uri: cropPending.uri }}
                  style={styles.cropPreview}
                  contentFit="cover"
                />
              )}
              <View style={styles.cropBtns}>
                <Pressable
                  style={[styles.cropConfirmBtn, uploading && styles.saveBtnOff]}
                  onPress={handleCropConfirm}
                  disabled={uploading}
                  accessibilityRole="button"
                >
                  {uploading
                    ? <ActivityIndicator color={colors.white} size="small" />
                    : <Text style={styles.cropConfirmText}>Use Photo</Text>
                  }
                </Pressable>
                <Pressable onPress={() => setCropPending(null)} accessibilityRole="button" disabled={uploading}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

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
    paddingBottom: sizes.lg,
    gap: sizes.xs,
    position: 'relative',
  },
  // Cover photo
  coverWrap: {
    width: '100%',
    height: 140,
    backgroundColor: colors.secondary,
    marginBottom: 52,
    position: 'relative',
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  decoCircleTL: {
    position: 'absolute',
    top: 30,
    left: -20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    opacity: 0.15,
  },
  decoCircleTR: {
    position: 'absolute',
    top: 60,
    right: 40,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    opacity: 0.15,
  },
  avatarWrap: { position: 'absolute', top: 90, alignSelf: 'center' },
  avatarRing: {
    width: 102,
    height: 102,
    borderRadius: 51,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.75)',
    overflow: 'hidden',
  },
  avatarImage: { width: 96, height: 96 },
  avatarOverlay: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
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
  profileName:  { fontSize: 28, ...font.extrabold, color: colors.textPrimary, letterSpacing: -0.56, marginTop: 4 },
  profileEmail: { fontSize: 13, ...font.regular, color: colors.textSecondary },
  profileSub:   { fontSize: 15, ...font.regular, color: colors.textSecondary },

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
    overflow: 'hidden',
  },
  stackAvatarImg: { width: 34, height: 34 },
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
  fieldError:     { color: colors.danger, fontSize: 13, ...font.regular },
  detailsLabel:   { fontSize: 12, ...font.semibold, color: colors.textSecondary, marginBottom: 4 },
  detailsHint:    { fontSize: 11, ...font.regular, color: colors.textDisabled, marginTop: 4 },
  detailsSuccess: { fontSize: 13, ...font.regular, color: colors.positive ?? '#16a34a' },
  pwBtns:     { flexDirection: 'row', alignItems: 'center', gap: sizes.md, marginTop: sizes.xs },
  saveBtn:    { backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: sizes.lg, borderRadius: 10 },
  saveBtnOff: { opacity: 0.6 },
  saveBtnText:  { color: colors.white, ...font.semibold, fontSize: 14 },
  cancelText:   { color: colors.textSecondary, fontSize: 14, ...font.regular },

  version: { color: colors.textDisabled, fontSize: 13, ...font.regular, textAlign: 'center', marginTop: sizes.sm },
  forgotLink: { alignSelf: 'flex-start', marginTop: 2 },
  forgotLinkText: { fontSize: 13, ...font.regular, color: colors.primary },

  // Crop preview modal
  cropOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: sizes.lg,
  },
  cropModal: {
    backgroundColor: colors.white,
    borderRadius: sizes.borderRadiusLg,
    padding: sizes.lg,
    alignItems: 'center',
    gap: sizes.md,
    width: '100%',
    maxWidth: 360,
  },
  cropTitle: { fontSize: 18, ...font.extrabold, color: colors.textPrimary },
  cropPreview: { width: 240, height: 240, borderRadius: sizes.borderRadiusLg },
  cropBtns: { flexDirection: 'row', alignItems: 'center', gap: sizes.lg },
  cropConfirmBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: sizes.xl,
    borderRadius: 10,
    minWidth: 120,
    alignItems: 'center',
  },
  cropConfirmText: { color: colors.white, ...font.semibold, fontSize: 15 },
});
