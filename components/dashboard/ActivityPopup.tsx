import { useCallback, useMemo } from 'react';
import { View, Text, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useMemberName } from '@hooks/useMemberName';
import { UserAvatar } from '@components/shared/UserAvatar';
import { useHouseActivity, type ActivityEntry, type ActivityTone } from '@hooks/useHouseActivity';

interface ActivityPopupProps {
  visible: boolean;
  onClose: () => void;
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

export function ActivityPopup({ visible, onClose }: ActivityPopupProps): React.JSX.Element {
  const c = useThemedColors();
  const { t } = useTranslation();
  const memberName = useMemberName();
  const insets = useSafeAreaInsets();
  const entries = useHouseActivity();

  const toneColor: Record<ActivityTone, string> = {
    primary: c.primary,
    success: c.positive,
    warning: c.warning,
    purple: '#9B7BFF',
  };

  // Group the (already newest-first) feed into Today / This week / Earlier.
  const sections = useMemo(() => {
    const groups: Record<Bucket, ActivityEntry[]> = { today: [], week: [], earlier: [] };
    for (const e of entries) groups[bucketOf(e.createdAt)].push(e);
    return (
      [
        { key: 'today' as const, title: t('common.today'), data: groups.today },
        { key: 'week' as const, title: t('activity.this_week'), data: groups.week },
        { key: 'earlier' as const, title: t('activity.earlier'), data: groups.earlier },
      ] as const
    ).filter((s) => s.data.length > 0);
  }, [entries, t]);

  const handlePress = useCallback(
    (route: Href): void => {
      onClose();
      router.push(route);
    },
    [onClose]
  );

  const renderRow = (e: ActivityEntry): React.JSX.Element => {
    const color = toneColor[e.tone];
    const actor = memberName(e.actorId).split(' ')[0];
    return (
      <Pressable
        key={e.id}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.surfaceSecondary }]}
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
          <Text style={[styles.time, { color: c.textTertiary }]}>{timeAgo(e.createdAt, t)}</Text>
        </View>
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
            { top: insets.top + 50, backgroundColor: c.surface, borderColor: c.border },
          ]}
          onPress={() => {}}
          accessible={false}
        >
          <Text style={[styles.title, { color: c.textPrimary }]}>{t('activity.title')}</Text>

          {sections.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={26} color={c.textTertiary} />
              <Text style={[styles.emptyText, { color: c.textSecondary }]}>
                {t('activity.empty')}
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {sections.map((s) => (
                <View key={s.key}>
                  <Text style={[styles.sectionHeader, { color: c.textSecondary }]}>{s.title}</Text>
                  {s.data.map(renderRow)}
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
    maxHeight: '84%',
    borderRadius: 22,
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
  empty: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  emptyText: { fontSize: 14, ...font.medium },
});
