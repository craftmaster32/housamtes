import { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useMemberName } from '@hooks/useMemberName';
import { useAuthStore } from '@stores/authStore';
import { UserAvatar } from '@components/shared/UserAvatar';
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
  const { height: windowHeight } = useWindowDimensions();
  const entries = useHouseActivity();
  const actionItems = useActionItems();

  // Cap the panel to the space between its top offset and the bottom inset so it
  // never runs off the bottom of the screen; the list scrolls inside that cap.
  const topOffset = insets.top + 50;
  const available = Math.max(240, windowHeight - topOffset - insets.bottom - 24);
  // Bound the scroll view itself (not just the panel) so it reliably scrolls on
  // web too; the panel then sizes to its content and can't overflow the screen.
  // ~72px accounts for the title + panel padding above the list.
  const listMaxHeight = Math.max(160, available - 72);

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
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
      >
        <Pressable
          style={[
            styles.panel,
            { top: topOffset, backgroundColor: c.surface, borderColor: c.border },
          ]}
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
            <ScrollView
              style={[styles.list, { maxHeight: listMaxHeight }]}
              showsVerticalScrollIndicator={false}
            >
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  panel: {
    position: 'absolute',
    right: 12,
    left: 12,
    maxWidth: 460,
    alignSelf: 'center',
    width: '100%',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 34,
    elevation: 14,
  },
  title: { fontSize: 22, ...font.extrabold, marginBottom: 6, letterSpacing: -0.5 },
  list: { flexGrow: 0 },
  sectionHeader: {
    fontSize: 12,
    ...font.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 11,
    paddingHorizontal: 6,
    borderRadius: 14,
  },
  avatarWrap: { width: 46, height: 46, flexShrink: 0 },
  typeBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowText: { fontSize: 15, ...font.regular, lineHeight: 20 },
  time: { fontSize: 12.5, ...font.medium, marginTop: 3 },
  actionTag: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  actionTagText: { fontSize: 11, ...font.bold, letterSpacing: 0.2 },
  unreadDot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0, marginStart: 4 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  emptyText: { fontSize: 14, ...font.medium },
});
