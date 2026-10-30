import type { MaintenanceStatus } from '@stores/maintenanceStore';
import type { ConditionLevel, EntryType } from '@stores/conditionStore';

type Translate = (key: string) => string;

// Categories and areas are stored as English words; show them in the app's
// language when they're one of the presets, and as typed otherwise.
const toKey = (label: string): string =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

const CATEGORY_KEYS = new Set([
  'plumbing',
  'electrical',
  'appliance',
  'structure',
  'pest',
  'other',
]);
const AREA_KEYS = new Set([
  'living_room',
  'kitchen',
  'bathroom',
  'master_bedroom',
  'bedroom_2',
  'bedroom_3',
  'hallway',
  'balcony_garden',
  'appliances',
  'other',
]);

export function categoryLabel(t: Translate, label: string): string {
  const key = toKey(label);
  return CATEGORY_KEYS.has(key) ? t(`maintenance.cat_${key}`) : label;
}

export function areaLabel(t: Translate, label: string): string {
  const key = toKey(label);
  return AREA_KEYS.has(key) ? t(`condition.area_${key}`) : label;
}

export function statusLabel(t: Translate, status: MaintenanceStatus): string {
  return t(`maintenance.status_${status}`);
}

export function conditionLabel(t: Translate, level: ConditionLevel): string {
  return t(`condition.level_${level}`);
}

export function entryTypeLabel(t: Translate, type: EntryType): string {
  return type === 'update' ? t('condition.type_update') : t(`condition.${type}`);
}
