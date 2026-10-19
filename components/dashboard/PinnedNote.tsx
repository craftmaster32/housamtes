import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { navigateToBase } from '@stores/navigationStore';
import { useAnnouncementsStore } from '@stores/announcementsStore';
import { useLanguageStore } from '@stores/languageStore';
import { useMemberName } from '@hooks/useMemberName';
import { useHandFont } from '@hooks/useHandFont';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
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

// Older notes peeking out behind the newest one: offset + tilt per layer.
const PILE = [
  { rotate: '-2.4deg', translateY: ms(7) },
  { rotate: '2.6deg', translateY: ms(12) },
];

// The latest house note, shown as a sticky note taped to the fridge. When
// there are more, the older ones peek out underneath like a little pile.
export function PinnedNote(): React.JSX.Element | null {
  const { t } = useTranslation();
  const c = useThemedColors();
  const handFont = useHandFont();
  const language = useLanguageStore((s) => s.language);
  const notes = useAnnouncementsStore((s) => s.items);
  const memberName = useMemberName();
  const latest = notes[0];

  if (!latest) return null;

  const author = memberName(latest.author).split(' ')[0];
  const by = t('dashboard.pinned_by', { name: author });
  const ago = timeAgo(latest.createdAt, t, language);
  const more = notes.length - 1;
  const moreLabel = more > 0 ? t('dashboard.more_notes', { count: more }) : '';

  return (
    <View style={[styles.wrap, more > 0 && styles.wrapPile]}>
      {PILE.slice(0, Math.min(more, PILE.length))
        .reverse()
        .map((layer) => (
          <View
            key={layer.rotate}
            style={[
              styles.layer,
              {
                backgroundColor: c.note,
                transform: [{ translateY: layer.translateY }, { rotate: layer.rotate }],
              },
            ]}
          >
            <View style={styles.layerShade} />
          </View>
        ))}
      <Pressable
        style={({ pressed }) => [
          styles.note,
          { backgroundColor: c.note },
          pressed && styles.pressed,
        ]}
        onPress={() => navigateToBase('/(tabs)/notes')}
        accessibilityRole="button"
        accessibilityLabel={`${by}, ${ago}. ${latest.text}${moreLabel ? `. ${moreLabel}` : ''}`}
      >
        <View style={styles.tape} />
        <Text style={[styles.by, { color: c.noteInk }]} numberOfLines={1}>
          {by} · {ago}
        </Text>
        <Text style={[styles.text, handFont, { color: c.noteInk }]} numberOfLines={3}>
          {latest.text}
        </Text>
        {more > 0 && <Text style={[styles.more, { color: c.noteInk }]}>{moreLabel}</Text>}
      </Pressable>
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
  // Older notes sit a shade darker so the newest one reads as on top.
  layerShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.07)' },
  note: {
    paddingHorizontal: ms(18),
    paddingTop: ms(20),
    paddingBottom: ms(14),
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
  more: { alignSelf: 'flex-end', fontSize: mf(13), ...font.bold, opacity: 0.75, marginTop: ms(2) },
  pressed: { opacity: 0.9 },
});
