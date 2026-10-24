import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { Housemate, MemberPermissions } from '@stores/housematesStore';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { InkTickBox } from '@components/shared/InkTickBox';
import { mf, ms } from '@utils/responsive';

const PERMISSION_KEYS: Array<{ key: keyof MemberPermissions; tKey: string }> = [
  { key: 'bills', tKey: 'members.perm_bills' },
  { key: 'grocery', tKey: 'members.perm_grocery' },
  { key: 'parking', tKey: 'members.perm_parking' },
  { key: 'chores', tKey: 'members.perm_chores' },
  { key: 'chat', tKey: 'members.perm_chat' },
  { key: 'photos', tKey: 'members.perm_photos' },
  { key: 'voting', tKey: 'members.perm_voting' },
  { key: 'maintenance', tKey: 'members.perm_maintenance' },
  { key: 'condition', tKey: 'members.perm_condition' },
];

interface MemberCardProps {
  member: Housemate;
  isMe: boolean;
  canEdit: boolean;
  iAmOwner: boolean;
  onTogglePermission: (memberId: string, key: keyof MemberPermissions, value: boolean) => void;
  onChangeRole: (member: Housemate) => void;
}

/** A housemate: photo, name, role in handwriting, and what they can see as a tick list. */
function MemberCardComponent({
  member,
  isMe,
  canEdit,
  iAmOwner,
  onTogglePermission,
  onChangeRole,
}: MemberCardProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const c = useThemedColors();
  const heading = useHeadingFont('semibold');
  const hand = useHandFont();
  const joined = member.joinedAt
    ? t('members.joined', {
        date: new Date(member.joinedAt).toLocaleDateString(i18n.language, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
      })
    : null;
  const roleIcon =
    member.role === 'owner' ? 'star' : member.role === 'admin' ? 'shield-checkmark' : null;
  const roleLabel =
    member.role === 'owner'
      ? t('members.owner')
      : member.role === 'admin'
        ? t('members.admin')
        : t('members.member');

  return (
    <View style={[styles.card, { backgroundColor: c.surface }]}>
      <View style={styles.head}>
        <View
          style={[styles.avatar, { backgroundColor: member.avatarUrl ? c.border : member.color }]}
        >
          {member.avatarUrl ? (
            <Image
              source={{ uri: member.avatarUrl }}
              style={styles.avatarImg}
              contentFit="cover"
              accessibilityLabel={t('profile.profile_photo_of', { name: member.name })}
            />
          ) : (
            <Text style={[styles.initial, heading]}>{member.name[0]?.toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.meta}>
          <Text style={[styles.name, heading, { color: c.textPrimary }]} numberOfLines={1}>
            {isMe ? t('members.name_with_you', { name: member.name }) : member.name}
          </Text>
          <View style={styles.roleRow}>
            {roleIcon && <Ionicons name={roleIcon} size={13} color={c.warning} />}
            <Text style={[styles.role, hand, { color: c.textSecondary }]}>
              {roleLabel}
              {joined ? ` · ${joined}` : ''}
            </Text>
          </View>
        </View>
        {canEdit && !isMe && (member.role !== 'owner' || iAmOwner) && (
          <Pressable
            style={styles.link}
            onPress={() => onChangeRole(member)}
            accessibilityRole="button"
            accessibilityLabel={t('members.change_role')}
          >
            <Text style={[styles.linkText, { color: c.primary }]}>{t('members.change_role')}</Text>
          </Pressable>
        )}
      </View>

      {canEdit && !isMe && (
        <View style={[styles.perms, { borderTopColor: c.border }]}>
          <Text style={[styles.permTitle, { color: c.textSecondary }]}>
            {t('members.what_can_see', { name: member.name })}
          </Text>
          <View style={styles.grid}>
            {PERMISSION_KEYS.map(({ key, tKey }) => (
              <View key={key} style={styles.perm}>
                <InkTickBox
                  checked={member.permissions[key]}
                  onChange={(v) => onTogglePermission(member.memberId, key, v)}
                  accessibilityLabel={t('members.toggle_permission', {
                    name: member.name,
                    permission: t(tKey),
                  })}
                />
                <Text style={[styles.permLabel, { color: c.textPrimary }]} numberOfLines={2}>
                  {t(tKey)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {isMe && (
        <Text style={[styles.note, hand, { color: c.textSecondary }]}>
          {t('members.your_permissions_note')}
        </Text>
      )}
    </View>
  );
}

export const MemberCard = React.memo(MemberCardComponent);

const AVATAR = ms(48);

const styles = StyleSheet.create({
  card: { borderRadius: ms(22), padding: ms(16) },
  head: { flexDirection: 'row', alignItems: 'center', gap: ms(12) },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: AVATAR, height: AVATAR },
  initial: { fontSize: mf(20), lineHeight: mf(26), color: '#FFFFFF' },
  meta: { flex: 1, minWidth: 0 },
  name: { fontSize: mf(19), lineHeight: mf(25) },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: ms(5) },
  role: { fontSize: mf(17), lineHeight: mf(20), flexShrink: 1 },
  link: { minHeight: 44, justifyContent: 'center', paddingStart: ms(8) },
  linkText: { fontSize: mf(14), ...font.semibold },
  perms: { borderTopWidth: 1, marginTop: ms(14), paddingTop: ms(10) },
  permTitle: { fontSize: mf(13), ...font.semibold, marginBottom: ms(2) },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  perm: { width: '50%', flexDirection: 'row', alignItems: 'center', marginStart: -ms(10) },
  permLabel: { flex: 1, fontSize: mf(14), lineHeight: mf(18), ...font.medium, paddingEnd: ms(6) },
  note: { fontSize: mf(17), lineHeight: mf(21), marginTop: ms(10) },
});
