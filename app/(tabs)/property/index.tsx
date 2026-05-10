import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet, Pressable, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { IssuesTab } from '@components/property/IssuesTab';
import { ConditionTab } from '@components/property/ConditionTab';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

type ActiveTab = 'issues' | 'condition';

export default function PropertyScreen(): React.JSX.Element {
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ActiveTab>('issues');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const switchToIssues = useCallback(() => setActiveTab('issues'), []);
  const switchToCondition = useCallback(() => setActiveTab('condition'), []);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        <View style={styles.header}>
          <Text style={styles.heading}>{t('nav.property')}</Text>
          <View style={styles.segmented}>
            <Pressable
              style={[styles.segment, activeTab === 'issues' && styles.segmentActive]}
              onPress={switchToIssues}
              accessible
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'issues' }}
              accessibilityLabel={t('property.tab_issues')}
            >
              <Text style={[styles.segmentText, activeTab === 'issues' && styles.segmentTextActive]}>
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
              <Text style={[styles.segmentText, activeTab === 'condition' && styles.segmentTextActive]}>
                {t('property.tab_condition')}
              </Text>
            </Pressable>
          </View>
        </View>

        {activeTab === 'issues' ? <IssuesTab /> : <ConditionTab />}
      </Animated.View>
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
    heading: { fontSize: 26, ...font.extrabold, color: C.textPrimary, letterSpacing: -0.5 },
    segmented: {
      flexDirection: 'row',
      backgroundColor: C.surfaceSecondary,
      borderRadius: 10,
      padding: 3,
      gap: 2,
    },
    segment: {
      flex: 1,
      paddingVertical: sizes.sm,
      alignItems: 'center',
      borderRadius: 8,
    },
    segmentActive: {
      backgroundColor: C.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.10,
      shadowRadius: 3,
      elevation: 1,
    },
    segmentText: { fontSize: sizes.fontSm, ...font.semibold, color: C.textSecondary },
    segmentTextActive: { color: C.primary },
  });
}
