import { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import {
  useConditionStore,
  PRESET_AREAS,
  type EntryType,
  type ConditionEntry,
} from '@stores/conditionStore';
import { lightColors, useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { areaLabel } from '@utils/propertyLabels';
import { LoadingSpinner } from '@components/shared/LoadingSpinner';
import { Mate } from '@components/shared/Mate';
import { PaperTag } from '@components/bills/recurring/PaperTag';
import { ChoiceWords, type ChoiceWord } from '@components/settings/ChoiceWords';
import { ConditionEntryRow } from '@components/property/ConditionEntryRow';
import { ConditionSheet } from '@components/property/ConditionSheet';
import { mf, ms } from '@utils/responsive';

type FilterType = 'all' | EntryType;
const P = lightColors;
const BOARD = '#B88A58';
const SHEET = '#FFFDF6';

/**
 * The condition log as an inspection sheet on a clipboard: one heading per
 * room, each record a line with the verdict circled in its colour.
 */
export function ConditionTab(): React.JSX.Element {
  const c = useThemedColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const heading = useHeadingFont('semibold');
  const hand = useHandFont();
  const { t } = useTranslation();
  const entries = useConditionStore((s) => s.entries);
  const isLoading = useConditionStore((s) => s.isLoading);
  const error = useConditionStore((s) => s.error);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');

  const filtered = useMemo(
    () => (filter === 'all' ? entries : entries.filter((e) => e.type === filter)),
    [entries, filter]
  );
  const grouped = useMemo(() => {
    const map = new Map<string, ConditionEntry[]>();
    for (const e of filtered) {
      if (!map.has(e.area)) map.set(e.area, []);
      map.get(e.area)?.push(e);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const hasDamage = entries.some((e) => e.condition === 'poor');
  const areaCount = new Set(entries.map((e) => e.area)).size;
  const filters: ChoiceWord<FilterType>[] = [
    { value: 'all', label: t('condition.all') },
    { value: 'move_in', label: t('condition.move_in') },
    { value: 'update', label: t('condition.updates') },
    { value: 'damage', label: t('condition.damage') },
  ];

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <LoadingSpinner accessibilityLabel={t('common.loading')} />
      </View>
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>{t('condition.subtitle')}</Text>
        <View style={styles.tagRow}>
          <PaperTag
            label={t('condition.add_record').replace(/^\+\s*/, '')}
            onPress={() => setShowForm(true)}
          />
        </View>
        {!!error && <Text style={styles.error}>{error}</Text>}

        {entries.length === 0 ? (
          <View style={styles.empty}>
            <Mate size={ms(80)} />
            <Text style={[styles.emptyTitle, hand]}>{t('condition.no_records')}</Text>
            <Text style={styles.emptyText}>{t('condition.no_records_hint')}</Text>
          </View>
        ) : (
          <>
            <ChoiceWords
              options={filters}
              selected={filter}
              onSelect={setFilter}
              groupLabel={t('condition.type')}
            />
            <View style={styles.board}>
              {/* The metal clip holding the sheet. */}
              <View style={styles.clip} pointerEvents="none">
                <View style={styles.clipHole} />
              </View>
              <View style={styles.sheet}>
                <Text style={[styles.tally, hand]}>
                  {entries.length} {t('condition.records')} · {areaCount} {t('condition.areas')} ·{' '}
                  <Text style={[hand, { color: hasDamage ? P.negative : P.positive }]}>
                    {hasDamage ? t('condition.issues_found') : t('condition.all_good')}
                  </Text>
                </Text>
                {grouped.map(([area, areaEntries]) => {
                  const icon =
                    PRESET_AREAS.find((a) => a.label === area)?.icon ?? 'document-text-outline';
                  return (
                    <View key={area} style={styles.area}>
                      <View style={styles.areaHead} accessibilityRole="header">
                        <Ionicons name={icon} size={16} color={P.paperMuted} />
                        <Text style={[styles.areaName, heading]}>{areaLabel(t, area)}</Text>
                      </View>
                      {areaEntries.map((e) => (
                        <ConditionEntryRow key={e.id} entry={e} />
                      ))}
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </ScrollView>
      <ConditionSheet
        visible={showForm}
        recordedBy={profile?.id ?? ''}
        houseId={houseId ?? ''}
        onClose={() => setShowForm(false)}
      />
    </>
  );
}

const makeStyles = (C: ColorTokens): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    centered: { paddingVertical: ms(60), alignItems: 'center' },
    scroll: { paddingHorizontal: ms(20), paddingBottom: ms(60) },
    subtitle: { fontSize: mf(14), lineHeight: mf(20), ...font.regular, color: C.textSecondary },
    tagRow: { flexDirection: 'row', marginTop: ms(12), marginBottom: ms(12) },
    error: { fontSize: mf(13), ...font.regular, color: C.danger, marginBottom: ms(10) },
    board: {
      backgroundColor: BOARD,
      borderRadius: ms(14),
      padding: ms(10),
      paddingTop: ms(26),
      marginTop: ms(10),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: ms(3) },
      shadowOpacity: 0.18,
      shadowRadius: 6,
      elevation: 3,
    },
    clip: {
      position: 'absolute',
      top: -ms(8),
      alignSelf: 'center',
      width: ms(110),
      height: ms(30),
      borderRadius: ms(8),
      backgroundColor: '#B9BCC0',
      borderWidth: 2,
      borderColor: '#8F9399',
      zIndex: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    clipHole: { width: ms(34), height: ms(9), borderRadius: ms(5), backgroundColor: BOARD },
    sheet: {
      backgroundColor: SHEET,
      borderRadius: ms(3),
      paddingHorizontal: ms(14),
      paddingTop: ms(18),
      paddingBottom: ms(10),
    },
    tally: { fontSize: mf(19), lineHeight: mf(23), color: P.paperMuted, marginBottom: ms(6) },
    area: { marginTop: ms(12) },
    areaHead: { flexDirection: 'row', alignItems: 'center', gap: ms(7), marginBottom: ms(4) },
    areaName: { fontSize: mf(19), lineHeight: mf(25), color: P.paperInk },
    empty: { alignItems: 'center', paddingVertical: ms(24), gap: ms(8) },
    emptyTitle: { fontSize: mf(22), lineHeight: mf(26), color: C.textPrimary, textAlign: 'center' },
    emptyText: {
      fontSize: mf(13.5),
      lineHeight: mf(19),
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      paddingHorizontal: ms(16),
    },
  });
