import { useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { goBack } from '@stores/navigationStore';
import { useTranslation } from 'react-i18next';
import { useSettingsStore, type ThemeMode } from '@stores/settingsStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { Entrance } from '@components/shared/Entrance';
import { mf, ms } from '@utils/responsive';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const OPTIONS: { mode: ThemeMode; icon: IconName; labelKey: string }[] = [
  { mode: 'system', icon: 'phone-portrait-outline', labelKey: 'settings.theme_system' },
  { mode: 'light', icon: 'sunny-outline', labelKey: 'settings.theme_light' },
  { mode: 'dark', icon: 'moon-outline', labelKey: 'settings.theme_dark' },
];

export default function AppearanceSettingsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const headingFont = useHeadingFont('bold');

  const handleBack = useCallback((): void => {
    goBack();
  }, []);
  const handleSelect = useCallback(
    (mode: ThemeMode) => {
      setThemeMode(mode);
      Haptics.selectionAsync().catch(() => {});
    },
    [setThemeMode]
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <Pressable
              onPress={handleBack}
              style={styles.backBtn}
              hitSlop={12}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
            >
              <Text style={styles.backText}>{t('common.back')}</Text>
            </Pressable>
            <Text style={[styles.heading, headingFont]}>{t('nav.settings')}</Text>
            <Text style={styles.subheading}>{t('settings.appearance_section')}</Text>
          </View>

          <View style={styles.themeRow}>
            {OPTIONS.map((opt) => {
              const selected = themeMode === opt.mode;
              return (
                <Pressable
                  key={opt.mode}
                  style={[styles.themeTile, selected && styles.themeTileOn]}
                  onPress={() => handleSelect(opt.mode)}
                  accessible
                  accessibilityRole="radio"
                  accessibilityLabel={t(opt.labelKey)}
                  accessibilityState={{ selected }}
                >
                  {selected && (
                    <Entrance offset={0} duration={200} style={styles.themeCheck}>
                      <Ionicons name="checkmark-circle" size={18} color={C.primary} />
                    </Entrance>
                  )}
                  <Ionicons
                    name={opt.icon}
                    size={24}
                    color={selected ? C.primary : C.textSecondary}
                  />
                  <Text style={[styles.themeTileText, selected && styles.themeTileTextOn]}>
                    {t(opt.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    scroll: { padding: sizes.lg, gap: sizes.md, paddingBottom: ms(60) },
    header: { gap: ms(4), marginBottom: sizes.xs },
    backBtn: { alignSelf: 'flex-start', marginBottom: sizes.sm },
    backText: { color: C.primary, fontSize: mf(15), ...font.semibold },
    heading: { fontSize: mf(26), ...font.extrabold, color: C.textPrimary, letterSpacing: -0.5 },
    subheading: { fontSize: mf(14), ...font.regular, color: C.textSecondary, marginTop: ms(2) },
    themeRow: { flexDirection: 'row', gap: sizes.sm },
    themeTile: {
      flex: 1,
      minHeight: ms(92),
      borderRadius: ms(14),
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surface,
      alignItems: 'center',
      justifyContent: 'center',
      gap: ms(8),
      paddingVertical: sizes.md,
    },
    themeTileOn: { borderColor: C.primary, borderWidth: 2, backgroundColor: C.primary + '14' },
    themeTileText: { fontSize: mf(13), ...font.bold, color: C.textSecondary },
    themeTileTextOn: { color: C.primary },
    themeCheck: { position: 'absolute', top: ms(6), insetInlineEnd: 6 },
  });
}
