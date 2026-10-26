import { useState, useCallback, useEffect, useMemo } from 'react';
import { useScrollToTopOnNav } from '@hooks/useScrollToTopOnNav';
import { View, StyleSheet, ScrollView, Pressable, Platform, Modal } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { navigateToBase } from '@stores/navigationStore';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useBillsStore } from '@stores/billsStore';
import { useSpendingStore } from '@stores/spendingStore';
import { useProfilePhotos } from '@hooks/useProfilePhotos';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { Alert } from '@lib/alert';
import { getErrorMessage } from '@utils/errors';
import { BackLink } from '@components/shared/BackLink';
import { LoadingSpinner } from '@components/shared/LoadingSpinner';
import { SettingsLine } from '@components/settings/SettingsLine';
import { IdCard } from '@components/profile/IdCard';
import { SpendingCard } from '@components/profile/SpendingCard';
import { SectionHead } from '@components/profile/SectionHead';
import { ExpenseSummary } from '@components/profile/ExpenseSummary';
import { RecentActivity } from '@components/profile/RecentActivity';
import { DetailsSheet } from '@components/profile/DetailsSheet';
import { PasswordSheet } from '@components/profile/PasswordSheet';
import { CropEditor } from '@components/profile/CropEditor';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';

function isSameDay(d: Date, ref: Date): boolean {
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function billDayLabel(dateStr: string): 'today' | 'yesterday' | 'older' {
  // Parse the YMD bill date at LOCAL midnight. A bare `new Date('2026-08-10')`
  // parses as UTC, so west-of-UTC users would see a bill dated today labelled
  // "yesterday". Appending the time (matching the rest of the app) fixes that.
  const d = new Date(`${dateStr}T00:00:00`);
  const now = new Date();
  if (isSameDay(d, now)) return 'today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(d, yesterday)) return 'yesterday';
  return 'older';
}

export default function ProfileScreen(): React.JSX.Element {
  // Tapping your way here (even from this page) shows the top of the page.
  const scrollRef = useScrollToTopOnNav('profile/index');
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const houseId = useAuthStore((s) => s.houseId);
  const houseName = useHousematesStore((s) => s.houseName);
  const bills = useBillsStore((s) => s.bills);
  const loadBills = useBillsStore((s) => s.load);
  const months = useSpendingStore((s) => s.months);
  const photos = useProfilePhotos();

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const headingFont = useHeadingFont('semibold');

  const [showDetails, setShowDetails] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Load bills for recent activity if not already loaded by the root layout
  useEffect(() => {
    if (houseId && bills.length === 0) loadBills(houseId);
    // Intentionally omit bills.length — we only want to trigger on houseId change,
    // not every time a bill is added/deleted (which would cause a redundant fetch when count hits 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [houseId, loadBills]);

  // Top 4 expense categories from current month
  const topCategories = months[0]?.categories.slice(0, 4) ?? [];

  // Recent bills grouped as today / yesterday
  const recentBills = [...bills]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
  const todayBills = recentBills.filter((b) => billDayLabel(b.date) === 'today');
  const yesterdayBills = recentBills.filter((b) => billDayLabel(b.date) === 'yesterday');

  const handleDeleteAccount = useCallback((): void => {
    Alert.alert(t('profile.delete_account'), t('profile.delete_account_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.delete_my_account'),
        style: 'destructive',
        onPress: (): void => {
          Alert.alert(t('profile.are_you_sure'), t('profile.delete_permanent_body'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('profile.yes_delete_permanently'),
              style: 'destructive',
              onPress: async (): Promise<void> => {
                try {
                  await deleteAccount();
                  router.replace('/(auth)/welcome');
                } catch (err) {
                  Alert.alert(t('common.error'), getErrorMessage(err, t('profile.delete_failed')));
                }
              },
            },
          ]);
        },
      },
    ]);
  }, [deleteAccount, t]);

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

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <BackLink label={t('common.home')} />
        <Text style={[styles.title, headingFont]}>{t('nav.profile')}</Text>

        <IdCard
          name={profile?.name ?? t('common.you')}
          email={user?.email ?? ''}
          houseName={houseName || t('profile.the_house')}
          avatarUrl={profile?.avatarUrl}
          avatarColor={profile?.avatarColor ?? C.primary}
          coverUrl={profile?.coverUrl}
          uploading={photos.uploading}
          uploadingCover={photos.uploadingCover}
          onAvatarPress={photos.handleAvatarPress}
          onCoverPress={photos.handleCoverPress}
        />

        {houseId && profile?.name && (
          <View style={styles.spending}>
            <SpendingCard houseId={houseId} userName={profile.name} />
          </View>
        )}

        {topCategories.length > 0 && (
          <>
            <SectionHead
              title={t('profile.expense_summary')}
              action={t('profile.see_all')}
              onAction={() => router.push('/(tabs)/profile/spending')}
            />
            <ExpenseSummary lines={topCategories} />
          </>
        )}

        <SectionHead title={t('profile.profile_label')} />
        <View style={[styles.card, { backgroundColor: C.surface }]}>
          <SettingsLine
            label={t('profile.personal_details')}
            sub={user?.email ?? ''}
            onPress={() => setShowDetails(true)}
          />
          <SettingsLine
            label={t('profile.change_password')}
            sub={t('profile.change_password_sub')}
            onPress={() => setShowPassword(true)}
          />
          <SettingsLine
            label={t('profile.payouts_title')}
            sub={t('profile.payouts_sub')}
            onPress={() => router.push('/(tabs)/bills/setup')}
          />
          <SettingsLine
            label={t('profile.history_title')}
            sub={t('profile.history_sub')}
            onPress={() => router.push('/(tabs)/profile/spending')}
          />
          <SettingsLine
            label={t('profile.app_settings_title')}
            sub={t('profile.app_settings_sub')}
            // Opened from Profile, Settings is a page of Profile — pushed on top
            // of it, so back returns here rather than Home.
            onPress={() =>
              router.push({ pathname: '/(tabs)/more/settings', params: { from: 'profile' } })
            }
            last
          />
        </View>

        {(todayBills.length > 0 || yesterdayBills.length > 0) && (
          <>
            <SectionHead title={t('profile.recent_activity')} />
            <RecentActivity
              today={todayBills}
              yesterday={yesterdayBills}
              userId={profile?.id ?? ''}
              onMore={() => navigateToBase('/(tabs)/bills/index')}
            />
          </>
        )}

        <Pressable
          style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel={t('profile.sign_out')}
        >
          <Text style={styles.signOutText}>{t('profile.sign_out')}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
          onPress={handleDeleteAccount}
          accessibilityRole="button"
          accessibilityLabel={t('profile.delete_account')}
        >
          <Text style={styles.deleteText}>{t('profile.delete_account')}</Text>
        </Pressable>
        <Text style={styles.version}>{t('profile.footer')}</Text>
      </ScrollView>

      <DetailsSheet
        visible={showDetails}
        currentName={profile?.name ?? ''}
        currentEmail={user?.email ?? ''}
        onClose={() => setShowDetails(false)}
      />
      <PasswordSheet visible={showPassword} onClose={() => setShowPassword(false)} />

      {/* Crop editor (web only — native uses the system crop). */}
      <Modal visible={photos.cropSource !== null} transparent animationType="fade">
        <View style={styles.cropOverlay}>
          <View style={styles.cropBox}>
            <Text style={[styles.cropTitle, headingFont]}>{t('profile.crop_photo')}</Text>
            {photos.cropSource && (
              <CropEditor
                source={photos.cropSource}
                onConfirm={photos.handleCropConfirm}
                onCancel={photos.cancelCrop}
              />
            )}
            {photos.uploading && (
              <View style={styles.cropBusy}>
                <LoadingSpinner />
                <Text style={styles.cropBusyText}>{t('photos.uploading')}</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(C: ColorTokens): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    scroll: { paddingHorizontal: ms(20), paddingTop: ms(8), paddingBottom: ms(60) },
    title: {
      fontSize: mf(36),
      lineHeight: mf(46),
      paddingBottom: ms(2),
      letterSpacing: -0.5,
      marginTop: ms(4),
      marginBottom: ms(16),
      color: C.textPrimary,
    },
    spending: { marginTop: ms(22) },
    card: { borderRadius: ms(18), paddingHorizontal: ms(16) },
    signOut: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: ms(30) },
    signOutText: { fontSize: mf(16), ...font.semibold, color: C.negative },
    delete: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    deleteText: { fontSize: mf(13), ...font.medium, color: C.textSecondary },
    pressed: { opacity: 0.6 },
    version: {
      fontSize: mf(12),
      ...font.regular,
      color: C.textTertiary,
      textAlign: 'center',
      marginTop: ms(10),
    },
    cropOverlay: {
      flex: 1,
      backgroundColor: 'rgba(34,32,29,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: ms(20),
    },
    cropBox: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: C.background,
      borderRadius: ms(26),
      padding: ms(20),
      alignItems: 'center',
    },
    cropTitle: { fontSize: mf(24), lineHeight: mf(31), color: C.textPrimary, marginBottom: ms(12) },
    cropBusy: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: ms(26),
      backgroundColor: C.background,
      alignItems: 'center',
      justifyContent: 'center',
      gap: ms(10),
    },
    cropBusyText: { fontSize: mf(15), ...font.semibold, color: C.textPrimary },
  });
}
