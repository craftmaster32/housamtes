import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useProfilePopupStore } from '@stores/profilePopupStore';
import { useBadgeStore } from '@stores/badgeStore';
import { useHouseActivity, useActionItems } from '@hooks/useHouseActivity';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { ActivityPopup } from '@components/dashboard/ActivityPopup';
import { mf, ms } from '@utils/responsive';

function greetingWord(t: (key: string) => string): string {
  const h = new Date().getHours();
  const timeKey = h < 12 ? 'greeting_morning' : h < 18 ? 'greeting_afternoon' : 'greeting_evening';
  return t(`dashboard.${timeKey}`);
}

// Avatar + house name + bell on one quiet line, then the greeting set large
// on its own so it never has to truncate.
export function DashboardHeader(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const headingFont = useHeadingFont('semibold');
  const profile = useAuthStore((s) => s.profile);
  const houseName = useHousematesStore((s) => s.houseName);
  const openProfile = useProfilePopupStore((s) => s.open);
  // The dashboard avatar sits on the leading edge, so anchor the menu there.
  const handleOpenProfile = useCallback((): void => openProfile('start'), [openProfile]);

  const activity = useHouseActivity();
  const actionItems = useActionItems();
  const lastSeenActivity = useBadgeStore((s) => s.lastSeen.activity);
  const markActivitySeen = useBadgeStore((s) => s.markSeen);
  const [showActivity, setShowActivity] = useState(false);
  const [seenBefore, setSeenBefore] = useState('');
  const myName = profile?.name ?? 'there';
  const myId = profile?.id ?? '';
  const initials = myName.charAt(0).toUpperCase();
  // Unread "news" clears when the bell is opened; action items (votes you owe,
  // parking requests awaiting you) persist in the badge until you act on them.
  const actionIds = useMemo(() => new Set(actionItems.map((a) => a.id)), [actionItems]);
  const unreadNews = activity.filter(
    (e) => e.createdAt > lastSeenActivity && e.actorId !== myId && !actionIds.has(e.id)
  ).length;
  const newActivity = actionItems.length + unreadNews;
  const openActivity = useCallback((): void => {
    setSeenBefore(lastSeenActivity);
    setShowActivity(true);
    markActivitySeen('activity').catch(() => {});
  }, [markActivitySeen, lastSeenActivity]);
  const closeActivity = useCallback((): void => setShowActivity(false), []);

  return (
    <>
      <View style={styles.top}>
        <Pressable
          style={({ pressed }) => [
            styles.avatar,
            {
              backgroundColor: profile?.avatarUrl
                ? 'transparent'
                : (profile?.avatarColor ?? c.primary),
            },
            pressed && styles.pressed,
          ]}
          onPress={handleOpenProfile}
          hitSlop={ms(6)}
          accessibilityRole="button"
          accessibilityLabel={t('dashboard.open_profile')}
        >
          {profile?.avatarUrl ? (
            <Image
              source={{ uri: profile.avatarUrl }}
              style={styles.avatarImg}
              contentFit="cover"
            />
          ) : (
            <Text style={styles.avatarText}>{initials}</Text>
          )}
        </Pressable>

        <Text style={[styles.house, { color: c.textSecondary }]} numberOfLines={1}>
          {houseName ?? ''}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.bell,
            { backgroundColor: c.surface },
            pressed && styles.pressed,
          ]}
          onPress={openActivity}
          hitSlop={ms(6)}
          accessibilityRole="button"
          accessibilityLabel={t('activity.title')}
        >
          <Ionicons name="notifications-outline" size={21} color={c.textPrimary} />
          {newActivity > 0 && (
            <View style={[styles.badge, { backgroundColor: c.danger, borderColor: c.surface }]}>
              <Text style={styles.badgeText}>{newActivity > 9 ? '9+' : newActivity}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <Text
        style={[styles.greeting, headingFont, { color: c.textPrimary }]}
        accessibilityRole="header"
      >
        {`${greetingWord(t)},\n${myName}`}
      </Text>

      <ActivityPopup visible={showActivity} seenBefore={seenBefore} onClose={closeActivity} />
    </>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: ms(12), paddingTop: ms(8) },
  avatar: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { fontSize: mf(17), ...font.bold, color: '#fff' },
  house: { flex: 1, minWidth: 0, fontSize: mf(15), ...font.semibold },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: ms(4),
    right: ms(3),
    minWidth: ms(17),
    height: ms(17),
    borderRadius: ms(9),
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(3),
  },
  badgeText: { fontSize: mf(10), ...font.bold, color: '#fff' },
  greeting: {
    fontSize: mf(36),
    lineHeight: mf(40),
    letterSpacing: -1,
    marginTop: ms(20),
  },
  pressed: { opacity: 0.85 },
});
