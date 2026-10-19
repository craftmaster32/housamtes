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

// The latest house note, shown as a sticky note taped to the fridge.
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

  return (
    <Pressable
      style={({ pressed }) => [styles.note, { backgroundColor: c.note }, pressed && styles.pressed]}
      onPress={() => navigateToBase('/(tabs)/notes')}
      accessibilityRole="button"
      accessibilityLabel={`${by}, ${ago}. ${latest.text}`}
    >
      <View style={styles.tape} />
      <Text style={[styles.by, { color: c.noteInk }]} numberOfLines={1}>
        {by} · {ago}
      </Text>
      <Text style={[styles.text, handFont, { color: c.noteInk }]} numberOfLines={3}>
        {latest.text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Square corners, a hair of tilt and a lifted shadow: paper, not a UI card.
  note: {
    marginTop: ms(22),
    marginHorizontal: ms(8),
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
  pressed: { opacity: 0.9 },
});
