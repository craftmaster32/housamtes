import { useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { goBack } from '@stores/navigationStore';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '@stores/languageStore';
import type { AppLanguage } from '@lib/i18n';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { mf, ms } from '@utils/responsive';

export default function LanguageSettingsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const currentLanguage = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const headingFont = useHeadingFont('bold');

  const handleBack = useCallback(() => goBack(), []);

  const options: { code: AppLanguage; label: string; flag: string }[] = [
    { code: 'en', label: t('settings.language_en'), flag: '🇬🇧' },
    { code: 'he', label: t('settings.language_he'), flag: '🇮🇱' },
    { code: 'es', label: t('settings.language_es'), flag: '🇪🇸' },
  ];

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
            <Text style={styles.subheading}>{t('settings.language_section')}</Text>
          </View>

          <View style={styles.card}>
            {options.map((opt, idx) => {
              const selected = currentLanguage === opt.code;
              return (
                <Pressable
                  key={opt.code}
                  style={({ pressed }) => [
                    styles.row,
                    idx < options.length - 1 && styles.rowBorder,
                    pressed && styles.rowPressed,
                  ]}
                  onPress={() => setLanguage(opt.code)}
                  accessible
                  accessibilityRole="radio"
                  accessibilityLabel={opt.label}
                  accessibilityState={{ checked: selected }}
                >
                  <Text style={styles.flag}>{opt.flag}</Text>
                  <View style={styles.rowText}>
                    <Text style={[styles.rowLabel, selected && styles.rowLabelOn]}>
                      {opt.label}
                    </Text>
                  </View>
                  {selected && <Ionicons name="checkmark" size={20} color={C.primary} />}
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
    card: {
      backgroundColor: C.surface,
      borderRadius: ms(14),
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: ms(2) },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sizes.md,
      paddingVertical: ms(15),
      gap: sizes.md,
    },
    rowPressed: { backgroundColor: C.background },
    rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    flag: { fontSize: mf(22) },
    rowText: { flex: 1 },
    rowLabel: { fontSize: mf(15), ...font.medium, color: C.textPrimary },
    rowLabelOn: { color: C.primary, ...font.bold },
  });
}
