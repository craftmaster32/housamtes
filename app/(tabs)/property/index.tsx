import { useState, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { BackLink } from '@components/shared/BackLink';
import { BillTabs, type BillTab } from '@components/bills/BillTabs';
import { IssuesTab } from '@components/property/IssuesTab';
import { ConditionTab } from '@components/property/ConditionTab';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { mf, ms } from '@utils/responsive';

type ActiveTab = 'issues' | 'condition';

export default function PropertyScreen(): React.JSX.Element {
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const headingFont = useHeadingFont('semibold');
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ActiveTab>('issues');

  const tabs = useMemo<BillTab<ActiveTab>[]>(
    () => [
      { key: 'issues', label: t('property.tab_issues') },
      { key: 'condition', label: t('property.tab_condition') },
    ],
    [t]
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <BackLink label={t('common.home')} />
        <Text style={[styles.title, headingFont]}>{t('nav.property')}</Text>
        <BillTabs tabs={tabs} selected={activeTab} onSelect={setActiveTab} />
      </View>
      {activeTab === 'issues' ? <IssuesTab /> : <ConditionTab />}
    </SafeAreaView>
  );
}

function makeStyles(C: ColorTokens): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    header: { paddingHorizontal: ms(20), paddingTop: ms(8), paddingBottom: ms(12) },
    title: {
      fontSize: mf(36),
      lineHeight: mf(46),
      paddingBottom: ms(2),
      letterSpacing: -0.5,
      marginTop: ms(4),
      marginBottom: ms(6),
      color: C.textPrimary,
    },
  });
}
