import { useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, Switch, Pressable, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
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
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { sizes } from '@constants/sizes';

import { mf, ms } from '@utils/responsive';
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const PERMISSION_KEYS: Array<{ key: keyof MemberPermissions; tKey: string; icon: IoniconName }> = [
  { key: 'bills', tKey: 'members.perm_bills', icon: 'cash-outline' },
  { key: 'grocery', tKey: 'members.perm_grocery', icon: 'cart-outline' },
  { key: 'parking', tKey: 'members.perm_parking', icon: 'car-outline' },
  { key: 'chores', tKey: 'members.perm_chores', icon: 'sparkles-outline' },
  { key: 'chat', tKey: 'members.perm_chat', icon: 'chatbubble-ellipses-outline' },
  { key: 'photos', tKey: 'members.perm_photos', icon: 'camera-outline' },
  { key: 'voting', tKey: 'members.perm_voting', icon: 'podium-outline' },
  { key: 'maintenance', tKey: 'members.perm_maintenance', icon: 'construct-outline' },
  { key: 'condition', tKey: 'members.perm_condition', icon: 'clipboard-outline' },
];

const makeStyles = (C: ColorTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    list: { padding: sizes.lg, paddingBottom: ms(60), gap: 0 },
    // RNW's Switch thumb mispositions under an inherited RTL `direction`; isolate it to LTR.
    switchLtr: { writingDirection: 'ltr' } as ViewStyle,

    screenTitle: {
      fontSize: mf(24),
      ...font.extrabold,
      color: C.textPrimary,
      letterSpacing: -0.5,
      marginBottom: ms(6),
    },
    screenSub: {
      fontSize: mf(14),
      ...font.regular,
      color: C.textSecondary,
      lineHeight: mf(20),
      marginBottom: sizes.lg,
    },

    memberCard: {
      backgroundColor: C.surface,
      borderRadius: sizes.borderRadiusLg,
      borderWidth: 1,
      borderColor: C.border,
      overflow: 'hidden',
    },
    memberHeader: { flexDirection: 'row', alignItems: 'center', padding: sizes.md, gap: sizes.sm },
    memberAvatar: {
      width: ms(44),
      height: ms(44),
      borderRadius: ms(22),
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    memberAvatarImg: { width: ms(44), height: ms(44) },
    memberAvatarText: { color: '#FFF', fontSize: mf(18), ...font.bold },
    memberMeta: { flex: 1 },
    memberName: { fontSize: mf(16), ...font.semibold, color: C.textPrimary },
    memberRoleRow: { flexDirection: 'row', alignItems: 'center', gap: ms(4), marginTop: ms(1) },
    memberRole: { fontSize: mf(13), ...font.regular, color: C.textSecondary },
    memberJoined: { fontSize: mf(12), ...font.regular, color: C.textSecondary, marginTop: ms(2) },
    changeRoleBtn: { paddingHorizontal: ms(8), paddingVertical: ms(4) },
    changeRoleBtnText: { fontSize: mf(13), ...font.semibold, color: C.primary },

    permWrap: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
      paddingHorizontal: sizes.md,
      paddingBottom: sizes.md,
      paddingTop: sizes.sm,
      gap: ms(2),
    },
    permTitle: {
      fontSize: mf(12),
      ...font.bold,
      color: C.textSecondary,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: sizes.sm,
    },
    permRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: ms(8) },
    permIcon: { width: ms(28) },
    permLabel: { flex: 1, fontSize: mf(14), ...font.regular, color: C.textPrimary },
    permNote: {
      fontSize: mf(13),
      ...font.regular,
      color: C.textSecondary,
      padding: sizes.md,
      paddingTop: 0,
      fontStyle: 'italic',
    },

    empty: {
      textAlign: 'center',
      color: C.textSecondary,
      fontSize: mf(14),
      paddingVertical: ms(24),
    },
  });

