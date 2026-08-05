import { useCallback, useMemo } from 'react';
import { View, Text, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useMemberName } from '@hooks/useMemberName';
import { useAuthStore } from '@stores/authStore';
import { UserAvatar } from '@components/shared/UserAvatar';
import { mf, ms } from '@utils/responsive';
import {
  useHouseActivity,
  useActionItems,
  type ActivityEntry,
  type ActivityTone,
} from '@hooks/useHouseActivity';

interface ActivityPopupProps {
  visible: boolean;
  onClose: () => void;
  /**
   * Snapshot of lastSeen taken when the bell was opened, so rows newer than it
   * stay highlighted for this viewing even though opening marks activity seen.
   */
  seenBefore?: string;
}

function timeAgo(iso: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return t('common.just_now');
  if (mins < 60) return t('common.minutes_ago', { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('common.hours_ago', { n: hrs });
  const days = Math.floor(hrs / 24);
  return t('common.days_ago', { n: days });
}

type Bucket = 'today' | 'week' | 'earlier';

function bucketOf(iso: string): Bucket {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'today';
  const days = (now.getTime() - d.getTime()) / 86400000;
  return days < 7 ? 'week' : 'earlier';
}

export function ActivityPopup({
  visible,
  onClose,
  seenBefore = '',
}: ActivityPopupProps): React.JSX.Element {
  const c = useThemedColors();
  const { t } = useTranslation();
  const memberName = useMemberName();
  const myId = useAuthStore((s) => s.profile?.id) ?? '';
  const insets = useSafeAreaInsets();
  const entries = useHouseActivity();
  const actionItems = useActionItems();

  // Reserve the space above (header/bell) and below (home indicator) the popup
  // with padding on the full-screen backdrop. The panel is then a flex child
  // that can shrink into whatever height is left, so its inner list scrolls
  // instead of the panel running off the bottom. This is driven purely by
  // flexbox against the modal's own height — no viewport-height math, which is
  // unreliable on mobile web.
  const topPad = insets.top + 50;
  const bottomPad = insets.bottom + 16;

  const toneColor: Record<ActivityTone, string> = {
    primary: c.primary,
    success: c.positive,
    warning: c.warning,
    purple: '#9B7BFF',
  };

  // Action items already surface in the "Needs you" section — keep them out of
  // the feed below so a vote you owe isn't shown twice.
  const actionIds = useMemo(() => new Set(actionItems.map((a) => a.id)), [actionItems]);

  // Group the (already newest-first) feed into Today / This week / Earlier.
  const sections = useMemo(() => {
    const groups: Record<Bucket, ActivityEntry[]> = { today: [], week: [], earlier: [] };
    for (const e of entries) {
      if (actionIds.has(e.id)) continue;
      groups[bucketOf(e.createdAt)].push(e);
    }
    return (
      [
        { key: 'today' as const, title: t('common.today'), data: groups.today },
        { key: 'week' as const, title: t('activity.this_week'), data: groups.week },
        { key: 'earlier' as const, title: t('activity.earlier'), data: groups.earlier },
      ] as const
    ).filter((s) => s.data.length > 0);
  }, [entries, actionIds, t]);

  const handlePress = useCallback(
    (route: Href): void => {
      onClose();
      router.push(route);
    },
    [onClose]
  );

  const renderRow = (e: ActivityEntry, opts?: { needsYou?: boolean }): React.JSX.Element => {
    const color = toneColor[e.tone];
    const actor = memberName(e.actorId).split(' ')[0];
    const needsYou = opts?.needsYou ?? false;
    const unread = !needsYou && !!seenBefore && e.createdAt > seenBefore && e.actorId !== myId;
    return (
      <Pressable
        key={e.id}
        style={({ pressed }) => [
          styles.row,
          unread && { backgroundColor: c.primary + '0F' },
          pressed && { backgroundColor: c.surfaceSecondary },
        ]}
        onPress={() => handlePress(e.route)}
        accessibilityRole="button"
      >
        <View style={styles.avatarWrap}>
          <UserAvatar userId={e.actorId} size={46} />
          <View style={[styles.typeBadge, { backgroundColor: color, borderColor: c.surface }]}>
            <Ionicons name={e.icon} size={11} color="#fff" />
          </View>
        </View>
        <View style={styles.rowBody}>
          <Text style={[styles.rowText, { color: c.textPrimary }]} numberOfLines={2}>
            <Text style={font.bold}>{actor}</Text> {t(e.actionKey)}
            {!!e.detail && <Text style={font.semibold}> {e.detail}</Text>}
          </Text>
          {needsYou ? (
            <View style={[styles.actionTag, { backgroundColor: color + '22' }]}>
              <Text style={[styles.actionTagText, { color }]}>{t('activity.tap_to_act')}</Text>
            </View>
          ) : (
            <Text style={[styles.time, { color: c.textTertiary }]}>{timeAgo(e.createdAt, t)}</Text>
          )}
        </View>
        {unread && <View style={[styles.unreadDot, { backgroundColor: c.primary }]} />}
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[styles.backdrop, { paddingTop: topPad, paddingBottom: bottomPad }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
      >
        <Pressable
          style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}
          onPress={() => {}}
          accessible={false}
        >
          <Text style={[styles.title, { color: c.textPrimary }]}>{t('activity.title')}</Text>

          {sections.length === 0 && actionItems.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={26} color={c.textTertiary} />
              <Text style={[styles.emptyText, { color: c.textSecondary }]}>
                {t('activity.empty')}
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {actionItems.length > 0 && (
                <View>
                  <Text style={[styles.sectionHeader, { color: c.primary }]}>
                    {t('activity.needs_you')}
                  </Text>
                  {actionItems.map((e) => renderRow(e, { needsYou: true }))}
                </View>
              )}
              {sections.map((s) => (
                <View key={s.key}>
                  <Text style={[styles.sectionHeader, { color: c.textSecondary }]}>{s.title}</Text>
                  {s.data.map((e) => renderRow(e))}
                </View>
              ))}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: ms(12),
    alignItems: 'center',
  },
  panel: {
    width: '100%',
    maxWidth: ms(460),
    // Allow the panel to shrink into the space the backdrop padding leaves, so
    // the inner list scrolls rather than the panel overflowing the screen.
    flexShrink: 1,
    minHeight: 0,
    borderRadius: ms(22),
    overflow: 'hidden',
    borderWidth: 1,
    paddingHorizontal: ms(16),
    paddingTop: ms(18),
    paddingBottom: ms(10),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(14) },
    shadowOpacity: 0.28,
    shadowRadius: 34,
    elevation: 14,
  },
  title: { fontSize: mf(22), ...font.extrabold, marginBottom: ms(6), letterSpacing: -0.5 },
  // flexShrink lets the list give up height so the panel fits; minHeight:0 is
  // required for that shrink to work on web (default min-height:auto blocks it).
  list: { flexGrow: 0, flexShrink: 1, minHeight: 0 },
  sectionHeader: {
    fontSize: mf(12),
    ...font.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: ms(12),
    marginBottom: ms(2),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(13),
    paddingVertical: ms(11),
    paddingHorizontal: ms(6),
    borderRadius: ms(14),
  },
  avatarWrap: { width: ms(46), height: ms(46), flexShrink: 0 },
  typeBadge: {
    position: 'absolute',
    right: ms(-2),
    bottom: ms(-2),
    width: ms(20),
    height: ms(20),
    borderRadius: ms(10),
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowText: { fontSize: mf(15), ...font.regular, lineHeight: mf(20) },
  time: { fontSize: mf(12.5), ...font.medium, marginTop: ms(3) },
  actionTag: {
    alignSelf: 'flex-start',
    marginTop: ms(4),
    paddingHorizontal: ms(8),
    paddingVertical: ms(2),
    borderRadius: 9999,
  },
  actionTagText: { fontSize: mf(11), ...font.bold, letterSpacing: 0.2 },
  unreadDot: {
    width: ms(9),
    height: ms(9),
    borderRadius: ms(5),
    flexShrink: 0,
    marginStart: ms(4),
  },
  empty: { alignItems: 'center', gap: ms(10), paddingVertical: ms(40) },
  emptyText: { fontSize: mf(14), ...font.medium },
});
