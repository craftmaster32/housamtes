import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { navigateToBase } from '@stores/navigationStore';
import { useAnnouncementsStore } from '@stores/announcementsStore';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { useMemberName } from '@hooks/useMemberName';
import { useHandFont } from '@hooks/useHandFont';
import { useReduceMotion } from '@hooks/useReduceMotion';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { NextNote } from '@components/dashboard/NextNote';
import { mf, ms } from '@utils/responsive';

function localeFor(lang: string): string {
  return lang === 'he' ? 'he-IL' : lang === 'es' ? 'es-ES' : 'en-GB';
}

function timeAgo(
  iso: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
  lang: string
): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('common.just_now');
  if (mins < 60) return t('common.minutes_ago', { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('common.hours_ago', { n: hours });
  return new Date(iso).toLocaleDateString(localeFor(lang), { month: 'short', day: 'numeric' });
}

// Notes waiting underneath the top one: offset + tilt per layer.
const PILE = [
  { rotate: '-2.4deg', translateY: ms(7) },
  { rotate: '2.6deg', translateY: ms(12) },
];
// How far the top note travels when it's tossed aside.
const TOSS_X = ms(420);
const TOSS_MS = 420;
// The top note's own tilt (styles.note); the next note rises into it.
const TOP_TILT = 0.8;

const OPEN_NOTES = (): void => navigateToBase('/(tabs)/notes');

// The house notes, shown as sticky notes taped to the fridge. With several,
// tapping the top one tosses it aside to reveal the next; after the last one
// the first comes back round, so no note is ever lost. A lone note opens the
// notes page instead.
export function PinnedNote(): React.JSX.Element | null {
  const { t } = useTranslation();
  const c = useThemedColors();
  const handFont = useHandFont();
  const language = useLanguageStore((s) => s.language);
  const rtl = isRTL(language);
  const reduceMotion = useReduceMotion();
  const notes = useAnnouncementsStore((s) => s.items);
  const memberName = useMemberName();
  const [index, setIndex] = useState(0);
  // 0 → 1 while the top note is tossed aside and the next one rises into place.
  const toss = useRef(new Animated.Value(0)).current;
  const busy = useRef(false);

  const count = notes.length;
  // Notes can be added or removed while we're part-way through the pile.
  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [index, count]);

  const showNext = useCallback((): void => {
    if (busy.current || count < 2) return;
    const advance = (): void => setIndex((i) => (i + 1) % count);
    if (reduceMotion) {
      advance();
      return;
    }
    busy.current = true;
    // One continuous move: the top note is flicked away while the next note,
    // already underneath with its own text, lifts into the top spot. At the end
    // the next note sits exactly where the top one was, so swapping them is
    // invisible — nothing pops in.
    Animated.timing(toss, {
      toValue: 1,
      duration: TOSS_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      advance();
      toss.setValue(0);
      busy.current = false;
    });
  }, [count, reduceMotion, toss]);

  const current = notes[Math.min(index, count - 1)];
  if (!current) return null;
  const next = count > 1 ? notes[(index + 1) % count] : undefined;

  const several = count > 1;
  const author = memberName(current.author).split(' ')[0];
  const by = t('dashboard.pinned_by', { name: author });
  const ago = timeAgo(current.createdAt, t, language);
  const position = t('dashboard.note_position', { n: index + 1, count });
  const dir = rtl ? -1 : 1;
  // Which note we're on, as a row of dots; the rising note shows its own.
  const dots = (active: number): React.JSX.Element => (
    <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no">
      {notes.map((n, i) => (
        <View
          key={n.id}
          style={[
            styles.dot,
            { backgroundColor: c.noteInk },
            i === active ? styles.dotOn : styles.dotOff,
          ]}
        />
      ))}
    </View>
  );

  return (
    <View style={[styles.wrap, several && styles.wrapPile]}>
      {/* A third note peeks from the bottom of the pile and slides up a layer. */}
      {count > 2 && (
        <Animated.View
          style={[
            styles.layer,
            {
              backgroundColor: c.note,
              transform: [
                {
                  translateY: toss.interpolate({
                    inputRange: [0, 1],
                    outputRange: [PILE[1].translateY, PILE[0].translateY],
                  }),
                },
                {
                  rotate: toss.interpolate({
                    inputRange: [0, 1],
                    outputRange: [PILE[1].rotate, PILE[0].rotate],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.layerShade} />
        </Animated.View>
      )}
      {/* The next note, with its real text, waiting underneath; it rises to the top. */}
      {next && (
        <NextNote
          note={next}
          toss={toss}
          restY={PILE[0].translateY}
          restRotate={parseFloat(PILE[0].rotate) - TOP_TILT}
          noteStyle={styles.note}
          tapeStyle={styles.tape}
          bodyStyle={styles.noteTap}
          byStyle={styles.by}
          textStyle={styles.text}
          shadeStyle={styles.layerShade}
          footer={
            <View style={styles.footer}>
              {dots((index + 1) % count)}
              <View style={styles.seeAll}>
                <Text style={[styles.seeAllText, { color: c.noteInk }]}>
                  {t('dashboard.see_all')}
                </Text>
              </View>
            </View>
          }
          byLine={`${t('dashboard.pinned_by', { name: memberName(next.author).split(' ')[0] })} · ${timeAgo(next.createdAt, t, language)}`}
        />
      )}
      <Animated.View
        style={{
          transform: [
            {
              translateX: toss.interpolate({ inputRange: [0, 1], outputRange: [0, dir * TOSS_X] }),
            },
            {
              translateY: toss.interpolate({ inputRange: [0, 1], outputRange: [0, -ms(18)] }),
            },
            {
              rotate: toss.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', `${dir * 16}deg`],
              }),
            },
          ],
        }}
      >
        {/* The note itself is plain paper; the tap-to-flip area and "See all" are
            separate controls on it, so VoiceOver can reach both. */}
        <View style={[styles.note, { backgroundColor: c.note }]}>
          <View style={styles.tape} />
          <Pressable
            style={({ pressed }) => [styles.noteTap, pressed && styles.pressed]}
            onPress={several ? showNext : OPEN_NOTES}
            accessibilityRole="button"
            accessibilityLabel={`${several ? `${position}. ` : ''}${by}, ${ago}. ${current.text}`}
            accessibilityHint={several ? t('dashboard.next_note_hint') : undefined}
          >
            <Text style={[styles.by, { color: c.noteInk }]} numberOfLines={1}>
              {by} · {ago}
            </Text>
            <Text style={[styles.text, handFont, { color: c.noteInk }]} numberOfLines={2}>
              {current.text}
            </Text>
          </Pressable>
          {several && (
            <View style={styles.footer}>
              {dots(index)}
              <Pressable
                onPress={OPEN_NOTES}
                hitSlop={ms(12)}
                accessibilityRole="link"
                accessibilityLabel={t('dashboard.see_all')}
                style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}
              >
                <Text style={[styles.seeAllText, { color: c.noteInk }]}>
                  {t('dashboard.see_all')}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Square corners, a hair of tilt and a lifted shadow: paper, not a UI card.
  wrap: { marginTop: ms(22), marginHorizontal: ms(8) },
  wrapPile: { marginBottom: ms(12) },
  layer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: ms(2),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(4) },
    shadowOpacity: 0.12,
    shadowRadius: ms(6),
    elevation: 2,
  },
  // Notes underneath sit a shade darker so the top one reads as on top.
  layerShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.07)' },
  note: {
    borderRadius: ms(2),
    transform: [{ rotate: '0.8deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(10) },
    shadowOpacity: 0.18,
    shadowRadius: ms(12),
    elevation: 4,
  },
  tape: {
    position: 'absolute',
    top: ms(-9),
    alignSelf: 'center',
    width: ms(76),
    height: ms(20),
    backgroundColor: 'rgba(255,255,255,0.5)',
    transform: [{ rotate: '-2deg' }],
  },
  by: { fontSize: mf(13), ...font.bold, opacity: 0.75 },
  text: { fontSize: mf(25), lineHeight: mf(30), marginTop: ms(4) },
  noteTap: { paddingHorizontal: ms(18), paddingTop: ms(20), paddingBottom: ms(14) },
  // Dots and "See all" get their own row under the text, so the link never
  // covers the second line of a note.
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingStart: ms(18),
    paddingEnd: ms(14),
    marginTop: -ms(10),
    marginBottom: ms(2),
  },
  dots: { flexDirection: 'row', alignItems: 'center', gap: ms(5) },
  dot: { height: ms(6), borderRadius: ms(3) },
  dotOn: { width: ms(16), opacity: 0.7 },
  dotOff: { width: ms(6), opacity: 0.25 },
  seeAll: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: ms(4),
  },
  seeAllText: { fontSize: mf(14), ...font.bold, textDecorationLine: 'underline', opacity: 0.8 },
  pressed: { opacity: 0.9 },
});
