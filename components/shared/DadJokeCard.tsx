import { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { getDailyJoke, getRandomJoke, type DadJoke } from '@constants/dadJokes';
import { Mate } from '@components/shared/Mate';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';

import { mf, ms } from '@utils/responsive';
interface Props {
  animateEntrance?: boolean;
}

// The daily joke, told by Mate from a speech bubble.
export function DadJokeCard({ animateEntrance = true }: Props): React.JSX.Element {
  const c = useThemedColors();
  const { t } = useTranslation();
  const headingFont = useHeadingFont('semibold');
  const handFont = useHandFont();
  const arrow = isRTL(useLanguageStore((st) => st.language)) ? '←' : '→';
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
    <View>
      <View style={styles.header}>
        <Text style={[styles.title, headingFont, { color: c.textPrimary }]}>
          {t('games.dad_joke_of_the_day')}
        </Text>
        <Text style={[styles.category, { color: c.textSecondary }]}>
          {t(`games.joke_cat_${joke.category}`, { defaultValue: joke.category })}
        </Text>
      </View>

      <View style={styles.row}>
        <Mate size={ms(68)} wave={animateEntrance} />
        <View style={[styles.bubble, { backgroundColor: c.surface }]}>
          <Animated.View
            key={key}
            entering={animateEntrance || key > 0 ? FadeIn.duration(300) : undefined}
          >
            <Text style={[styles.setup, { color: c.textPrimary }]}>{joke.setup}</Text>

            {revealed ? (
              <Animated.View entering={FadeIn.duration(400)}>
                <Text style={[styles.punchline, { color: c.primary }]}>{joke.punchline}</Text>
              </Animated.View>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.revealBtn, pressed && styles.pressed]}
                onPress={handleReveal}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('games.tap_to_reveal')}
              >
                <Text style={[styles.revealText, handFont, { color: c.primary }]}>
                  {t('games.tap_to_reveal')} {arrow}
                </Text>
              </Pressable>
            )}
          </Animated.View>

          {revealed && (
            <Animated.View entering={FadeIn.duration(300)}>
              <Pressable
                style={({ pressed }) => [
                  styles.nextBtn,
                  { backgroundColor: c.surfaceSecondary },
                  pressed && styles.pressed,
                ]}
                onPress={handleNext}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('games.another_one')}
              >
                <Text style={[styles.nextText, { color: c.textPrimary }]}>
                  {t('games.another_one')}
                </Text>
              </Pressable>
            </Animated.View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: ms(12),
    marginBottom: ms(12),
    marginHorizontal: ms(2),
  },
  title: { flexShrink: 1, fontSize: mf(22), letterSpacing: -0.4 },
  category: { fontSize: mf(13), ...font.semibold },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: ms(6) },
  // Speech bubble: the corner nearest Mate is tucked in so it reads as his.
  bubble: {
    flex: 1,
    minWidth: 0,
    borderRadius: ms(22),
    borderBottomStartRadius: ms(6),
    paddingHorizontal: ms(18),
    paddingVertical: ms(14),
  },
  setup: { fontSize: mf(16), ...font.regular, lineHeight: mf(23) },
  punchline: { fontSize: mf(16), ...font.bold, lineHeight: mf(23), marginTop: ms(8) },
  revealBtn: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    marginTop: ms(2),
    marginBottom: ms(-8),
  },
  revealText: { fontSize: mf(22) },
  nextBtn: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: ms(16),
    borderRadius: 9999,
    marginTop: ms(12),
  },
  nextText: { fontSize: mf(14), ...font.bold },
  pressed: { opacity: 0.7 },
});
