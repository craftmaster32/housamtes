import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Pressable, FlatList } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { useSpendingStore } from '@stores/spendingStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useThemedColors } from '@constants/colors';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { localizedMonthLabel } from '@utils/dates';
import { BackLink } from '@components/shared/BackLink';
import { LoadingSpinner } from '@components/shared/LoadingSpinner';
import { Mate } from '@components/shared/Mate';
import { ChoiceWords, type ChoiceWord } from '@components/settings/ChoiceWords';
import { ContributionCards } from '@components/bills/recurring/ContributionCards';
import { GraphChart } from '@components/spending/GraphChart';
import { InsightNote } from '@components/spending/InsightNote';
import { CategoryRow } from '@components/spending/CategoryRow';
import { CategorySheet } from '@components/spending/CategorySheet';
import { SpendStrip } from '@components/spending/SpendStrip';
import {
  categoryRows,
  type CategoryRowItem,
  type SpendingView,
} from '@components/spending/spendingFormat';
import { ms } from '@utils/responsive';
import { makeStyles } from '@components/spending/spendingScreen.styles';

// "Where it went" shows the biggest few; the rest open with "N more".
const TOP_ROWS = 5;

export default function SpendingScreen(): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [openItem, setOpenItem] = useState<CategoryRowItem | null>(null);
  const [showAll, setShowAll] = useState(false);
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

  const handleSelectMonth = useCallback((idx: number): void => {
    setSelectedIdx(idx);
    setShowAll(false);
  }, []);

  const handleView = useCallback((v: SpendingView): void => {
    setViewMode(v);
    setShowAll(false);
  }, []);

  const handleOpen = useCallback((item: CategoryRowItem): void => setOpenItem(item), []);
  const handleCloseSheet = useCallback((): void => setOpenItem(null), []);
  const handleToggleAll = useCallback((): void => setShowAll((v) => !v), []);

  const selectedMonth = months[selectedIdx];
  const previousMonth = months[selectedIdx + 1];

  const rows = useMemo(
    () => categoryRows(selectedMonth, previousMonth, viewMode),
    [selectedMonth, previousMonth, viewMode]
  );
  const visibleRows = showAll ? rows : rows.slice(0, TOP_ROWS);
  const hiddenCount = rows.length - TOP_ROWS;

  const hand = useHandFont();

  const viewWords = useMemo<ChoiceWord<SpendingView>[]>(
    () => [
      { value: 'house', label: t('spending.house_label') },
      { value: 'personal', label: t('spending.personal_label') },
    ],
    [t]
  );

  const renderItem = useCallback(
    ({ item }: { item: CategoryRowItem }): React.JSX.Element => (
      <CategoryRow item={item} currency={currency} onOpen={handleOpen} />
    ),
    [currency, handleOpen]
  );

  const keyExtractor = useCallback((item: CategoryRowItem): string => item.cat.name, []);

  const handleRetry = useCallback((): void => {
    if (houseId && userName) void load(houseId, userName);
  }, [houseId, userName, load]);

  const pageHeader = (
    <View>
      <BackLink label={t('nav.profile')} />
      <Text style={[styles.title, headingFont]} accessibilityRole="header">
        {t('spending.spending_analysis')}
      </Text>
    </View>
  );

  if (isLoading && months.length === 0) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.header}>{pageHeader}</View>
        <View style={styles.centered}>
          <LoadingSpinner size={140} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && months.length === 0) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.header}>{pageHeader}</View>
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
  // The page scrolls as one: title, the 6-month chart (tap a month to pick it)
  // and Mate's note first, then where the money went and who paid.
  const listHeader = (
    <View>
      {pageHeader}
      <View style={styles.viewWords}>
        <ChoiceWords
          options={viewWords}
          selected={viewMode}
          onSelect={handleView}
          groupLabel={t('spending.spending_analysis')}
        />
      </View>
      {hasTrend && (
        <GraphChart
          months={months}
          currency={currency}
          selectedIdx={selectedIdx}
          view={viewMode}
          onSelectMonth={handleSelectMonth}
        />
      )}
      <View style={styles.note}>
        <InsightNote
          insight={insight}
          error={insightError}
          isLoading={insightLoading}
          onRefresh={handleRefreshInsight}
        />
      </View>
      {rows.length > 0 && (
        <>
          <Text style={[styles.section, headingFont]} accessibilityRole="header">
            {t('spending.where_it_went')}
          </Text>
          <SpendStrip rows={rows} />
        </>
      )}
    </View>
  );

  const listFooter = (
    <View>
      {hiddenCount > 0 && (
        <Pressable
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}
          onPress={handleToggleAll}
          accessibilityRole="button"
          accessibilityState={{ expanded: showAll }}
        >
          <Text style={styles.moreText}>
            {showAll ? t('spending.show_less') : t('spending.n_more', { count: hiddenCount })}
          </Text>
        </Pressable>
      )}
      <View style={styles.whoPaid}>
        <ContributionCards />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <FlatList
        data={visibleRows}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
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
      <CategorySheet
        item={openItem}
        month={selectedMonth?.month ?? ''}
        previousMonth={previousMonth?.month}
        view={viewMode}
        currency={currency}
        onClose={handleCloseSheet}
      />
    </SafeAreaView>
  );
}
