import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { BackLink } from '@components/shared/BackLink';
import { IssuesTab } from '@components/property/IssuesTab';
import { ConditionTab } from '@components/property/ConditionTab';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';

import { mf, ms } from '@utils/responsive';
type ActiveTab = 'issues' | 'condition';

export default function PropertyScreen(): React.JSX.Element {
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const headingFont = useHeadingFont();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ActiveTab>('issues');

  const switchToIssues = useCallback(() => setActiveTab('issues'), []);
  const switchToCondition = useCallback(() => setActiveTab('condition'), []);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.flex}>
        <View style={styles.header}>
          <BackLink label={t('common.home')} />
          <Text style={[styles.heading, headingFont]}>{t('nav.property')}</Text>
          <View style={styles.segmented}>
            <Pressable
              style={[styles.segment, activeTab === 'issues' && styles.segmentActive]}
              onPress={switchToIssues}
              accessible
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'issues' }}
              accessibilityLabel={t('property.tab_issues')}
            >
              <Text
                style={[styles.segmentText, activeTab === 'issues' && styles.segmentTextActive]}
              >
                {t('property.tab_issues')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.segment, activeTab === 'condition' && styles.segmentActive]}
              onPress={switchToCondition}
              accessible
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'condition' }}
              accessibilityLabel={t('property.tab_condition')}
            >
              <Text
                style={[styles.segmentText, activeTab === 'condition' && styles.segmentTextActive]}
              >
                {t('property.tab_condition')}
              </Text>
            </Pressable>
          </View>
        </View>

        {activeTab === 'issues' ? <IssuesTab /> : <ConditionTab />}
      </View>
    </SafeAreaView>
  );
}

function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    header: {
      paddingHorizontal: sizes.lg,
      paddingTop: sizes.md,
      paddingBottom: sizes.sm,
      gap: sizes.sm,
      backgroundColor: C.background,
    },
    heading: { fontSize: mf(26), ...font.extrabold, color: C.textPrimary, letterSpacing: -0.5 },
    segmented: {
      flexDirection: 'row',
      backgroundColor: C.surfaceSecondary,
      borderRadius: ms(10),
      padding: ms(3),
      gap: ms(2),
    },
    segment: {
      flex: 1,
      paddingVertical: sizes.sm,
      alignItems: 'center',
      borderRadius: ms(8),
    },
    segmentActive: {
      backgroundColor: C.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: ms(1) },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 1,
    },
    segmentText: { fontSize: sizes.fontSm, ...font.semibold, color: C.textSecondary },
    segmentTextActive: { color: C.primary },
  });
}
