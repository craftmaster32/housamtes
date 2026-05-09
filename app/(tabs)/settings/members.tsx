import { useEffect, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, FlatList, Switch, Alert, Animated } from 'react-native';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore, type Housemate, type MemberPermissions, type MemberRole } from '@stores/housematesStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';

const PERMISSION_LABELS: Array<{ key: keyof MemberPermissions; label: string; icon: string }> = [
  { key: 'bills',       label: 'Bills & Payments',   icon: '💰' },
  { key: 'grocery',     label: 'Grocery List',        icon: '🛒' },
  { key: 'parking',     label: 'Parking',             icon: '🚗' },
  { key: 'chores',      label: 'Chores',              icon: '🧹' },
  { key: 'chat',        label: 'House Chat',          icon: '💬' },
  { key: 'photos',      label: 'Photos',              icon: '📷' },
  { key: 'voting',      label: 'Voting',              icon: '🗳️' },
  { key: 'maintenance', label: 'Maintenance',         icon: '🔧' },
  { key: 'condition',   label: 'Property Condition',  icon: '📋' },
];

const makeStyles = (C: ColorTokens) => StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    list: { padding: sizes.lg, paddingBottom: 60, gap: 0 },

    screenTitle: { fontSize: 24, ...font.extrabold, color: C.textPrimary, letterSpacing: -0.5, marginBottom: 6 },
    screenSub:   { fontSize: 14, ...font.regular, color: C.textSecondary, lineHeight: 20, marginBottom: sizes.lg },

    memberCard: {
      backgroundColor: C.surface, borderRadius: sizes.borderRadiusLg,
      borderWidth: 1, borderColor: C.border, overflow: 'hidden',
    },
    memberHeader: { flexDirection: 'row', alignItems: 'center', padding: sizes.md, gap: sizes.sm },
    memberAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    memberAvatarImg: { width: 44, height: 44 },
    memberAvatarText: { color: '#FFF', fontSize: 18, ...font.bold },
    memberMeta:   { flex: 1 },
    memberName:   { fontSize: 16, ...font.semibold, color: C.textPrimary },
    memberRole:   { fontSize: 13, ...font.regular, color: C.textSecondary, marginTop: 1 },
    changeRoleBtn:     { paddingHorizontal: 8, paddingVertical: 4 },
    changeRoleBtnText: { fontSize: 13, ...font.semibold, color: C.primary },

    permWrap:  { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, paddingHorizontal: sizes.md, paddingBottom: sizes.md, paddingTop: sizes.sm, gap: 2 },
    permTitle: { fontSize: 12, ...font.bold, color: C.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: sizes.sm },
    permRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
    permIcon:  { fontSize: 16, width: 28 },
    permLabel: { flex: 1, fontSize: 14, ...font.regular, color: C.textPrimary },
    permNote:  { fontSize: 13, ...font.regular, color: C.textSecondary, padding: sizes.md, paddingTop: 0, fontStyle: 'italic' },

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
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const roleLabel = member.role === 'owner' ? '👑 Owner' : member.role === 'admin' ? '🛡 Admin' : 'Member';

  return (
    <View style={styles.memberCard}>
      <View style={styles.memberHeader}>
        <View style={[styles.memberAvatar, { backgroundColor: member.avatarUrl ? 'transparent' : member.color }]}>
          {member.avatarUrl
            ? <Image source={{ uri: member.avatarUrl }} style={styles.memberAvatarImg} contentFit="cover" />
            : <Text style={styles.memberAvatarText}>{member.name[0].toUpperCase()}</Text>
          }
        </View>
        <View style={styles.memberMeta}>
          <Text style={styles.memberName}>{member.name}{isMe ? ' (you)' : ''}</Text>
          <Text style={styles.memberRole}>{roleLabel}</Text>
        </View>
        {canEdit && !isMe && member.role !== 'owner' && (
          <View style={styles.changeRoleBtn}>
            <Text style={styles.changeRoleBtnText} onPress={() => onChangeRole(member)}>
              Change role ›
            </Text>
          </View>
        )}
      </View>

      {canEdit && !isMe && (
        <View style={styles.permWrap}>
          <Text style={styles.permTitle}>What can {member.name} see?</Text>
          {PERMISSION_LABELS.map(({ key, label, icon }) => (
            <View key={key} style={styles.permRow}>
              <Text style={styles.permIcon}>{icon}</Text>
              <Text style={styles.permLabel}>{label}</Text>
              <Switch
                value={member.permissions[key]}
                onValueChange={(v) => onTogglePermission(member.memberId, key, v)}
                trackColor={{ false: C.border, true: C.primary + '80' }}
                thumbColor={member.permissions[key] ? C.primary : C.textDisabled}
              />
            </View>
          ))}
        </View>
      )}

      {isMe && (
        <Text style={styles.permNote}>Your own permissions are managed by the house owner.</Text>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function MembersScreen(): React.JSX.Element {
  const myUserId   = useAuthStore((s) => s.user?.id);
  const myRole     = useAuthStore((s) => s.role);
  const houseId    = useAuthStore((s) => s.houseId);
  const housemates = useHousematesStore((s) => s.housemates);
  const load       = useHousematesStore((s) => s.load);
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

  const handleToggle = useCallback(async (memberId: string, key: keyof MemberPermissions, value: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    const member = housemates.find((h) => h.memberId === memberId);
    if (!member) return;
    const newPerms = { ...member.permissions, [key]: value };
    await updatePermissions(memberId, newPerms);
  }, [housemates, updatePermissions]);

  const handleChangeRole = useCallback((member: Housemate) => {
    const options: MemberRole[] = member.role === 'admin' ? ['member'] : ['admin', 'member'];
    const labels: Record<MemberRole, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' };
    Alert.alert(
      `Change ${member.name}'s role`,
      'Admins can also manage categories and member permissions.',
      [
        ...options.map((r) => ({
          text: `Make ${labels[r]}`,
          onPress: async (): Promise<void> => {
            await updateRole(member.memberId, r);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          },
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  }, [updateRole]);

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
              <Text style={styles.screenTitle}>Member Permissions</Text>
              <Text style={styles.screenSub}>
                Control what each housemate can access in HouseMates. Owners and admins always have full access.
              </Text>
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
          ListEmptyComponent={<Text style={styles.empty}>No members found.</Text>}
        />
      </Animated.View>
    </SafeAreaView>
  );
}
