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

import { mf, ms } from '@utils/responsive';
// Screens where the floating button would sit on top of a form. The house
// chat is one tap away from the tab bar on these, and on iOS web the button
// jumps up over the amount field when the keyboard opens — so hide it here.
const HIDDEN_ON = [
  '/more/chat',
  '/grocery/shop',
  '/grocery/quick-buy',
  '/bills/', // add-expense, bill detail, and setup (not the bills list itself)
];

/**
 * Floating chat button — sits above the bottom tab bar on every main screen and
 * opens the house chat. Hidden on the chat screen and on expense/checkout forms
 * so it never covers their inputs. Carries an unread-message badge.
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

  // Don't overlay the chat screen or expense/checkout forms.
  if (HIDDEN_ON.some((p) => pathname.includes(p))) return null;

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
        accessibilityLabel={
          unread > 0
            ? `${t('nav.chat')}, ${t('chat.unread_label', { count: unread })}`
            : t('nav.chat')
        }
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
  wrap: { position: 'absolute', right: ms(16), zIndex: 30 },
  fab: {
    width: ms(52),
    height: ms(52),
    borderRadius: ms(26),
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: ms(8) },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 10,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.94 }] },
  badge: {
    position: 'absolute',
    top: ms(-3),
    right: ms(-3),
    minWidth: ms(19),
    height: ms(19),
    borderRadius: ms(10),
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(5),
  },
  badgeText: { fontSize: mf(11), fontWeight: '800', color: '#fff' },
});
