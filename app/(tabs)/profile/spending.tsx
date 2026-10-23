import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable, SectionList } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { useSpendingStore, type CategorySpend } from '@stores/spendingStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { localizedMonthLabel } from '@utils/dates';
import { BackLink } from '@components/shared/BackLink';
import { LoadingSpinner } from '@components/shared/LoadingSpinner';
import { Mate } from '@components/shared/Mate';
import { BillTabs, type BillTab } from '@components/bills/BillTabs';
import { ContributionCards } from '@components/bills/recurring/ContributionCards';
import { GraphChart } from '@components/spending/GraphChart';
import { InsightNote } from '@components/spending/InsightNote';
import { OverviewBlock } from '@components/spending/OverviewBlock';
import { CategoryLine } from '@components/spending/CategoryLine';
import {
  fmtFull,
  type CategoryRowItem,
  type SpendingView,
} from '@components/spending/spendingFormat';
import { mf, ms } from '@utils/responsive';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface SpendingSection {
  title: string;
  icon: IoniconName;
  total: number;
  data: CategoryRowItem[];
}

export default function SpendingScreen(): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<SpendingView>('house');

  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const months = useSpendingStore((s) => s.months);
  const isLoading = useSpendingStore((s) => s.isLoading);
  const error = useSpendingStore((s) => s.error);
  const insight = useSpendingStore((s) => s.insight);
  const insightError = useSpendingStore((s) => s.insightError);
  const insightLoading = useSpendingStore((s) => s.insightLoading);
  const load = useSpendingStore((s) => s.load);
  const fetchInsight = useSpendingStore((s) => s.fetchInsight);
  const currency = useSettingsStore((s) => s.currency);

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const headingFont = useHeadingFont('semibold');

  const userName = profile?.name ?? '';

  // Reload every time the screen comes into focus (picks up bill category edits etc.)
  useFocusEffect(
    useCallback(() => {
      if (houseId && userName) void load(houseId, userName);
    }, [houseId, userName, load])
  );

  useEffect(() => {
    if (months.length && houseId) fetchInsight(houseId, userName, currency);
  }, [months, houseId, userName, currency, fetchInsight]);

  const handleRefreshInsight = useCallback(() => {
    if (!houseId) return;
    useSpendingStore.setState({ insight: null, insightError: null, insightMonth: null });
    void fetchInsight(houseId, userName, currency);
  }, [houseId, userName, currency, fetchInsight]);

  const handleSelectMonth = useCallback((idx: number) => {
    setSelectedIdx(idx);
    setExpandedCategory(null);
  }, []);

  const handleToggleCategory = useCallback((name: string) => {
    setExpandedCategory((prev) => (prev === name ? null : name));
  }, []);

  const handleView = useCallback((v: SpendingView): void => {
    setViewMode(v);
    setExpandedCategory(null);
  }, []);

  const selectedMonth = months[selectedIdx];
  const previousMonth = months[selectedIdx + 1];

  const sections = useMemo((): SpendingSection[] => {
    if (!selectedMonth) return [];

    const sourceCats =
      viewMode === 'house' ? selectedMonth.houseCategories : selectedMonth.categories;
    const prevCats =
      viewMode === 'house' ? previousMonth?.houseCategories : previousMonth?.categories;

    const houseBillCats = sourceCats.filter((c): boolean => c.isHouse);
    const lifestyleCats = sourceCats.filter((c): boolean => !c.isHouse);
    const houseBillTotal = houseBillCats.reduce((s, c) => s + c.amount, 0);
    const lifestyleTotal = lifestyleCats.reduce((s, c) => s + c.amount, 0);

    function toCatRow(cat: CategorySpend, sectionTotal: number): CategoryRowItem {
      const myAmount =
        viewMode === 'house'
          ? (selectedMonth.categories.find((c) => c.name === cat.name)?.amount ?? 0)
          : 0;
      const prevHouseAmount = prevCats?.find((c) => c.name === cat.name)?.amount ?? 0;
      const drillDownItems = selectedMonth.billsByCategory[cat.name] ?? [];
      return { cat, myAmount, prevHouseAmount, sectionTotal, drillDownItems };
    }

    const result: SpendingSection[] = [];
    if (houseBillCats.length > 0) {
      result.push({
        title: t('spending.house_bills_section'),
        icon: 'home-outline',
        total: houseBillTotal,
        data: houseBillCats.map((c) => toCatRow(c, houseBillTotal)),
      });
    }
    if (lifestyleCats.length > 0) {
      result.push({
        title: t('spending.lifestyle_section'),
        icon: 'bag-handle-outline',
        total: lifestyleTotal,
        data: lifestyleCats.map((c) => toCatRow(c, lifestyleTotal)),
      });
    }
    return result;
  }, [selectedMonth, previousMonth, viewMode, t]);

  const hand = useHandFont();

  const viewTabs = useMemo<BillTab<SpendingView>[]>(
    () => [
      {
        key: 'house',
        label: t('spending.house_label'),
        a11yLabel: t('spending.show_house_spending'),
      },
      {
        key: 'personal',
        label: t('spending.personal_label'),
        a11yLabel: t('spending.show_personal_spending'),
      },
    ],
    [t]
  );

  const renderItem = useCallback(
    ({ item }: { item: CategoryRowItem }): React.JSX.Element => (
      <CategoryLine
        item={item}
        currency={currency}
        expanded={expandedCategory === item.cat.name}
        onToggle={handleToggleCategory}
      />
    ),
    [currency, expandedCategory, handleToggleCategory]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SpendingSection }): React.JSX.Element => (
      <View style={styles.sectionHead}>
        <Ionicons name={section.icon} size={16} color={C.textSecondary} />
        <Text style={[styles.sectionTitle, headingFont]}>{section.title}</Text>
        <Text style={styles.sectionTotal}>{fmtFull(section.total, currency)}</Text>
      </View>
    ),
    [currency, styles, headingFont, C]
  );

  const keyExtractor = useCallback((item: CategoryRowItem): string => item.cat.name, []);

  const handleRetry = useCallback((): void => {
    if (houseId && userName) void load(houseId, userName);
  }, [houseId, userName, load]);

  const handleJumpToCurrent = useCallback((): void => setSelectedIdx(0), []);

  const pageHeader = (
    <View style={styles.header}>
      <BackLink label={t('nav.profile')} />
      <Text style={[styles.title, headingFont]}>{t('spending.spending_analysis')}</Text>
    </View>
  );

  if (isLoading && months.length === 0) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        {pageHeader}
        <View style={styles.centered}>
          <LoadingSpinner size={140} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && months.length === 0) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        {pageHeader}
        <View style={styles.centered}>
          <Text style={[styles.errorTitle, headingFont]}>{t('spending.could_not_load')}</Text>
          <Text style={styles.muted}>{t('common.failed_try_again')}</Text>
          <Pressable
            style={styles.retry}
            onPress={handleRetry}
            accessibilityRole="button"
            accessibilityLabel={t('bills.retry')}
          >
            <Text style={styles.retryText}>{t('bills.retry')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const hasTrend = months.some((m) => (viewMode === 'house' ? m.houseTotal : m.total) > 0);
  const listHeader = (
    <View style={styles.listHeader}>
      <BillTabs tabs={viewTabs} selected={viewMode} onSelect={handleView} />
      <InsightNote
        insight={insight}
        error={insightError}
        isLoading={insightLoading}
        onRefresh={handleRefreshInsight}
      />
      {hasTrend && (
        <GraphChart
          months={months}
          currency={currency}
          selectedIdx={selectedIdx}
          view={viewMode}
          onSelectMonth={handleSelectMonth}
        />
      )}
      {selectedIdx > 0 && (
        <Pressable
          style={styles.jump}
          onPress={handleJumpToCurrent}
          accessibilityRole="button"
          accessibilityLabel={t('spending.jump_to_current')}
        >
          <Text style={[styles.jumpText, hand]}>{t('spending.jump_to_current')}</Text>
        </Pressable>
      )}
      {selectedMonth &&
        (viewMode === 'house' ? selectedMonth.houseTotal : selectedMonth.total) > 0 && (
          <OverviewBlock
            current={selectedMonth}
            previous={previousMonth}
            currency={currency}
            view={viewMode}
          />
        )}
      {/* Who has been paying the recurring household bills. */}
      <ContributionCards />
      {sections.length > 0 && (
        <Text style={[styles.breakdown, headingFont]}>
          {t('spending.breakdown_title', {
            month: selectedMonth ? localizedMonthLabel(selectedMonth.month, i18n.language) : '',
          })}
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {pageHeader}
      <SectionList<CategoryRowItem, SpendingSection>
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.scroll}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Mate size={ms(80)} />
              <Text style={[styles.emptyTitle, hand]}>{t('spending.no_spending_yet')}</Text>
              <Text style={styles.muted}>
                {selectedIdx === 0
                  ? t('spending.add_bills_hint')
                  : t('spending.no_spending_for', {
                      month: selectedMonth
                        ? localizedMonthLabel(selectedMonth.month, i18n.language)
                        : t('spending.this_month'),
                    })}
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function makeStyles(C: ColorTokens): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    header: { paddingHorizontal: ms(20), paddingTop: ms(8) },
    title: {
      fontSize: mf(36),
      lineHeight: mf(46),
      paddingBottom: ms(2),
      letterSpacing: -0.5,
      marginTop: ms(4),
      color: C.textPrimary,
    },
    scroll: { paddingHorizontal: ms(20), paddingBottom: ms(60) },
    listHeader: { gap: ms(20), paddingTop: ms(4), marginBottom: ms(4) },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: ms(24),
      gap: ms(8),
    },
    errorTitle: { fontSize: mf(22), color: C.textPrimary, textAlign: 'center' },
    muted: {
      fontSize: mf(13.5),
      lineHeight: mf(19),
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
    },
    retry: {
      minHeight: 48,
      paddingHorizontal: ms(28),
      borderRadius: ms(16),
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: ms(8),
    },
    retryText: { fontSize: mf(15), ...font.semibold, color: '#FFFFFF' },
    jump: { minHeight: 40, justifyContent: 'center', alignSelf: 'center', marginTop: -ms(10) },
    jumpText: { fontSize: mf(19), color: C.primary },
    breakdown: { fontSize: mf(22), lineHeight: mf(29), color: C.textPrimary },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(8),
      paddingTop: ms(14),
      paddingBottom: ms(4),
      borderBottomWidth: 1.5,
      borderBottomColor: C.border,
    },
    sectionTitle: { flex: 1, fontSize: mf(17), lineHeight: mf(23), color: C.textPrimary },
    sectionTotal: { fontSize: mf(15), ...font.bold, color: C.textPrimary },
    empty: { alignItems: 'center', paddingVertical: ms(24), gap: ms(8) },
    emptyTitle: { fontSize: mf(22), lineHeight: mf(26), color: C.textPrimary, textAlign: 'center' },
  });
}
