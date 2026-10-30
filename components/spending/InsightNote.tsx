import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { lightColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHandFont } from '@hooks/useHandFont';
import { mf, ms } from '@utils/responsive';

const P = lightColors;
const STICKY = '#FCE9A8';

interface InsightNoteProps {
  insight: string | null;
  error: string | null;
  isLoading: boolean;
  onRefresh: () => void;
}

/** The AI insight as a sticky note left on the page, with a refresh in its corner. */
export function InsightNote({
  insight,
  error,
  isLoading,
  onRefresh,
}: InsightNoteProps): React.JSX.Element {
  const { t } = useTranslation();
  const hand = useHandFont();
  return (
    <View style={styles.note}>
      <View style={styles.tape} pointerEvents="none" />
      <View style={styles.head}>
        <Text style={styles.label}>{t('spending.ai_insight')}</Text>
        <Pressable
          onPress={onRefresh}
          disabled={isLoading}
          style={styles.refresh}
          accessibilityRole="button"
          accessibilityLabel={t('spending.refresh_insight')}
          accessibilityState={{ disabled: isLoading }}
        >
          {isLoading ? (
            <ActivityIndicator color={P.paperMuted} size="small" />
          ) : (
            <Ionicons name="refresh-outline" size={17} color={P.paperMuted} />
          )}
        </Pressable>
      </View>
      <Text
        style={[insight ? styles.text : styles.muted, hand, !!error && !insight && styles.error]}
      >
        {insight ??
          (isLoading ? t('spending.generating_insight') : (error ?? t('spending.no_insight_yet')))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    backgroundColor: STICKY,
    borderRadius: ms(2),
    paddingHorizontal: ms(16),
    paddingTop: ms(12),
    paddingBottom: ms(16),
    transform: [{ rotate: '-0.8deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(2) },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 2,
  },
  tape: {
    position: 'absolute',
    top: -ms(8),
    alignSelf: 'center',
    width: ms(70),
    height: ms(18),
    backgroundColor: 'rgba(255,255,255,0.55)',
    transform: [{ rotate: '2deg' }],
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: mf(12.5), ...font.bold, color: P.paperMuted },
  refresh: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: -ms(10),
  },
  text: { fontSize: mf(20), lineHeight: mf(25), color: P.paperInk },
  muted: { fontSize: mf(19), lineHeight: mf(24), color: P.paperMuted },
  error: { color: P.negative },
});
