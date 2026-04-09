import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, TextInput, Image } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
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
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

type FilterType = 'all' | EntryType;

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function getAreaIcon(area: string): string {
  return PRESET_AREAS.find((a) => a.label === area)?.icon ?? '📝';
}

// ── Entry card ────────────────────────────────────────────────────────────────

function EntryCard({ entry }: { entry: ConditionEntry }): React.JSX.Element {
  const remove = useConditionStore((s) => s.remove);
  const cond = CONDITION_CONFIG[entry.condition];
  const type = ENTRY_TYPE_CONFIG[entry.type];

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
              <Text style={[styles.condBadgeText, { color: cond.color }]}>{cond.icon} {cond.label}</Text>
            </View>
          </View>
          <Text style={styles.entryDate}>
            {formatDate(entry.date)} · by {entry.recordedBy}
          </Text>
        </View>
        <Pressable onPress={() => remove(entry.id)} style={styles.removeBtn}>
          <Text style={styles.removeBtnText}>✕</Text>
        </Pressable>
      </View>
      {entry.description ? (
        <Text style={styles.entryDescription}>{entry.description}</Text>
      ) : null}

      {entry.photos && entry.photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
          {entry.photos.map((src, i) => (
            <Image key={i} source={{ uri: src }} style={styles.photoThumb} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ── Add form ──────────────────────────────────────────────────────────────────

function AddEntryForm({ onClose, recordedBy, houseId }: { onClose: () => void; recordedBy: string; houseId: string }): React.JSX.Element {
  const { t } = useTranslation();
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
      await add({ area: finalArea, condition, type, description: description.trim(), recordedBy, date, photos }, houseId);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('condition.failed_save'));
      setIsSaving(false);
    }
  }, [finalArea, condition, type, description, recordedBy, date, photos, add, onClose, houseId]);

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>{t('condition.log_condition')}</Text>

      {/* Entry type */}
      <Text style={styles.fieldLabel}>{t('condition.type')}</Text>
      <View style={styles.chipRow}>
        {(Object.keys(ENTRY_TYPE_CONFIG) as EntryType[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.chip, type === t && styles.chipActive]}
            onPress={() => setType(t)}
          >
            <Text style={[styles.chipText, type === t && styles.chipTextActive]}>
              {ENTRY_TYPE_CONFIG[t].label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Area */}
      <Text style={styles.fieldLabel}>{t('condition.room_area')}</Text>
      <View style={styles.areaGrid}>
        {PRESET_AREAS.map((a) => (
          <Pressable
            key={a.label}
            style={[styles.areaChip, !useCustom && area === a.label && styles.areaChipActive]}
            onPress={() => { setArea(a.label); setUseCustom(false); }}
          >
            <Text style={styles.areaChipIcon}>{a.icon}</Text>
            <Text style={[styles.areaChipText, !useCustom && area === a.label && styles.areaChipTextActive]}>
              {a.label}
            </Text>
          </Pressable>
        ))}
        <Pressable
          style={[styles.areaChip, useCustom && styles.areaChipActive]}
          onPress={() => setUseCustom(true)}
        >
          <Text style={styles.areaChipIcon}>✏️</Text>
          <Text style={[styles.areaChipText, useCustom && styles.areaChipTextActive]}>{t('condition.custom')}</Text>
        </Pressable>
      </View>
      {useCustom && (
        <TextInput
          style={styles.input}
          value={customArea}
          onChangeText={setCustomArea}
          placeholder={t('condition.room_placeholder')}
          placeholderTextColor={colors.textDisabled}
          autoFocus
        />
      )}

      {/* Condition */}
      <Text style={styles.fieldLabel}>{t('condition.condition_label')}</Text>
      <View style={styles.chipRow}>
        {(Object.keys(CONDITION_CONFIG) as ConditionLevel[]).map((c) => {
          const cfg = CONDITION_CONFIG[c];
          return (
            <Pressable
              key={c}
              style={[styles.condChip, { borderColor: cfg.color + '60' }, condition === c && { backgroundColor: cfg.color, borderColor: cfg.color }]}
              onPress={() => setCondition(c)}
            >
              <Text style={[styles.condChipText, condition === c && styles.condChipTextActive]}>
                {cfg.icon} {cfg.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Date */}
      <Text style={styles.fieldLabel}>{t('condition.date')}</Text>
      <DateInput value={date} onChange={setDate} />

      {/* Description */}
      <Text style={styles.fieldLabel}>{t('condition.notes')}</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={description}
        onChangeText={setDescription}
        placeholder={t('condition.notes_placeholder')}
        placeholderTextColor={colors.textDisabled}
        multiline
        numberOfLines={3}
      />

      <Text style={styles.fieldLabel}>{t('condition.photos_up_to')}</Text>
      <PhotoPicker photos={photos} onChange={setPhotos} maxPhotos={6} />

      {!!saveError && <Text style={styles.saveError}>{saveError}</Text>}

      <View style={styles.formActions}>
        <Pressable style={styles.cancelBtn} onPress={onClose} disabled={isSaving}>
          <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
        </Pressable>
        <Pressable
          style={[styles.saveBtn, (!finalArea || isSaving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!finalArea || isSaving}
        >
          <Text style={styles.saveBtnText}>{isSaving ? t('condition.saving') : t('condition.save_entry')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ConditionScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const entries = useConditionStore((s) => s.entries);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');

  const filtered = useMemo(() =>
    filter === 'all' ? entries : entries.filter((e) => e.type === filter),
    [entries, filter]
  );

  // Group by area, preserving chronological order within each area
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        <View style={styles.pageHeader}>
          <Text style={styles.heading}>{t('condition.title')}</Text>
          <Text style={styles.headingSub}>{t('condition.subtitle')}</Text>
        </View>

        {/* Stats strip */}
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
              <Text style={[styles.statNum, { color: hasDamage ? colors.danger : colors.positive }]}>
                {hasDamage ? '⚠️' : '✓'}
              </Text>
              <Text style={styles.statLbl}>{hasDamage ? t('condition.issues_found') : t('condition.all_good')}</Text>
            </View>
          </View>
        )}

        {/* Add / form */}
        {showForm ? (
          <AddEntryForm onClose={() => setShowForm(false)} recordedBy={profile?.name ?? 'Someone'} houseId={houseId ?? ''} />
        ) : (
          <Pressable style={styles.addBtn} onPress={() => setShowForm(true)}>
            <Text style={styles.addBtnText}>{t('condition.add_record')}</Text>
          </Pressable>
        )}

        {/* Filter bar */}
        {totalEntries > 0 && (
          <View style={styles.filterBar}>
            {FILTERS.map((f) => (
              <Pressable
                key={f.key}
                style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Empty */}
        {totalEntries === 0 && !showForm && (
          <View style={styles.emptySection}>
            <Text style={styles.emptyTitle}>{t('condition.no_records')}</Text>
            <Text style={styles.emptyText}>{t('condition.no_records_hint')}</Text>
          </View>
        )}

        {/* Grouped entries */}
        {grouped.map(([area, areaEntries]) => (
          <View key={area} style={styles.areaGroup}>
            <View style={styles.areaGroupHeader}>
              <Text style={styles.areaGroupIcon}>{getAreaIcon(area)}</Text>
              <Text style={styles.areaGroupName}>{area}</Text>
              <View style={[styles.condDot, { backgroundColor: CONDITION_CONFIG[areaEntries[0].condition].color }]} />
            </View>
            {areaEntries.map((e) => <EntryCard key={e.id} entry={e} />)}
          </View>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: sizes.lg, paddingBottom: 60, gap: sizes.sm },

  pageHeader: { marginBottom: sizes.xs },
  heading: { fontSize: 26, ...font.extrabold, color: colors.textPrimary, letterSpacing: -0.5 },
  headingSub: { fontSize: sizes.fontSm, ...font.regular, color: colors.textSecondary, marginTop: 2 },

  statsStrip: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 16, padding: sizes.md, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' } as never,
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statNum: { fontSize: sizes.fontLg, ...font.extrabold, color: colors.textPrimary },
  statLbl: { fontSize: sizes.fontXs, ...font.regular, color: colors.textSecondary },
  statDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: sizes.xs },

  addBtn: { borderWidth: 2, borderColor: colors.primary + '40', borderStyle: 'dashed', borderRadius: 14, paddingVertical: sizes.md, alignItems: 'center' },
  addBtnText: { color: colors.primary, ...font.semibold, fontSize: sizes.fontMd },

  filterBar: { flexDirection: 'row', gap: sizes.xs, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: sizes.md, paddingVertical: 6, borderRadius: sizes.borderRadiusFull, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: sizes.fontSm, ...font.semibold, color: colors.textSecondary },
  filterChipTextActive: { color: colors.white },

  areaGroup: { gap: 6 },
  areaGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: sizes.xs, paddingVertical: 4 },
  areaGroupIcon: { fontSize: 18 },
  areaGroupName: { fontSize: sizes.fontSm, ...font.bold, color: colors.textPrimary, flex: 1 },
  condDot: { width: 10, height: 10, borderRadius: 5 },

  entryCard: { backgroundColor: colors.white, borderRadius: 12, padding: sizes.sm, gap: sizes.xs, marginLeft: sizes.md, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' } as never,
  entryHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: sizes.sm },
  entryMeta: { flex: 1, gap: 3 },
  entryBadgeRow: { flexDirection: 'row', gap: sizes.xs, flexWrap: 'wrap' },
  typeBadge: { borderRadius: sizes.borderRadiusFull, paddingHorizontal: sizes.xs, paddingVertical: 2 },
  typeBadgeText: { fontSize: 11, ...font.bold },
  condBadge: { borderRadius: sizes.borderRadiusFull, paddingHorizontal: sizes.xs, paddingVertical: 2 },
  condBadgeText: { fontSize: 11, ...font.bold },
  entryDate: { fontSize: sizes.fontXs, ...font.regular, color: colors.textSecondary },
  entryDescription: { fontSize: sizes.fontSm, ...font.regular, color: colors.textSecondary, lineHeight: 18, marginLeft: sizes.lg + sizes.sm },
  photoRow: { marginLeft: sizes.lg + sizes.sm, marginTop: 2 },
  photoThumb: { width: 80, height: 80, borderRadius: sizes.borderRadiusSm, marginRight: sizes.xs, borderWidth: 1, borderColor: colors.border },
  removeBtn: { padding: 4 },
  removeBtnText: { color: colors.textDisabled, fontSize: sizes.fontXs },

  form: { backgroundColor: colors.white, borderRadius: 16, padding: sizes.md, gap: sizes.sm, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' } as never,
  formTitle: { fontSize: 17, ...font.bold, color: colors.textPrimary, marginBottom: sizes.xs },
  fieldLabel: { fontSize: 12, ...font.semibold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.xs },
  chip: { paddingHorizontal: sizes.sm, paddingVertical: 6, borderRadius: sizes.borderRadiusFull, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: sizes.fontSm, ...font.medium, color: colors.textPrimary },
  chipTextActive: { color: colors.white },
  areaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.xs },
  areaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: sizes.sm, paddingVertical: 6, borderRadius: sizes.borderRadiusSm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  areaChipActive: { backgroundColor: colors.primary + '12', borderColor: colors.primary },
  areaChipIcon: { fontSize: 14 },
  areaChipText: { fontSize: sizes.fontSm, ...font.medium, color: colors.textPrimary },
  areaChipTextActive: { color: colors.primary, ...font.bold },
  condChip: { paddingHorizontal: sizes.sm, paddingVertical: 6, borderRadius: sizes.borderRadiusFull, borderWidth: 2, backgroundColor: colors.white },
  condChipText: { fontSize: sizes.fontSm, ...font.semibold, color: colors.textPrimary },
  condChipTextActive: { color: colors.white },
  input: { backgroundColor: colors.background, borderRadius: sizes.borderRadiusSm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: sizes.sm, paddingVertical: sizes.sm, fontSize: sizes.fontMd, color: colors.textPrimary, ...font.regular },
  inputMultiline: { height: 80, textAlignVertical: 'top' },
  saveError: { color: colors.danger, fontSize: sizes.fontSm, ...font.regular },
  formActions: { flexDirection: 'row', gap: sizes.sm, justifyContent: 'flex-end', marginTop: sizes.xs },
  cancelBtn: { paddingHorizontal: sizes.md, paddingVertical: sizes.sm, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  cancelBtnText: { color: colors.textSecondary, ...font.medium },
  saveBtn: { backgroundColor: colors.primary, paddingHorizontal: sizes.md, paddingVertical: sizes.sm, borderRadius: 12 },
  saveBtnDisabled: { backgroundColor: colors.textDisabled },
  saveBtnText: { color: colors.white, ...font.semibold },

  emptySection: { alignItems: 'center', paddingVertical: sizes.xl, gap: sizes.sm },
  emptyTitle: { fontSize: sizes.fontMd, ...font.bold, color: colors.textPrimary },
  emptyText: { fontSize: sizes.fontSm, ...font.regular, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
