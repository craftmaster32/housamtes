import { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useThemedColors, darkColors } from '@constants/colors';
import { font } from '@constants/typography';
import { getDailyJoke, getRandomJoke, type DadJoke } from '@constants/dadJokes';
import { Nesti } from '@components/shared/Nesti';
import { DashboardSectionTitle } from '@components/dashboard/DashboardSectionTitle';

import { mf, ms } from '@utils/responsive';
interface Props {
  animateEntrance?: boolean;
}

/** The daily joke, told by Nesti in a speech bubble. Tap to reveal the punchline. */
export function DadJokeCard({ animateEntrance = true }: Props): React.JSX.Element {
  const c = useThemedColors();
  const isDark = c.background === darkColors.background;
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
    <View>
      <DashboardSectionTitle
        title={t('dashboard.nesti_joke_title')}
        right={
          <Text style={[styles.category, { color: c.textSecondary }]} numberOfLines={1}>
            {t(`games.joke_cat_${joke.category}`, { defaultValue: joke.category })}
          </Text>
        }
      />
      <View style={styles.row}>
        <Nesti mood="wink" size={ms(76)} />
        <View
          style={[
            styles.bubble,
            { backgroundColor: c.surface, borderColor: isDark ? c.border : 'transparent' },
          ]}
        >
          <Animated.View
            key={key}
            entering={animateEntrance || key > 0 ? FadeIn.duration(300) : undefined}
          >
            <Text style={[styles.setup, { color: c.textPrimary }]}>{joke.setup}</Text>

            {revealed ? (
              <Animated.View entering={FadeIn.duration(400)}>
                <Text style={[styles.punchline, { color: c.textPrimary }]}>{joke.punchline}</Text>
              </Animated.View>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.revealBtn,
                  { backgroundColor: c.primaryTint },
                  pressed && styles.pressed,
                ]}
                onPress={handleReveal}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('games.tap_to_reveal')}
              >
                <Text
                  style={[styles.revealText, { color: isDark ? c.primaryLight : c.primaryDark }]}
                >
                  {t('games.tap_to_reveal')}
                </Text>
              </Pressable>
            )}
          </Animated.View>

          {revealed && (
            <Animated.View entering={FadeIn.duration(300)}>
              <Pressable
                style={({ pressed }) => [styles.nextBtn, pressed && styles.pressed]}
                onPress={handleNext}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('games.another_one')}
              >
                <Text style={[styles.nextText, { color: isDark ? c.primaryLight : c.primary }]}>
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
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: ms(6) },
  category: { fontSize: mf(13), ...font.medium, maxWidth: '40%' },
  // A speech bubble: soft everywhere except the corner pointing at Nesti.
  bubble: {
    flex: 1,
    minWidth: 0,
    borderRadius: ms(22),
    borderBottomLeftRadius: ms(6),
    borderWidth: 1,
    paddingHorizontal: ms(16),
    paddingVertical: ms(14),
    gap: ms(4),
  },
  setup: { fontSize: mf(16), ...font.regular, lineHeight: mf(23) },
  punchline: { fontSize: mf(16), ...font.semibold, lineHeight: mf(23), marginTop: ms(8) },
  revealBtn: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: ms(16),
    borderRadius: ms(22),
    marginTop: ms(10),
  },
  revealText: { fontSize: mf(14), ...font.semibold },
  nextBtn: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 },
  nextText: { fontSize: mf(14), ...font.semibold },
  pressed: { opacity: 0.8 },
});
