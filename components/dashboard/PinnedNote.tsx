import { useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { navigateToBase } from '@stores/navigationStore';
import { useAnnouncementsStore } from '@stores/announcementsStore';
import { useLanguageStore } from '@stores/languageStore';
import { useMemberName } from '@hooks/useMemberName';
import { useThemedColors, darkColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { UserAvatar } from '@components/shared/UserAvatar';
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

/** The latest house announcement, shown as a note from the housemate who pinned it. */
export function PinnedNote(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const isDark = c.background === darkColors.background;
  const s = useMemo(() => makeStyles(c, isDark), [c, isDark]);
  const language = useLanguageStore((st) => st.language);
  const notes = useAnnouncementsStore((st) => st.items);
  const memberName = useMemberName();
  const latest = notes[0];
  if (!latest) return <></>;
  const author = memberName(latest.author).split(' ')[0];
  const when = timeAgo(latest.createdAt, t, language);

  return (
    <Pressable
      style={({ pressed }) => [s.note, pressed && s.pressed]}
      onPress={() => navigateToBase('/(tabs)/notes')}
      accessibilityRole="button"
      accessibilityLabel={`${t('dashboard.pinned_by_ago', { name: author, time: when })}. ${latest.text}`}
    >
      <UserAvatar userId={latest.author} size={ms(32)} />
      <View style={s.body}>
        <View style={s.top}>
          <Ionicons name="pin-outline" size={14} color={noteInk(isDark)} />
          <Text style={[s.label, s.ink]} numberOfLines={1}>
            {t('dashboard.pinned_by_ago', { name: author, time: when })}
          </Text>
        </View>
        <Text style={s.text} numberOfLines={4}>
          {latest.text}
        </Text>
      </View>
    </Pressable>
  );
}

// Dark amber text on the paper tone keeps 4.5:1 contrast in both themes.
function noteInk(isDark: boolean): string {
  return isDark ? '#F1D49A' : '#5E3F08';
}

function makeStyles(c: ColorTokens, isDark: boolean): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
    // A warm paper tone so it reads as a note left by a person, not a system banner.
    note: {
      flexDirection: 'row',
      gap: ms(12),
      borderRadius: ms(22),
      paddingVertical: ms(14),
      paddingStart: ms(14),
      paddingEnd: ms(16),
      backgroundColor: isDark ? 'rgba(224,178,77,0.12)' : '#FFF6E5',
      marginTop: ms(14),
    },
    pressed: { opacity: 0.85 },
    body: { flex: 1, minWidth: 0, gap: ms(4) },
    top: { flexDirection: 'row', alignItems: 'center', gap: ms(5) },
    ink: { color: noteInk(isDark) },
    label: { flex: 1, fontSize: mf(13), ...font.semibold },
    text: { fontSize: mf(15), ...font.regular, color: c.textPrimary, lineHeight: mf(21) },
  });
}
