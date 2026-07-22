import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, TextInput, type ImageStyle } from 'react-native';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { resolveName } from '@utils/housemates';
import {
  useConditionStore,
  PRESET_AREAS,
  CONDITION_CONFIG,
  ENTRY_TYPE_CONFIG,
  type ConditionLevel,
  type EntryType,
  type ConditionEntry,
} from '@stores/conditionStore';
import { DateInput } from '@components/shared/DateInput';
import { PhotoPicker } from '@components/shared/PhotoPicker';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { getErrorMessage } from '@utils/errors';
import { formatDateDDMMYYYY } from '@utils/dates';

type FilterType = 'all' | EntryType;

// Areas carry an emoji in the store; render a line icon here instead so the
// page speaks one visual language (no emoji beside icons).
const AREA_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  'Living Room': 'tv-outline',
  Kitchen: 'restaurant-outline',
  Bathroom: 'water-outline',
  'Master Bedroom': 'bed-outline',
  'Bedroom 2': 'bed-outline',
  'Bedroom 3': 'bed-outline',
  Hallway: 'walk-outline',
  'Balcony/Garden': 'leaf-outline',
  Appliances: 'cog-outline',
  Other: 'document-text-outline',
};
function getAreaIcon(area: string): React.ComponentProps<typeof Ionicons>['name'] {
  return AREA_ICONS[area] ?? 'document-text-outline';
}

