import { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';
import { getDailyJoke, getRandomJoke, type DadJoke } from '@constants/dadJokes';

const CATEGORY_EMOJI: Record<DadJoke['category'], string> = {
  bills: '💸',
  parking: '🚗',
  chores: '🧹',
  grocery: '🛒',
  house: '🏠',
  general: '😄',
};

export function DadJokeCard(): React.JSX.Element {
  const c = useThemedColors();
  const { t } = useTranslation();
  const [joke, setJoke] = useState<DadJoke>(getDailyJoke);
  const [revealed, setRevealed] = useState(false);
  const [key, setKey] = useState(0);

  const handleReveal = useCallback((): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setRevealed(true);
  }, []);

  const handleNext = useCallback((): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setJoke(getRandomJoke());
    setRevealed(false);
    setKey((k) => k + 1);
  }, []);

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.header}>
        <Text style={styles.emoji}>{CATEGORY_EMOJI[joke.category]}</Text>
        <Text style={[styles.title, { color: c.textPrimary }]}>{t('games.dad_joke_of_the_day')}</Text>
        <View style={[styles.categoryPill, { backgroundColor: c.primary + '18' }]}>
          <Text style={[styles.categoryText, { color: c.primary }]}>{joke.category}</Text>
        </View>
      </View>

      <Animated.View key={key} entering={FadeIn.duration(300)}>
        <Text style={[styles.setup, { color: c.textPrimary }]}>{joke.setup}</Text>

        {revealed ? (
          <Animated.View entering={FadeIn.duration(400)}>
            <Text style={[styles.punchline, { color: c.primary }]}>{joke.punchline}</Text>
          </Animated.View>
        ) : (
          <Pressable
            style={[styles.revealBtn, { backgroundColor: c.primary + '15' }]}
            onPress={handleReveal}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('games.reveal_punchline')}
          >
            <Text style={[styles.revealText, { color: c.primary }]}>{t('games.tap_to_reveal')}</Text>
          </Pressable>
        )}
      </Animated.View>

      {revealed && (
        <Animated.View entering={FadeIn.duration(300)}>
          <Pressable
            style={[styles.nextBtn, { backgroundColor: c.surfaceSecondary }]}
            onPress={handleNext}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('games.next_joke')}
          >
            <Text style={[styles.nextText, { color: c.textSecondary }]}>{t('games.another_one')}</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: sizes.borderRadiusLg,
    padding: sizes.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: sizes.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sizes.sm,
  },
  emoji: { fontSize: 20 },
  title: { fontSize: 15, ...font.semibold, flex: 1 },
  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: sizes.borderRadiusFull,
  },
  categoryText: { fontSize: 11, ...font.semibold, textTransform: 'capitalize' },
  setup: { fontSize: 15, ...font.medium, lineHeight: 22, marginTop: sizes.xs },
  punchline: { fontSize: 16, ...font.bold, lineHeight: 24, marginTop: sizes.sm },
  revealBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: sizes.md,
    paddingVertical: sizes.sm,
    borderRadius: sizes.borderRadius,
    marginTop: sizes.sm,
  },
  revealText: { fontSize: 14, ...font.semibold },
  nextBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: sizes.md,
    paddingVertical: 6,
    borderRadius: sizes.borderRadius,
    marginTop: sizes.xs,
  },
  nextText: { fontSize: 13, ...font.medium },
});
