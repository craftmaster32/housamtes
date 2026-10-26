import { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { router } from 'expo-router';
import { useTranslation, Trans } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { AuthScreen } from '@components/auth/AuthScreen';
import { TextLink } from '@components/auth/TextLink';
import { InkTickBox } from '@components/shared/InkTickBox';
import { PenTick } from '@components/shared/PenTick';
import { NotebookPaper } from '@components/shared/NotebookPaper';
import { SheetButton } from '@components/shared/SheetButton';
import { mf, ms } from '@utils/responsive';

// The ticks beside the changes are drawn one after another as the page opens.
const TICK_START_MS = 250;
const TICK_GAP_MS = 110;

const CHANGES = [
  'auth.terms_change_australia',
  'auth.terms_change_israel',
  'auth.terms_change_us_states',
  'auth.terms_change_consumer_law',
  'auth.terms_change_jurisdiction',
] as const;

export default function AcceptTermsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const acceptUpdatedTerms = useAuthStore((s) => s.acceptUpdatedTerms);
  const signOut = useAuthStore((s) => s.signOut);
  const isLoading = useAuthStore((s) => s.isLoading);
  const C = useThemedColors();
  const heading = useHeadingFont('semibold');

  const [inked, setInked] = useState(0);
  useEffect(() => {
    const timers = CHANGES.map((_, i) =>
      setTimeout(() => setInked(i + 1), TICK_START_MS + i * TICK_GAP_MS)
    );
    return (): void => timers.forEach(clearTimeout);
  }, []);

  const handleAccept = useCallback(async (): Promise<void> => {
    if (!agreed) {
      setError(t('auth.accept_terms_checkbox_required'));
      return;
    }
    try {
      setError('');
      await acceptUpdatedTerms();
    } catch {
      setError(t('auth.something_went_wrong'));
    }
  }, [agreed, acceptUpdatedTerms, t]);

  const handleSignOut = useCallback(async (): Promise<void> => {
    await signOut();
  }, [signOut]);

  return (
    <AuthScreen title={t('auth.terms_updated_title')} subtitle={t('auth.terms_updated_body')}>
      <NotebookPaper contentStyle={styles.page}>
        <Text style={[styles.changeHeading, heading, { color: C.paperInk }]}>
          {t('auth.terms_what_changed')}
        </Text>
        {CHANGES.map((key, i) => (
          <View key={key} style={styles.changeRow}>
            <PenTick
              checked={inked > i}
              size={ms(16)}
              color={C.primary}
              style={styles.tick}
              strokeWidth={3.4}
            />
            <Text style={[styles.changeText, { color: C.paperInk }]}>{t(key)}</Text>
          </View>
        ))}
      </NotebookPaper>

      <View style={styles.agreeRow}>
        <InkTickBox
          checked={agreed}
          onChange={(v) => {
            setAgreed(v);
            setError('');
          }}
          accessibilityLabel={t('auth.accept_terms_agree_label')}
        />
        <Text style={[styles.agreeText, { color: C.textSecondary }]}>
          <Trans
            i18nKey="auth.accept_terms_agree_full"
            components={{
              tos: (
                <Text
                  style={[styles.link, { color: C.primary }]}
                  onPress={() => router.push('/(auth)/terms')}
                  accessibilityRole="link"
                >
                  {''}
                </Text>
              ),
              privacy: (
                <Text
                  style={[styles.link, { color: C.primary }]}
                  onPress={() => router.push('/(auth)/privacy-policy')}
                  accessibilityRole="link"
                >
                  {''}
                </Text>
              ),
            }}
          />
        </Text>
      </View>

      {!!error && <Text style={[styles.error, { color: C.danger }]}>{error}</Text>}

      <View style={styles.cta}>
        <SheetButton
          label={t('auth.accept_and_continue')}
          onPress={handleAccept}
          loading={isLoading}
          disabled={isLoading || !agreed}
        />
        <TextLink muted label={t('auth.sign_out_instead')} onPress={handleSignOut} />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: ms(14), paddingBottom: ms(20), paddingStart: ms(30) },
  changeHeading: { fontSize: mf(19), lineHeight: ms(32) },
  changeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: ms(8) },
  tick: { marginTop: ms(8) },
  changeText: { flex: 1, fontSize: mf(14.5), ...font.regular, lineHeight: ms(32) },
  agreeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: ms(10) },
  agreeText: { flex: 1, fontSize: mf(14), ...font.regular, lineHeight: mf(21), paddingTop: ms(10) },
  link: { ...font.semibold, textDecorationLine: 'underline' },
  error: { fontSize: mf(14), ...font.medium, lineHeight: mf(20) },
  cta: { gap: ms(6) },
});
