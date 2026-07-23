import { useCallback } from 'react';
import { StyleSheet, Pressable } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Text } from 'react-native-paper';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '@stores/chatStore';
import { useThemedColors } from '@constants/colors';
import { sizes } from '@constants/sizes';

/**
 * Floating chat button — sits above the bottom tab bar on every main screen and
 * opens the house chat. Hidden while already on the chat screen. Carries an
 * unread-message badge.
 */
export function ChatFab(): React.JSX.Element | null {
  const { t } = useTranslation();
  const c = useThemedColors();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const unread = useChatStore((s) => s.unreadCount);

  const handlePress = useCallback((): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push('/(tabs)/more/chat');
  }, []);

  // Don't overlay the chat screen with a button that opens the chat.
  if (pathname.includes('/more/chat')) return null;

  const bottom = Math.max(insets.bottom, 12) + sizes.bottomTabBarHeight - 4;

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[styles.wrap, { bottom }]}
      pointerEvents="box-none"
    >
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: c.primary, shadowColor: c.owedShadow },
          pressed && styles.pressed,
        ]}
        onPress={handlePress}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('nav.chat')}
      >
        <Ionicons name="chatbubble-ellipses-outline" size={24} color="#fff" />
        {unread > 0 && (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={[styles.badge, { backgroundColor: c.danger, borderColor: c.background }]}
          >
            <Text style={styles.badgeText}>{unread > 9 ? '9+' : String(unread)}</Text>
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 16, zIndex: 30 },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 10,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.94 }] },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
});
