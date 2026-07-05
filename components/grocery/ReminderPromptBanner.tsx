import { useState, useEffect, useRef, useMemo } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';

export interface ReminderPromptBannerProps {
  /** Name of the item to offer a reminder for; null hides the banner. */
  itemName: string | null;
  onSet: () => void;
  onDismiss: () => void;
}

// Keeps rendering the last non-null name while fading out, so the fade-out
// animation has text to show instead of the banner vanishing instantly.
export function ReminderPromptBanner({
  itemName,
  onSet,
  onDismiss,
}: ReminderPromptBannerProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const C = useThemedColors();
  const s = useMemo(() => makeStyles(C), [C]);
  const opacity = useRef(new Animated.Value(0)).current;
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    if (itemName) {
      setDisplayName(itemName);
      if (Platform.OS !== 'web') {
        AccessibilityInfo.announceForAccessibility(
          t('grocery.reminder_prompt_added', { name: itemName })
        );
      }
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(
        ({ finished }) => {
          if (finished && isActive) setDisplayName(null);
        }
      );
    }
    return (): void => {
      isActive = false;
    };
  }, [itemName, opacity, t]);

  if (!displayName) return null;

  return (
    <Animated.View
      style={[s.banner, { opacity, backgroundColor: C.surface, borderColor: C.border }]}
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
    >
      <Ionicons name="alarm-outline" size={16} color={C.primary} />
      <Text style={[s.text, { color: C.textPrimary }]} numberOfLines={1}>
        {t('grocery.reminder_prompt_added', { name: displayName })}
      </Text>
      <Pressable
        onPress={onSet}
        style={s.setBtn}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('grocery.reminder_prompt_a11y', { name: displayName })}
      >
        <Text style={[s.setBtnText, { color: C.primary }]}>{t('grocery.set_reminder_short')}</Text>
      </Pressable>
      <Pressable
        onPress={onDismiss}
        style={s.dismissBtn}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
      >
        <Ionicons name="close" size={16} color={C.textSecondary} />
      </Pressable>
    </Animated.View>
  );
}

function makeStyles(C: ColorTokens): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 14,
      borderWidth: 1,
      paddingLeft: 14,
      paddingRight: 6,
      minHeight: 44,
      shadowColor: C.textPrimary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 4,
    },
    text: { flex: 1, fontSize: 13, ...font.medium },
    setBtn: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
    setBtnText: { fontSize: 13, ...font.bold },
    dismissBtn: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  });
}
