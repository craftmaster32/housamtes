import { useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import {
  useHousematesStore,
  type Housemate,
  type MemberPermissions,
  type MemberRole,
} from '@stores/housematesStore';
import { Alert } from '@lib/alert';
import { BackLink } from '@components/shared/BackLink';
import { MemberCard } from '@components/settings/MemberCard';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';

import { mf, ms } from '@utils/responsive';

// ── Screen ────────────────────────────────────────────────────────────────────
export default function MembersScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const myUserId = useAuthStore((s) => s.user?.id);
  const myRole = useAuthStore((s) => s.role);
  const houseId = useAuthStore((s) => s.houseId);
  const housemates = useHousematesStore((s) => s.housemates);
  const load = useHousematesStore((s) => s.load);
  const updatePermissions = useHousematesStore((s) => s.updatePermissions);
  const updateRole = useHousematesStore((s) => s.updateRole);

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const headingFont = useHeadingFont('semibold');

  useEffect(() => {
    if (houseId) load(houseId);
  }, [houseId, load]);

  const handleToggle = useCallback(
    async (memberId: string, key: keyof MemberPermissions, value: boolean): Promise<void> => {
      Haptics.selectionAsync().catch(() => {});
      const member = housemates.find((h) => h.memberId === memberId);
      if (!member) return;
      const newPerms = { ...member.permissions, [key]: value };
      try {
        await updatePermissions(memberId, newPerms);
      } catch {
        Alert.alert(t('common.error'), t('common.failed_try_again'));
      }
    },
    [housemates, updatePermissions, t]
  );

  const handleChangeRole = useCallback(
    (member: Housemate) => {
      // Owners can grant/revoke ownership (a real co-owner); admins can only
      // move members between admin and member. The current role is never offered.
      const assignable: MemberRole[] =
        myRole === 'owner' ? ['owner', 'admin', 'member'] : ['admin', 'member'];
      const options: MemberRole[] = assignable.filter((r) => r !== member.role);
      const labels: Record<MemberRole, string> = {
        owner: t('members.owner'),
        admin: t('members.admin'),
        member: t('members.member'),
      };
      Alert.alert(
        t('members.change_role_title', { name: member.name }),
        t('members.change_role_body'),
        [
          ...options.map((r) => ({
            text: t('members.make_role', { role: labels[r] }),
            onPress: async (): Promise<void> => {
              try {
                await updateRole(member.memberId, r);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              } catch {
                Alert.alert(t('common.error'), t('members.role_update_failed'));
              }
            },
          })),
          { text: t('common.cancel'), style: 'cancel' as const },
        ]
      );
    },
    [updateRole, myRole, t]
  );

  const canEdit = myRole === 'owner' || myRole === 'admin';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.flex}>
        <FlatList
          data={housemates}
          keyExtractor={(h) => h.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View>
              <BackLink label={t('nav.settings')} />
              <Text style={[styles.title, headingFont]}>{t('members.title')}</Text>
              <Text style={styles.screenSub}>{t('members.subtitle')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <MemberCard
              member={item}
              isMe={item.id === myUserId}
              canEdit={canEdit}
              iAmOwner={myRole === 'owner'}
              onTogglePermission={handleToggle}
              onChangeRole={handleChangeRole}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={<Text style={styles.empty}>{t('members.no_members')}</Text>}
        />
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (C: ColorTokens): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    list: { paddingHorizontal: ms(20), paddingTop: ms(8), paddingBottom: ms(60) },
    title: {
      fontSize: mf(36),
      lineHeight: mf(46),
      paddingBottom: ms(2),
      letterSpacing: -0.5,
      marginTop: ms(4),
      color: C.textPrimary,
    },
    screenSub: {
      fontSize: mf(14),
      ...font.regular,
      color: C.textSecondary,
      lineHeight: mf(20),
      marginBottom: ms(18),
    },
    sep: { height: ms(14) },
    empty: {
      textAlign: 'center',
      color: C.textSecondary,
      fontSize: mf(14),
      paddingVertical: ms(24),
    },
  });
