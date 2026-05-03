import { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { IssuesTab } from '@components/property/IssuesTab';
import { ConditionTab } from '@components/property/ConditionTab';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

type ActiveTab = 'issues' | 'condition';

export default function PropertyScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ActiveTab>('issues');

  const switchToIssues = useCallback(() => setActiveTab('issues'), []);
  const switchToCondition = useCallback(() => setActiveTab('condition'), []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>{t('nav.property')}</Text>
        <View style={styles.segmented}>
          <Pressable
            style={[styles.segment, activeTab === 'issues' && styles.segmentActive]}
            onPress={switchToIssues}
            accessible
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'issues' }}
            accessibilityLabel="Issues tab"
          >
            <Text style={[styles.segmentText, activeTab === 'issues' && styles.segmentTextActive]}>
              Issues
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segment, activeTab === 'condition' && styles.segmentActive]}
            onPress={switchToCondition}
            accessible
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'condition' }}
            accessibilityLabel="Condition tab"
          >
            <Text style={[styles.segmentText, activeTab === 'condition' && styles.segmentTextActive]}>
              Condition
            </Text>
          </Pressable>
        </View>
      </View>

      {activeTab === 'issues' ? <IssuesTab /> : <ConditionTab />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: sizes.lg,
    paddingTop: sizes.md,
    paddingBottom: sizes.sm,
    gap: sizes.sm,
    backgroundColor: colors.background,
  },
  heading: { fontSize: 26, ...font.extrabold, color: colors.textPrimary, letterSpacing: -0.5 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.border + '60',
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
    backgroundColor: colors.white,
    boxShadow: '0 1px 3px rgba(0,0,0,0.10)',
  } as never,
  segmentText: { fontSize: sizes.fontSm, ...font.semibold, color: colors.textSecondary },
  segmentTextActive: { color: colors.primary },
});
