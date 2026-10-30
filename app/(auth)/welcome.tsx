import { useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguageStore } from '@stores/languageStore';
import type { AppLanguage } from '@lib/i18n';
import { useThemedColors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { ChoiceWords, type ChoiceWord } from '@components/settings/ChoiceWords';
import { Entrance } from '@components/shared/Entrance';
import { Mate } from '@components/shared/Mate';
import { NotebookPaper } from '@components/shared/NotebookPaper';
import { SheetButton } from '@components/shared/SheetButton';
import { TextLink } from '@components/auth/TextLink';
import { DoorArt } from '@components/auth/art/DoorArt';
import { mf, ms } from '@utils/responsive';

const ONBOARDING_INTENT_KEY = 'onboarding_intent';

export default function WelcomeScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const c = useThemedColors();
  const heading = useHeadingFont('semibold');
  const hand = useHandFont();

  const languages = useMemo<ChoiceWord<AppLanguage>[]>(
    () => [
      { value: 'en', label: t('settings.language_en') },
      { value: 'he', label: t('settings.language_he') },
      { value: 'es', label: t('settings.language_es') },
    ],
    [t]
  );

  const handlePickLanguage = useCallback(
    (code: AppLanguage): void => {
      if (code !== language) setLanguage(code);
    },
    [language, setLanguage]
  );

  const handleGetStarted = useCallback(async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(ONBOARDING_INTENT_KEY);
    } catch {
      // best-effort cleanup
    }
    router.push('/(auth)/signup');
  }, []);

  const handleLogIn = useCallback((): void => {
    router.push('/(auth)/login');
  }, []);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.langRow}>
          <ChoiceWords
            options={languages}
            selected={language}
            onSelect={handlePickLanguage}
            groupLabel={t('common.change_language')}
          />
        </View>

        <Entrance style={styles.hero}>
          <View
            style={styles.scene}
            accessible
            accessibilityRole="image"
            accessibilityLabel={t('welcome.logo_label')}
          >
            <DoorArt width={ms(150)} ink={c.textPrimary} />
            <View style={styles.mate}>
              <Mate size={ms(62)} />
            </View>
          </View>
          <Text style={[styles.appName, heading, { color: c.textPrimary }]}>HouseMates</Text>
          <Text style={[styles.tagline, hand, { color: c.primary }]}>{t('welcome.tagline')}</Text>
        </Entrance>

        <Entrance delay={90}>
          <NotebookPaper contentStyle={styles.page}>
            <Text style={[styles.cardHeading, heading, { color: c.paperInk }]}>
              {t('welcome.card_heading')}
            </Text>
            <Text style={[styles.cardBody, { color: c.paperMuted }]}>{t('welcome.card_body')}</Text>
          </NotebookPaper>
        </Entrance>

        <Entrance style={styles.actions} delay={160}>
          <SheetButton label={t('welcome.get_started')} onPress={handleGetStarted} />
          <TextLink label={t('welcome.log_in')} onPress={handleLogIn} />
          <Text style={[styles.terms, { color: c.textTertiary }]}>{t('auth.by_continuing')}</Text>
        </Entrance>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: sizes.lg,
    paddingBottom: ms(36),
    gap: ms(22),
  },
  langRow: { alignItems: 'flex-end', marginTop: ms(4) },
  hero: { alignItems: 'center', marginTop: ms(4) },
  scene: { flexDirection: 'row', alignItems: 'flex-end' },
  mate: { marginStart: ms(-14), marginBottom: ms(2) },
  appName: {
    fontSize: mf(40),
    lineHeight: mf(50),
    letterSpacing: -0.8,
    marginTop: ms(14),
    textAlign: 'center',
  },
  tagline: { fontSize: mf(23), textAlign: 'center', marginTop: ms(2) },
  page: { paddingTop: ms(18), paddingBottom: ms(22) },
  cardHeading: { fontSize: mf(23), lineHeight: ms(32) },
  cardBody: { fontSize: mf(15.5), ...font.regular, lineHeight: ms(32) },
  actions: { gap: ms(6), marginTop: 'auto' },
  terms: { fontSize: mf(11.5), ...font.regular, textAlign: 'center', lineHeight: mf(16) },
});