function EntryCard({ entry }: { entry: ConditionEntry }): React.JSX.Element {
  const c = useThemedColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const remove = useConditionStore((s) => s.remove);
  const housemates = useHousematesStore((s) => s.housemates);
  const cond = CONDITION_CONFIG[entry.condition];
  const type = ENTRY_TYPE_CONFIG[entry.type];

  const handleRemove = useCallback(() => {
    void remove(entry.id);
  }, [entry.id, remove]);

  return (
    <View style={styles.entryCard}>
      <View style={styles.entryHeader}>
        <View style={[styles.condDot, { backgroundColor: cond.color }]} />
        <View style={styles.entryMeta}>
          <View style={styles.entryBadgeRow}>
            <View style={[styles.typeBadge, { backgroundColor: type.color + '18' }]}>
              <Text style={[styles.typeBadgeText, { color: type.color }]}>{type.label}</Text>
            </View>
            <View style={[styles.condBadge, { backgroundColor: cond.color + '18' }]}>
              <View style={[styles.condBadgeDot, { backgroundColor: cond.color }]} />
              <Text style={[styles.condBadgeText, { color: cond.color }]}>{cond.label}</Text>
            </View>
          </View>
          <Text style={styles.entryDate}>
            {formatDateDDMMYYYY(entry.date)} · {t('common.by')}{' '}
            {resolveName(entry.recordedBy, housemates)}
          </Text>
        </View>
        <Pressable
          onPress={handleRemove}
          style={styles.removeBtn}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('common.delete')}
        >
          <Ionicons name="close" size={18} color={c.textTertiary} />
        </Pressable>
      </View>
      {entry.description ? <Text style={styles.entryDescription}>{entry.description}</Text> : null}

      {entry.photos && entry.photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
          {entry.photos.map((src, i) => (
            <Image
              key={i}
              source={{ uri: src }}
              style={styles.photoThumb as ImageStyle}
              accessibilityLabel={`Photo ${i + 1} of ${entry.photos!.length}`}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function AddEntryForm({
  onClose,
  recordedBy,
  houseId,
}: {
  onClose: () => void;
  recordedBy: string;
  houseId: string;
}): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const add = useConditionStore((s) => s.add);
  const todayStr = new Date().toISOString().split('T')[0];

  const [area, setArea] = useState(PRESET_AREAS[0].label);
  const [customArea, setCustomArea] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [condition, setCondition] = useState<ConditionLevel>('good');
  const [type, setType] = useState<EntryType>('move_in');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayStr);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const finalArea = useCustom ? customArea.trim() : area;

  const handleSave = useCallback(async () => {
    if (!finalArea) return;
    setIsSaving(true);
    setSaveError('');
    try {
      await add(
        {
          area: finalArea,
          condition,
          type,
          description: description.trim(),
          recordedBy,
          date,
          photos,
        },
        houseId
      );
      onClose();
    } catch (err) {
      setSaveError(getErrorMessage(err, t('condition.failed_save')));
      setIsSaving(false);
    }
  }, [finalArea, condition, type, description, recordedBy, date, photos, add, onClose, houseId, t]);

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>{t('condition.log_condition')}</Text>

      <Text style={styles.fieldLabel}>{t('condition.type')}</Text>
      <View style={styles.chipRow}>
        {(Object.keys(ENTRY_TYPE_CONFIG) as EntryType[]).map((k) => (
          <Pressable
            key={k}
            style={[styles.chip, type === k && styles.chipActive]}
            onPress={() => setType(k)}
            accessible
            accessibilityRole="radio"
            accessibilityLabel={ENTRY_TYPE_CONFIG[k].label}
            accessibilityState={{ selected: type === k }}
          >
            <Text style={[styles.chipText, type === k && styles.chipTextActive]}>
              {ENTRY_TYPE_CONFIG[k].label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.fieldLabel}>{t('condition.room_area')}</Text>
      <View style={styles.areaGrid}>
        {PRESET_AREAS.map((a) => (
          <Pressable
            key={a.label}
            style={[styles.areaChip, !useCustom && area === a.label && styles.areaChipActive]}
            onPress={() => {
              setArea(a.label);
              setUseCustom(false);
            }}
            accessible
            accessibilityRole="radio"
            accessibilityLabel={a.label}
            accessibilityState={{ selected: !useCustom && area === a.label }}
          >
            <Ionicons
              name={getAreaIcon(a.label)}
              size={14}
              color={!useCustom && area === a.label ? c.primary : c.textSecondary}
            />
            <Text
              style={[
                styles.areaChipText,
                !useCustom && area === a.label && styles.areaChipTextActive,
              ]}
            >
              {a.label}
            </Text>
          </Pressable>
        ))}
        <Pressable
          style={[styles.areaChip, useCustom && styles.areaChipActive]}
          onPress={() => setUseCustom(true)}
          accessible
          accessibilityRole="radio"
          accessibilityLabel={t('condition.custom')}
          accessibilityState={{ selected: useCustom }}
        >
          <Ionicons
            name="create-outline"
            size={14}
            color={useCustom ? c.primary : c.textSecondary}
          />
          <Text style={[styles.areaChipText, useCustom && styles.areaChipTextActive]}>
            {t('condition.custom')}
          </Text>
        </Pressable>
      </View>
      {useCustom && (
        <TextInput
          style={styles.input}
          value={customArea}
          onChangeText={setCustomArea}
          placeholder={t('condition.room_placeholder')}
          placeholderTextColor={c.textDisabled}
          autoFocus
          maxLength={60}
          accessibilityLabel={t('condition.room_area')}
          accessibilityHint={t('condition.room_placeholder')}
        />
      )}

      <Text style={styles.fieldLabel}>{t('condition.condition_label')}</Text>
      <View style={styles.chipRow}>
        {(Object.keys(CONDITION_CONFIG) as ConditionLevel[]).map((c) => {
          const cfg = CONDITION_CONFIG[c];
          return (
            <Pressable
              key={c}
              style={[
                styles.condChip,
                { borderColor: cfg.color + '60' },
                condition === c && { backgroundColor: cfg.color, borderColor: cfg.color },
              ]}
              onPress={() => setCondition(c)}
              accessible
              accessibilityRole="radio"
              accessibilityLabel={cfg.label}
              accessibilityState={{ selected: condition === c }}
            >
              <Text style={[styles.condChipText, condition === c && styles.condChipTextActive]}>
                {cfg.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.fieldLabel}>{t('condition.date')}</Text>
      <DateInput value={date} onChange={setDate} />

      <Text style={styles.fieldLabel}>{t('condition.notes')}</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={description}
        onChangeText={setDescription}
        placeholder={t('condition.notes_placeholder')}
        placeholderTextColor={c.textDisabled}
        multiline
        numberOfLines={3}
        maxLength={1000}
        accessibilityLabel={t('condition.notes')}
        accessibilityHint={t('condition.notes_placeholder')}
      />

      <Text style={styles.fieldLabel}>{t('condition.photos_up_to')}</Text>
      <PhotoPicker photos={photos} onChange={setPhotos} maxPhotos={6} />

      {!!saveError && <Text style={styles.saveError}>{saveError}</Text>}

      <View style={styles.formActions}>
        <Pressable
          style={styles.cancelBtn}
          onPress={onClose}
          disabled={isSaving}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          accessibilityState={{ disabled: isSaving }}
        >
          <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
        </Pressable>
        <Pressable
          style={[styles.saveBtn, (!finalArea || isSaving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!finalArea || isSaving}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('condition.save_entry')}
          accessibilityState={{ disabled: !finalArea || isSaving }}
        >
          <Text style={styles.saveBtnText}>
            {isSaving ? t('condition.saving') : t('condition.save_entry')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function ConditionTab(): React.JSX.Element {
  const c = useThemedColors();
  const styles = useMemo(() => makeStyles(c), [c]);
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
      map.get(e.area)!.push(e);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const hasDamage = entries.some((e) => e.condition === 'poor');
  const totalEntries = entries.length;

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: 'all', label: t('condition.all') },
    { key: 'move_in', label: t('condition.move_in') },
    { key: 'update', label: t('condition.updates') },
    { key: 'damage', label: t('condition.damage') },
  ];

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {!!error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      {totalEntries > 0 && (
        <View style={styles.statsStrip}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{totalEntries}</Text>
            <Text style={styles.statLbl}>{t('condition.records')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{grouped.length}</Text>
            <Text style={styles.statLbl}>{t('condition.areas')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons
              name={hasDamage ? 'warning' : 'checkmark-circle'}
              size={22}
              color={hasDamage ? c.danger : c.positive}
            />
            <Text style={styles.statLbl}>
              {hasDamage ? t('condition.issues_found') : t('condition.all_good')}
            </Text>
          </View>
        </View>
      )}

      {showForm ? (
        <AddEntryForm
          onClose={() => setShowForm(false)}
          recordedBy={profile?.id ?? ''}
          houseId={houseId ?? ''}
        />
      ) : (
        <Pressable
          style={styles.addBtn}
          onPress={() => setShowForm(true)}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('condition.add_record')}
        >
          <Text style={styles.addBtnText}>{t('condition.add_record')}</Text>
        </Pressable>
      )}

      {totalEntries > 0 && (
        <View style={styles.filterBar}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
              onPress={() => setFilter(f.key)}
              accessible
              accessibilityRole="radio"
              accessibilityLabel={f.label}
              accessibilityState={{ selected: filter === f.key }}
            >
              <Text
                style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}
              >
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {totalEntries === 0 && !showForm && (
        <View style={styles.emptySection}>
          <Text style={styles.emptyTitle}>{t('condition.no_records')}</Text>
          <Text style={styles.emptyText}>{t('condition.no_records_hint')}</Text>
        </View>
      )}

      {grouped.map(([area, areaEntries]) => (
        <View key={area} style={styles.areaGroup}>
          <View style={styles.areaGroupHeader}>
            <View style={styles.areaGroupIcon}>
              <Ionicons name={getAreaIcon(area)} size={15} color={c.primary} />
            </View>
            <Text style={styles.areaGroupName}>{area}</Text>
            <View
              style={[
                styles.condDot,
                { backgroundColor: CONDITION_CONFIG[areaEntries[0].condition].color },
              ]}
            />
          </View>
          {areaEntries.map((e) => (
            <EntryCard key={e.id} entry={e} />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const makeStyles = (C: ColorTokens): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    scroll: { padding: sizes.lg, paddingBottom: 60, gap: sizes.sm },

    statsStrip: {
      flexDirection: 'row',
      backgroundColor: C.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border,
      padding: sizes.md,
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    } as never,
    statItem: { flex: 1, alignItems: 'center', gap: 2 },
    statNum: { fontSize: sizes.fontLg, ...font.extrabold, color: C.textPrimary },
    statLbl: { fontSize: sizes.fontXs, ...font.regular, color: C.textSecondary },
    statDivider: { width: 1, backgroundColor: C.border, marginHorizontal: sizes.xs },

    addBtn: {
      borderWidth: 2,
      borderColor: C.primary + '40',
      borderStyle: 'dashed',
      borderRadius: 14,
      paddingVertical: sizes.md,
      alignItems: 'center',
    },
    addBtnText: { color: C.primary, ...font.semibold, fontSize: sizes.fontMd },

    filterBar: { flexDirection: 'row', gap: sizes.xs, flexWrap: 'wrap' },
    filterChip: {
      paddingHorizontal: sizes.md,
      paddingVertical: 6,
      borderRadius: sizes.borderRadiusFull,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
    },
    filterChipActive: { backgroundColor: C.primary, borderColor: C.primary },
    filterChipText: { fontSize: sizes.fontSm, ...font.semibold, color: C.textSecondary },
    filterChipTextActive: { color: '#fff' },

    areaGroup: { gap: 6 },
    areaGroupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sizes.xs,
      paddingVertical: 4,
    },
    areaGroupIcon: {
      width: 28,
      height: 28,
      borderRadius: 9,
      backgroundColor: C.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    areaGroupName: { fontSize: sizes.fontSm, ...font.bold, color: C.textPrimary, flex: 1 },
    condDot: { width: 10, height: 10, borderRadius: 5 },

    entryCard: {
      backgroundColor: C.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      padding: sizes.sm,
      gap: sizes.xs,
      marginStart: sizes.md,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    } as never,
    entryHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: sizes.sm },
    entryMeta: { flex: 1, gap: 3 },
    entryBadgeRow: { flexDirection: 'row', gap: sizes.xs, flexWrap: 'wrap' },
    typeBadge: {
      borderRadius: sizes.borderRadiusFull,
      paddingHorizontal: sizes.xs,
      paddingVertical: 2,
    },
    typeBadgeText: { fontSize: 11, ...font.bold },
    condBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: sizes.borderRadiusFull,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    condBadgeDot: { width: 6, height: 6, borderRadius: 3 },
    condBadgeText: { fontSize: 11, ...font.bold },
    entryDate: { fontSize: sizes.fontXs, ...font.regular, color: C.textSecondary },
    entryDescription: {
      fontSize: sizes.fontSm,
      ...font.regular,
      color: C.textSecondary,
      lineHeight: 18,
      marginStart: sizes.lg + sizes.sm,
    },
    photoRow: { marginStart: sizes.lg + sizes.sm, marginTop: 2 },
    photoThumb: {
      width: 80,
      height: 80,
      borderRadius: sizes.borderRadiusSm,
      marginEnd: sizes.xs,
      borderWidth: 1,
      borderColor: C.border,
    },
    removeBtn: {
      padding: 8,
      minWidth: sizes.touchTarget,
      minHeight: sizes.touchTarget,
      justifyContent: 'center',
      alignItems: 'center',
    },

    form: {
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: sizes.md,
      gap: sizes.sm,
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    } as never,
    formTitle: { fontSize: 17, ...font.bold, color: C.textPrimary, marginBottom: sizes.xs },
    fieldLabel: {
      fontSize: 12,
      ...font.semibold,
      color: C.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.xs },
    chip: {
      paddingHorizontal: sizes.sm,
      paddingVertical: 6,
      borderRadius: sizes.borderRadiusFull,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surface,
    },
    chipActive: { backgroundColor: C.primary, borderColor: C.primary },
    chipText: { fontSize: sizes.fontSm, ...font.medium, color: C.textPrimary },
    chipTextActive: { color: '#fff' },
    areaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.xs },
    areaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: sizes.sm,
      paddingVertical: 6,
      borderRadius: sizes.borderRadiusSm,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surface,
    },
    areaChipActive: { backgroundColor: C.primary + '12', borderColor: C.primary },
    areaChipText: { fontSize: sizes.fontSm, ...font.medium, color: C.textPrimary },
    areaChipTextActive: { color: C.primary, ...font.bold },
    condChip: {
      paddingHorizontal: sizes.sm,
      paddingVertical: 6,
      borderRadius: sizes.borderRadiusFull,
      borderWidth: 2,
      backgroundColor: C.surface,
    },
    condChipText: { fontSize: sizes.fontSm, ...font.semibold, color: C.textPrimary },
    condChipTextActive: { color: '#fff' },
    input: {
      backgroundColor: C.background,
      borderRadius: sizes.borderRadiusSm,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: sizes.sm,
      paddingVertical: sizes.sm,
      fontSize: sizes.fontMd,
      color: C.textPrimary,
      ...font.regular,
    },
    inputMultiline: { height: 80, textAlignVertical: 'top' },
    saveError: { color: C.danger, fontSize: sizes.fontSm, ...font.regular },
    formActions: {
      flexDirection: 'row',
      gap: sizes.sm,
      justifyContent: 'flex-end',
      marginTop: sizes.xs,
    },
    cancelBtn: {
      paddingHorizontal: sizes.md,
      paddingVertical: sizes.sm,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
    },
    cancelBtnText: { color: C.textSecondary, ...font.medium },
    saveBtn: {
      backgroundColor: C.primary,
      paddingHorizontal: sizes.md,
      paddingVertical: sizes.sm,
      borderRadius: 12,
    },
    saveBtnDisabled: { backgroundColor: C.textDisabled },
    saveBtnText: { color: '#fff', ...font.semibold },

    emptySection: { alignItems: 'center', paddingVertical: sizes.xl, gap: sizes.sm },
    emptyTitle: { fontSize: sizes.fontMd, ...font.bold, color: C.textPrimary },
    emptyText: {
      fontSize: sizes.fontSm,
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
    errorBanner: {
      backgroundColor: C.danger + '15',
      borderRadius: 10,
      padding: sizes.sm,
      borderWidth: 1,
      borderColor: C.danger + '40',
    },
    errorBannerText: { fontSize: sizes.fontSm, ...font.regular, color: C.danger },
  });
