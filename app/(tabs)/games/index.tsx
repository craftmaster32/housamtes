import { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { goBack } from '@stores/navigationStore';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { getDailyJoke, getRandomJoke, type DadJoke } from '@constants/dadJokes';
import { useHeadingFont } from '@hooks/useHeadingFont';

import { mf, ms } from '@utils/responsive';
// ── Dad Joke Browser ─────────────────────────────────────────────────────────
function JokeBrowser(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
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
    <Animated.View key={key} entering={FadeIn.duration(300)} style={styles.jokeContent}>
      <View style={[styles.jokeCard, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={styles.jokeHeader}>
          <View style={[styles.jokeIcon, { backgroundColor: c.primary + '18' }]}>
            <Ionicons name="happy-outline" size={18} color={c.primary} />
          </View>
          <View style={[styles.jokeCatPill, { backgroundColor: c.primary + '15' }]}>
            <Text style={[styles.jokeCatText, { color: c.primary }]}>{joke.category}</Text>
          </View>
        </View>

        <Text style={[styles.jokeSetup, { color: c.textPrimary }]}>{joke.setup}</Text>

        {revealed ? (
          <Animated.View entering={FadeIn.duration(400)}>
            <Text style={[styles.jokePunchline, { color: c.primary }]}>{joke.punchline}</Text>
          </Animated.View>
        ) : (
          <Pressable
            style={[styles.jokeRevealBtn, { backgroundColor: c.primary }]}
            onPress={handleReveal}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('games.reveal_punchline')}
          >
            <Text style={styles.jokeRevealText}>{t('games.tap_to_reveal')}</Text>
            <Ionicons name="chevron-forward" size={15} color="#fff" />
          </Pressable>
        )}
      </View>

      <Pressable
        style={[styles.jokeNextBtn, { backgroundColor: c.surfaceSecondary }]}
        onPress={handleNext}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('games.next_joke')}
      >
        <Ionicons name="refresh-outline" size={18} color={c.textSecondary} />
        <Text style={[styles.jokeNextText, { color: c.textSecondary }]}>
          {t('games.another_one')}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function GamesScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const rtl = isRTL(language);
  const c = useThemedColors();
  const headingFont = useHeadingFont();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => goBack()}
          style={styles.backBtn}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('games.go_back')}
        >
          <View style={[styles.backCircle, { borderColor: c.border, backgroundColor: c.surface }]}>
            <Ionicons
              name={rtl ? 'chevron-forward' : 'chevron-back'}
              size={22}
              color={c.textPrimary}
            />
          </View>
        </Pressable>
        <Text style={[styles.headerTitle, headingFont, { color: c.textPrimary }]}>
          {t('games.dad_jokes')}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <JokeBrowser />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sizes.md,
    paddingVertical: sizes.sm,
  },
  backBtn: { width: ms(44), height: ms(44), justifyContent: 'center', alignItems: 'center' },
  backCircle: {
    width: ms(38),
    height: ms(38),
    borderRadius: ms(19),
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: mf(20), ...font.bold },

  // ── Joke Browser ───────────────────────────────────────────────────────────
  jokeContent: {
    flex: 1,
    padding: sizes.md,
    gap: sizes.md,
  },
  jokeCard: {
    borderRadius: sizes.borderRadiusLg,
    padding: sizes.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: sizes.md,
  },
  jokeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sizes.sm,
  },
  jokeIcon: {
    width: ms(34),
    height: ms(34),
    borderRadius: ms(11),
    alignItems: 'center',
    justifyContent: 'center',
  },
  jokeCatPill: {
    paddingHorizontal: ms(10),
    paddingVertical: ms(3),
    borderRadius: sizes.borderRadiusFull,
  },
  jokeCatText: { fontSize: mf(11), ...font.bold, textTransform: 'uppercase', letterSpacing: 0.3 },
  jokeSetup: { fontSize: mf(18), ...font.semibold, lineHeight: mf(26) },
  jokePunchline: { fontSize: mf(20), ...font.bold, lineHeight: mf(28) },
  jokeRevealBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(5),
    alignSelf: 'flex-start',
    paddingStart: sizes.lg,
    paddingEnd: sizes.md,
    paddingVertical: sizes.sm + 2,
    minHeight: ms(44),
    borderRadius: sizes.borderRadius,
  },
  jokeRevealText: { fontSize: mf(14), ...font.bold, color: '#fff' },
  jokeNextBtn: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: ms(8),
    paddingHorizontal: sizes.lg,
    paddingVertical: ms(10),
    borderRadius: sizes.borderRadius,
  },
  jokeNextText: { fontSize: mf(14), ...font.semibold },
});