// ── Member card ───────────────────────────────────────────────────────────────
function MemberCard({
  member,
  isMe,
  canEdit,
  onTogglePermission,
  onChangeRole,
}: {
  member: Housemate;
  isMe: boolean;
  canEdit: boolean;
  onTogglePermission: (memberId: string, key: keyof MemberPermissions, value: boolean) => void;
  onChangeRole: (member: Housemate) => void;
}): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const joinedLabel = member.joinedAt
    ? t('members.joined', {
        date: new Date(member.joinedAt).toLocaleDateString(i18n.language, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
      })
    : null;
  const roleIcon: IoniconName | null =
    member.role === 'owner' ? 'star' : member.role === 'admin' ? 'shield-checkmark' : null;
  const roleLabel =
    member.role === 'owner'
      ? t('members.owner')
      : member.role === 'admin'
        ? t('members.admin')
        : t('members.member');

  return (
    <View style={styles.memberCard}>
      <View style={styles.memberHeader}>
        <View
          style={[
            styles.memberAvatar,
            { backgroundColor: member.avatarUrl ? 'transparent' : member.color },
          ]}
        >
          {member.avatarUrl ? (
            <Image
              source={{ uri: member.avatarUrl }}
              style={styles.memberAvatarImg}
              contentFit="cover"
              accessibilityLabel={t('profile.profile_photo_of', { name: member.name })}
            />
          ) : (
            <Text style={styles.memberAvatarText}>{member.name[0].toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.memberMeta}>
          <Text style={styles.memberName}>
            {isMe ? t('members.name_with_you', { name: member.name }) : member.name}
          </Text>
          <View style={styles.memberRoleRow}>
            {roleIcon && <Ionicons name={roleIcon} size={12} color={C.textSecondary} />}
            <Text style={styles.memberRole}>{roleLabel}</Text>
          </View>
          {joinedLabel && <Text style={styles.memberJoined}>{joinedLabel}</Text>}
        </View>
        {canEdit && !isMe && member.role !== 'owner' && (
          <Pressable
            style={styles.changeRoleBtn}
            onPress={() => onChangeRole(member)}
            accessible
            accessibilityRole="button"
            hitSlop={{ top: ms(12), bottom: ms(12), left: ms(12), right: ms(12) }}
          >
            <Text style={styles.changeRoleBtnText}>{t('members.change_role')}</Text>
          </Pressable>
        )}
      </View>

      {canEdit && !isMe && (
        <View style={styles.permWrap}>
          <Text style={styles.permTitle}>{t('members.what_can_see', { name: member.name })}</Text>
          {PERMISSION_KEYS.map(({ key, tKey, icon }) => (
            <View key={key} style={styles.permRow}>
              <Ionicons name={icon} size={16} color={C.textSecondary} style={styles.permIcon} />
              <Text style={styles.permLabel}>{t(tKey)}</Text>
              <Switch
                value={member.permissions[key]}
                onValueChange={(v) => onTogglePermission(member.memberId, key, v)}
                accessible
                accessibilityRole="switch"
                accessibilityLabel={t('members.toggle_permission', {
                  name: member.name,
                  permission: t(tKey),
                })}
                accessibilityState={{ checked: member.permissions[key] }}
                trackColor={{ false: C.border, true: C.primary + '80' }}
                thumbColor={member.permissions[key] ? C.primary : C.textDisabled}
                activeThumbColor={C.primary}
                style={styles.switchLtr}
              />
            </View>
          ))}
        </View>
      )}

      {isMe && <Text style={styles.permNote}>{t('members.your_permissions_note')}</Text>}
    </View>
  );
}

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
  const headingFont = useHeadingFont('bold');

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
      const options: MemberRole[] = member.role === 'admin' ? ['member'] : ['admin', 'member'];
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
    [updateRole, t]
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
              <Text style={[styles.screenTitle, headingFont]}>{t('members.title')}</Text>
              <Text style={styles.screenSub}>{t('members.subtitle')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <MemberCard
              member={item}
              isMe={item.id === myUserId}
              canEdit={canEdit}
              onTogglePermission={handleToggle}
              onChangeRole={handleChangeRole}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: sizes.md }} />}
          ListEmptyComponent={<Text style={styles.empty}>{t('members.no_members')}</Text>}
        />
      </View>
    </SafeAreaView>
  );
}
