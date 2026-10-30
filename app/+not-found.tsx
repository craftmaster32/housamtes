import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { Mate } from '@components/shared/Mate';
import { SheetButton } from '@components/shared/SheetButton';
import { mf, ms } from '@utils/responsive';

export default function NotFoundScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const heading = useHeadingFont('semibold');
  const hand = useHandFont();

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: c.background }]}
      edges={['top', 'bottom']}
    >
      <View style={styles.content}>
        <Mate size={ms(84)} />
        {/* A blue sticky note with the code scribbled on it */}
        <View style={[styles.note, { backgroundColor: c.note }]}>
          <Text style={[styles.code, hand, { color: c.noteInk }]}>404</Text>
        </View>
        <Text style={[styles.title, heading, { color: c.textPrimary }]}>
          {t('not_found.title')}
        </Text>
        <Text style={[styles.message, { color: c.textSecondary }]}>{t('not_found.message')}</Text>
        <View style={styles.button}>
          <SheetButton
            label={t('not_found.go_to_dashboard')}
            onPress={() => router.replace('/(tabs)/dashboard')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: sizes.xl,
    gap: ms(14),
  },
  note: {
    paddingHorizontal: ms(22),
    paddingVertical: ms(4),
    borderRadius: ms(4),
    transform: [{ rotate: '-3deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(4) },
    shadowOpacity: 0.12,
    shadowRadius: ms(8),
    elevation: 3,
  },
  code: { fontSize: mf(40), lineHeight: mf(48) },
  title: { fontSize: mf(28), lineHeight: mf(36), textAlign: 'center', marginTop: ms(6) },
  message: { fontSize: mf(15.5), ...font.regular, lineHeight: mf(23), textAlign: 'center' },
  button: { alignSelf: 'stretch', marginTop: ms(10) },
});
