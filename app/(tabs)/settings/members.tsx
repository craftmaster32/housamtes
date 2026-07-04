import { useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Switch,
  Animated,
  Pressable,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
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
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';

const PERMISSION_KEYS: Array<{ key: keyof MemberPermissions; tKey: string; icon: string }> = [
  { key: 'bills', tKey: 'members.perm_bills', icon: '💰' },
  { key: 'grocery', tKey: 'members.perm_grocery', icon: '🛒' },
  { key: 'parking', tKey: 'members.perm_parking', icon: '🚗' },
  { key: 'chores', tKey: 'members.perm_chores', icon: '🧹' },
  { key: 'chat', tKey: 'members.perm_chat', icon: '💬' },
  { key: 'photos', tKey: 'members.perm_photos', icon: '📷' },
  { key: 'voting', tKey: 'members.perm_voting', icon: '🗳️' },
  { key: 'maintenance', tKey: 'members.perm_maintenance', icon: '🔧' },
  { key: 'condition', tKey: 'members.perm_condition', icon: '📋' },
];

const makeStyles = (C: ColorTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    list: { padding: sizes.lg, paddingBottom: 60, gap: 0 },
    // RNW's Switch thumb mispositions under an inherited RTL `direction`; isolate it to LTR.
    switchLtr: { writingDirection: 'ltr' } as ViewStyle,

    screenTitle: {
      fontSize: 24,
      ...font.extrabold,
      color: C.textPrimary,
      letterSpacing: -0.5,
      marginBottom: 6,
    },
    screenSub: {
      fontSize: 14,
      ...font.regular,
      color: C.textSecondary,
      lineHeight: 20,
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
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    memberAvatarImg: { width: 44, height: 44 },
    memberAvatarText: { color: '#FFF', fontSize: 18, ...font.bold },
    memberMeta: { flex: 1 },
    memberName: { fontSize: 16, ...font.semibold, color: C.textPrimary },
    memberRole: { fontSize: 13, ...font.regular, color: C.textSecondary, marginTop: 1 },
    changeRoleBtn: { paddingHorizontal: 8, paddingVertical: 4 },
    changeRoleBtnText: { fontSize: 13, ...font.semibold, color: C.primary },

    permWrap: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
      paddingHorizontal: sizes.md,
      paddingBottom: sizes.md,
      paddingTop: sizes.sm,
      gap: 2,
    },
    permTitle: {
      fontSize: 12,
      ...font.bold,
      color: C.textSecondary,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: sizes.sm,
    },
    permRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
    permIcon: { fontSize: 16, width: 28 },
    permLabel: { flex: 1, fontSize: 14, ...font.regular, color: C.textPrimary },
    permNote: {
      fontSize: 13,
      ...font.regular,
      color: C.textSecondary,
      padding: sizes.md,
      paddingTop: 0,
      fontStyle: 'italic',
    },

    empty: { textAlign: 'center', color: C.textSecondary, fontSize: 14, paddingVertical: 24 },
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
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const roleLabel =
    member.role === 'owner'
      ? `👑 ${t('members.owner')}`
      : member.role === 'admin'
        ? `🛡 ${t('members.admin')}`
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
            />
          ) : (
            <Text style={styles.memberAvatarText}>{member.name[0].toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.memberMeta}>
          <Text style={styles.memberName}>
            {isMe ? t('members.name_with_you', { name: member.name }) : member.name}
          </Text>
          <Text style={styles.memberRole}>{roleLabel}</Text>
        </View>
        {canEdit && !isMe && member.role !== 'owner' && (
          <Pressable
            style={styles.changeRoleBtn}
            onPress={() => onChangeRole(member)}
            accessible
            accessibilityRole="button"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
              <Text style={styles.permIcon}>{icon}</Text>
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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [fadeAnim]);

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
      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        <FlatList
          data={housemates}
          keyExtractor={(h) => h.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View>
              <Text style={styles.screenTitle}>{t('members.title')}</Text>
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
      </Animated.View>
    </SafeAreaView>
  );
}
