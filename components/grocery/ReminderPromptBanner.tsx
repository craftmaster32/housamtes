import { useState, useEffect, useRef, useMemo } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { font } from '@constants/typography';
import { useHandFont } from '@hooks/useHandFont';

import { mf, ms } from '@utils/responsive';
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
  const hand = useHandFont();
  const s = useMemo(() => makeStyles(), []);
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

  // A pink paper strip, like the reminder tag clipped to the bag.
  return (
    <Animated.View
      style={[s.banner, { opacity }]}
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
    >
      <Ionicons name="notifications-outline" size={17} color={TAG_INK} />
      <Text style={s.text} numberOfLines={1}>
        {t('grocery.reminder_prompt_added', { name: displayName })}
      </Text>
      <Pressable
        onPress={onSet}
        style={s.setBtn}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('grocery.reminder_prompt_a11y', { name: displayName })}
      >
        <Text style={[s.setBtnText, hand]}>{t('grocery.set_reminder_short')}</Text>
      </Pressable>
      <Pressable
        onPress={onDismiss}
        style={s.dismissBtn}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
      >
        <Ionicons name="close" size={17} color={TAG_INK} />
      </Pressable>
    </Animated.View>
  );
}

const TAG = '#F6D8D2';
const TAG_INK = '#8E2F28';

function makeStyles(): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(8),
      backgroundColor: TAG,
      borderRadius: ms(4),
      paddingStart: ms(14),
      paddingEnd: ms(4),
      minHeight: 48,
      transform: [{ rotate: '-0.6deg' }],
      shadowColor: '#000',
      shadowOffset: { width: 0, height: ms(4) },
      shadowOpacity: 0.14,
      shadowRadius: 8,
      elevation: 4,
    },
    text: { flex: 1, fontSize: mf(13.5), ...font.semibold, color: TAG_INK },
    setBtn: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: ms(4) },
    setBtnText: { fontSize: mf(19), color: '#3B6FBF' },
    dismissBtn: { minHeight: 44, minWidth: 40, justifyContent: 'center', alignItems: 'center' },
  });
}
