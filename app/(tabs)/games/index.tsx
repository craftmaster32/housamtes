import { useState, useCallback, useRef } from 'react';
import { View, StyleSheet, Pressable, TextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, BounceIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';
import {
  scrambleWord,
  getRandomChallenge,
  CATEGORY_LABELS,
  type WordChallenge,
} from '@constants/wordGame';
import { getDailyJoke, getRandomJoke, type DadJoke } from '@constants/dadJokes';

type GameTab = 'scramble' | 'jokes';

// ── Word Scramble Game ───────────────────────────────────────────────────────
function WordScrambleGame(): React.JSX.Element {
  const c = useThemedColors();
  const [challenge, setChallenge] = useState<WordChallenge>(getRandomChallenge);
  const [scrambled, setScrambled] = useState(() => scrambleWord(challenge.word));
  const [guess, setGuess] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [round, setRound] = useState(1);
  const [key, setKey] = useState(0);
  const inputRef = useRef<TextInput>(null);

  const handleSubmit = useCallback((): void => {
    if (!guess.trim()) return;
    const isCorrect = guess.trim().toUpperCase() === challenge.word;
    setResult(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) {
      const points = showHint ? 5 : 10;
      setScore((s) => s + points);
      setStreak((s) => s + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      setStreak(0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  }, [guess, challenge.word, showHint]);

  const handleNext = useCallback((): void => {
    const next = getRandomChallenge();
    setChallenge(next);
    setScrambled(scrambleWord(next.word));
    setGuess('');
    setShowHint(false);
    setResult(null);
    setRound((r) => r + 1);
    setKey((k) => k + 1);
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  const handleHint = useCallback((): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setShowHint(true);
  }, []);

  const handleShuffle = useCallback((): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setScrambled(scrambleWord(challenge.word));
  }, [challenge.word]);

  const catInfo = CATEGORY_LABELS[challenge.category];

  return (
    <Animated.View key={key} entering={FadeIn.duration(300)} style={styles.gameContent}>
      {/* Score bar */}
      <View style={[styles.scoreBar, { backgroundColor: c.surfaceSecondary }]}>
        <View style={styles.scorePart}>
          <Text style={[styles.scoreLabel, { color: c.textSecondary }]}>Score</Text>
          <Text style={[styles.scoreValue, { color: c.primary }]}>{score}</Text>
        </View>
        <View style={styles.scorePart}>
          <Text style={[styles.scoreLabel, { color: c.textSecondary }]}>Round</Text>
          <Text style={[styles.scoreValue, { color: c.textPrimary }]}>{round}</Text>
        </View>
        <View style={styles.scorePart}>
          <Text style={[styles.scoreLabel, { color: c.textSecondary }]}>Streak</Text>
          <Text style={[styles.scoreValue, { color: streak >= 3 ? '#F59E0B' : c.textPrimary }]}>
            {streak > 0 ? `${streak}🔥` : '0'}
          </Text>
        </View>
      </View>

      {/* Category pill */}
      <View style={[styles.catPill, { backgroundColor: c.primary + '15' }]}>
        <Text style={styles.catEmoji}>{catInfo.emoji}</Text>
        <Text style={[styles.catLabel, { color: c.primary }]}>{catInfo.label}</Text>
      </View>

      {/* Scrambled word */}
      <View style={styles.scrambleRow}>
        {scrambled.split('').map((letter, i) => (
          <Animated.View
            key={`${key}-${i}`}
            entering={BounceIn.delay(i * 60).duration(400)}
            style={[styles.letterTile, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <Text style={[styles.letterText, { color: c.primary }]}>{letter}</Text>
          </Animated.View>
        ))}
      </View>

      {/* Hint */}
      {showHint ? (
        <Animated.View entering={FadeIn.duration(300)}>
          <Text style={[styles.hintText, { color: c.textSecondary }]}>💡 {challenge.hint}</Text>
        </Animated.View>
      ) : (
        <Pressable
          style={[styles.hintBtn, { borderColor: c.border }]}
          onPress={handleHint}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Show hint"
        >
          <Ionicons name="bulb-outline" size={16} color={c.textSecondary} />
          <Text style={[styles.hintBtnText, { color: c.textSecondary }]}>Need a hint? (−5 pts)</Text>
        </Pressable>
      )}

      {/* Input + submit */}
      {result === null ? (
        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              {
                backgroundColor: c.surface,
                color: c.textPrimary,
                borderColor: c.border,
              },
            ]}
            value={guess}
            onChangeText={setGuess}
            placeholder="Type your answer..."
            placeholderTextColor={c.textDisabled}
            autoCapitalize="characters"
            autoCorrect={false}
            onSubmitEditing={handleSubmit}
            returnKeyType="go"
            maxLength={challenge.word.length + 2}
          />
          <Pressable
            style={[
              styles.submitBtn,
              { backgroundColor: guess.trim() ? c.primary : c.textDisabled },
            ]}
            onPress={handleSubmit}
            disabled={!guess.trim()}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Submit answer"
          >
            <Ionicons name="checkmark" size={22} color="#fff" />
          </Pressable>
        </View>
      ) : (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.resultArea}>
          {result === 'correct' ? (
            <View style={[styles.resultCard, { backgroundColor: '#10B981' + '18' }]}>
              <Text style={[styles.resultEmoji]}>🎉</Text>
              <Text style={[styles.resultText, { color: '#10B981' }]}>
                Nailed it! +{showHint ? 5 : 10} pts
              </Text>
            </View>
          ) : (
            <View style={[styles.resultCard, { backgroundColor: '#EF4444' + '18' }]}>
              <Text style={[styles.resultEmoji]}>😅</Text>
              <Text style={[styles.resultText, { color: '#EF4444' }]}>
                The answer was: {challenge.word}
              </Text>
            </View>
          )}
          <Pressable
            style={[styles.nextBtn, { backgroundColor: c.primary }]}
            onPress={handleNext}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Next word"
          >
            <Text style={styles.nextBtnText}>Next Word →</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Shuffle button */}
      {result === null && (
        <Pressable
          style={[styles.shuffleBtn, { backgroundColor: c.surfaceSecondary }]}
          onPress={handleShuffle}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Shuffle letters"
        >
          <Ionicons name="shuffle-outline" size={16} color={c.textSecondary} />
          <Text style={[styles.shuffleBtnText, { color: c.textSecondary }]}>Shuffle</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

// ── Joke Browser ─────────────────────────────────────────────────────────────
function JokeBrowser(): React.JSX.Element {
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

  const CATEGORY_EMOJI: Record<DadJoke['category'], string> = {
    bills: '💸',
    parking: '🚗',
    chores: '🧹',
    grocery: '🛒',
    house: '🏠',
    general: '😄',
  };

  return (
    <Animated.View key={key} entering={FadeIn.duration(300)} style={styles.jokeContent}>
      <View style={[styles.jokeCard, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={styles.jokeHeader}>
          <Text style={styles.jokeEmoji}>{CATEGORY_EMOJI[joke.category]}</Text>
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
            style={[styles.jokeRevealBtn, { backgroundColor: c.primary + '15' }]}
            onPress={handleReveal}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Reveal punchline"
          >
            <Text style={[styles.jokeRevealText, { color: c.primary }]}>Tap to reveal 👀</Text>
          </Pressable>
        )}
      </View>

      <Pressable
        style={[styles.jokeNextBtn, { backgroundColor: c.surfaceSecondary }]}
        onPress={handleNext}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Next joke"
      >
        <Ionicons name="refresh-outline" size={18} color={c.textSecondary} />
        <Text style={[styles.jokeNextText, { color: c.textSecondary }]}>Another one 🎲</Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function GamesScreen(): React.JSX.Element {
  const c = useThemedColors();
  const [tab, setTab] = useState<GameTab>('scramble');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={c.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.textPrimary }]}>Games & Fun</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Tab switcher */}
      <View style={[styles.tabRow, { backgroundColor: c.surfaceSecondary }]}>
        <Pressable
          style={[styles.tabBtn, tab === 'scramble' && { backgroundColor: c.surface }]}
          onPress={() => setTab('scramble')}
          accessible
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'scramble' }}
          accessibilityLabel="Word Scramble game"
        >
          <Text style={[styles.tabText, { color: tab === 'scramble' ? c.primary : c.textSecondary }]}>
            🔤 Word Scramble
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, tab === 'jokes' && { backgroundColor: c.surface }]}
          onPress={() => setTab('jokes')}
          accessible
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'jokes' }}
          accessibilityLabel="Dad Jokes"
        >
          <Text style={[styles.tabText, { color: tab === 'jokes' ? c.primary : c.textSecondary }]}>
            😂 Dad Jokes
          </Text>
        </Pressable>
      </View>

      {tab === 'scramble' ? <WordScrambleGame /> : <JokeBrowser />}
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
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, ...font.bold },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: sizes.md,
    borderRadius: sizes.borderRadius,
    padding: 3,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: sizes.borderRadius - 2,
    alignItems: 'center',
  },
  tabText: { fontSize: 14, ...font.semibold },

  // ── Word Scramble ──────────────────────────────────────────────────────────
  gameContent: {
    flex: 1,
    padding: sizes.md,
    gap: sizes.md,
    alignItems: 'center',
  },
  scoreBar: {
    flexDirection: 'row',
    width: '100%',
    borderRadius: sizes.borderRadius,
    paddingVertical: sizes.sm + 2,
    paddingHorizontal: sizes.md,
  },
  scorePart: { flex: 1, alignItems: 'center', gap: 2 },
  scoreLabel: { fontSize: 11, ...font.medium, textTransform: 'uppercase', letterSpacing: 0.8 },
  scoreValue: { fontSize: 20, ...font.bold },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: sizes.md,
    paddingVertical: 4,
    borderRadius: sizes.borderRadiusFull,
  },
  catEmoji: { fontSize: 14 },
  catLabel: { fontSize: 13, ...font.semibold },
  scrambleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginVertical: sizes.sm,
  },
  letterTile: {
    width: 44,
    height: 52,
    borderRadius: sizes.borderRadius,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  letterText: { fontSize: 22, ...font.bold },
  hintText: { fontSize: 14, ...font.medium, textAlign: 'center' },
  hintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: sizes.md,
    paddingVertical: 8,
    borderRadius: sizes.borderRadius,
    borderWidth: 1,
  },
  hintBtnText: { fontSize: 13, ...font.medium },
  inputRow: {
    flexDirection: 'row',
    width: '100%',
    gap: sizes.sm,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 50,
    borderWidth: 1.5,
    borderRadius: sizes.borderRadius,
    paddingHorizontal: sizes.md,
    fontSize: 18,
    ...font.bold,
    letterSpacing: 2,
  },
  submitBtn: {
    width: 50,
    height: 50,
    borderRadius: sizes.borderRadius,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultArea: { width: '100%', gap: sizes.sm, alignItems: 'center' },
  resultCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: sizes.sm,
    paddingVertical: sizes.md,
    paddingHorizontal: sizes.lg,
    borderRadius: sizes.borderRadius,
  },
  resultEmoji: { fontSize: 28 },
  resultText: { fontSize: 16, ...font.semibold, flex: 1 },
  nextBtn: {
    paddingHorizontal: sizes.xl,
    paddingVertical: 14,
    borderRadius: sizes.borderRadius,
  },
  nextBtnText: { color: '#fff', fontSize: 16, ...font.bold },
  shuffleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: sizes.md,
    paddingVertical: 8,
    borderRadius: sizes.borderRadius,
  },
  shuffleBtnText: { fontSize: 13, ...font.medium },

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
  jokeEmoji: { fontSize: 28 },
  jokeCatPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: sizes.borderRadiusFull,
  },
  jokeCatText: { fontSize: 12, ...font.semibold, textTransform: 'capitalize' },
  jokeSetup: { fontSize: 18, ...font.semibold, lineHeight: 26 },
  jokePunchline: { fontSize: 20, ...font.bold, lineHeight: 28 },
  jokeRevealBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: sizes.lg,
    paddingVertical: sizes.sm + 2,
    borderRadius: sizes.borderRadius,
  },
  jokeRevealText: { fontSize: 15, ...font.semibold },
  jokeNextBtn: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: sizes.lg,
    paddingVertical: 10,
    borderRadius: sizes.borderRadius,
  },
  jokeNextText: { fontSize: 14, ...font.semibold },
});
