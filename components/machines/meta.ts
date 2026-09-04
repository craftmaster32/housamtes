import { Ionicons } from '@expo/vector-icons';
import type { ApplianceKind } from '@stores/appliancesStore';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// One place for each machine's icon, accent colour, and i18n label key so the
// machines page, the start sheet, and the dashboard cards all stay in sync.
export const MACHINE_META: Record<
  ApplianceKind,
  { icon: IoniconName; labelKey: string; color: string }
> = {
  washer: { icon: 'shirt-outline', labelKey: 'machines.washer', color: '#3B6FBF' },
  dryer: { icon: 'flame-outline', labelKey: 'machines.dryer', color: '#E8892B' },
  dishwasher: { icon: 'restaurant-outline', labelKey: 'machines.dishwasher', color: '#2FA37A' },
};

// Built-in starting points offered before the house has saved its own presets.
export const DEFAULT_PRESET_MINUTES = [30, 60, 90, 120];

/** "1h 30m" / "45m" / "2h" — compact duration from a whole number of minutes. */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Friendly countdown from a millisecond remainder. Shows the two most relevant
 * units so it stays readable as it ticks: "1h 23m", then "23m 5s", then "9s".
 */
export function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
