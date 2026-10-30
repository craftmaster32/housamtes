import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { LOADING_QUIP_KEYS } from '@constants/loadingQuips';
import { useHandFont } from '@hooks/useHandFont';
import { useReduceMotion } from '@hooks/useReduceMotion';
import { LoadingSpinner } from '@components/shared/LoadingSpinner';
import { mf, ms } from '@utils/responsive';

const QUIP_EVERY_MS = 2600;

interface UploadNoteProps {
  current: number;
  total: number;
}

/**
 * A small note at the bottom of Photos while pictures upload. It doesn't
 * cover the page or block taps, so you can keep scrolling — new photos pop
 * into the grid as each one finishes. Mate hops and says a funny line.
 */
export function UploadNote({ current, total }: UploadNoteProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const hand = useHandFont();
  const reduceMotion = useReduceMotion();
  const rise = useRef(new Animated.Value(0)).current;
  const [quip, setQuip] = useState(() => Math.floor(Math.random() * LOADING_QUIP_KEYS.length));

  useEffect(() => {
    Animated.timing(rise, {
      toValue: 1,
      duration: reduceMotion ? 0 : 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [rise, reduceMotion]);

  useEffect(() => {
    const id = setInterval(() => setQuip((i) => (i + 1) % LOADING_QUIP_KEYS.length), QUIP_EVERY_MS);
    return (): void => clearInterval(id);
  }, []);

  const label =
    total > 1 ? t('photos.uploading_progress', { current, total }) : t('photos.uploading');

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.note,
        { backgroundColor: c.surface, shadowColor: '#000' },
        {
          opacity: rise,
          transform: [
            { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
          ],
        },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={label}
    >
      <LoadingSpinner size={ms(58)} showQuip={false} accessibilityLabel={label} />
      <View style={styles.texts}>
        <Text style={[styles.label, { color: c.textPrimary }]}>{label}</Text>
        <Text style={[styles.quip, hand, { color: c.textSecondary }]} numberOfLines={1}>
          {t(LOADING_QUIP_KEYS[quip])}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  note: {
    position: 'absolute',
    left: ms(16),
    right: ms(16),
    bottom: ms(14),
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(10),
    paddingVertical: ms(8),
    paddingHorizontal: ms(12),
    borderRadius: ms(20),
    shadowOffset: { width: 0, height: ms(6) },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  texts: { flex: 1 },
  label: { fontSize: mf(15), ...font.semibold },
  quip: { fontSize: mf(18), lineHeight: mf(22), marginTop: 1 },
});
