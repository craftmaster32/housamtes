import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHandFont } from '@hooks/useHandFont';
import type { EventRecurrence } from '@stores/eventsStore';
import { UnderlineInput } from '@components/bills/form/UnderlineInput';
import { ChoiceWords, type ChoiceWord } from '@components/settings/ChoiceWords';
import { PenCircle } from '@components/shared/PenCircle';
import { LineField } from '@components/parking/LineField';
import {
  UNIT_NOUN,
  WEEKDAY_KEYS,
  formatShortDate,
  recurrenceLabel,
} from '@components/calendar/calendarMeta';
import { mf, ms } from '@utils/responsive';

export type RepeatPreset = EventRecurrence | '' | 'custom';
export const CUSTOM_UNITS: EventRecurrence[] = ['daily', 'weekly', 'monthly', 'yearly'];
export const MAX_INTERVAL = 99;

interface RepeatFieldsProps {
  smartText: string;
  smartFeedback: { ok: boolean; text: string } | null;
  onSmartText: (v: string) => void;
  onApplySmart: () => void;
  activePreset: RepeatPreset;
  onPreset: (value: RepeatPreset) => void;
  customMode: boolean;
  recurrence: EventRecurrence | '';
  onUnit: (unit: EventRecurrence) => void;
  interval: number;
  onInterval: (delta: number) => void;
  days: number[];
  onToggleDay: (dow: number) => void;
  showUntil: boolean;
  until: string;
  onOpenUntil: () => void;
  onClearUntil: () => void;
}

/**
 * The "Repeat" part of the event form: describe it in words, or circle a
 * cadence; custom gets − n + with the unit circled; weekly can circle days.
 */
export function RepeatFields(p: RepeatFieldsProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const c = useThemedColors();
  const hand = useHandFont();

  const presets: ChoiceWord<RepeatPreset | 'none'>[] = [
    { value: 'none', label: t('calendar.repeat_none') },
    { value: 'daily', label: t('calendar.repeat_daily') },
    { value: 'weekly', label: t('calendar.repeat_weekly') },
    { value: 'monthly', label: t('calendar.repeat_monthly') },
    { value: 'yearly', label: t('calendar.repeat_yearly') },
    { value: 'custom', label: t('calendar.repeat_custom') },
  ];
  const units: ChoiceWord<EventRecurrence>[] = CUSTOM_UNITS.map((u) => ({
    value: u,
    label: t(`calendar.repeat_unit_${UNIT_NOUN[u]}${p.interval === 1 ? '' : 's'}`),
  }));

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: c.textSecondary }]}>{t('calendar.repeat')}</Text>

      {/* Plain-English shortcut: type it, we fill the fields in. */}
      <View style={styles.smartRow}>
        <View style={styles.smartInput}>
          <UnderlineInput
            value={p.smartText}
            onChangeText={p.onSmartText}
            placeholder={t('calendar.repeat_smart_placeholder')}
            accessibilityLabel={t('calendar.repeat_smart_label')}
            accessibilityHint={t('calendar.repeat_smart_hint')}
            returnKeyType="done"
            onSubmitEditing={p.onApplySmart}
          />
        </View>
        <Pressable
          style={({ pressed }) => [styles.fill, (!p.smartText.trim() || pressed) && styles.dim]}
          onPress={p.onApplySmart}
          disabled={!p.smartText.trim()}
          accessibilityRole="button"
          accessibilityLabel={t('calendar.repeat_smart_apply')}
        >
          <Text style={[styles.fillText, hand, { color: c.primary }]}>
            {t('calendar.repeat_smart_apply')}
          </Text>
        </Pressable>
      </View>
      {!!p.smartFeedback && (
        <Text
          style={[styles.feedback, hand, { color: p.smartFeedback.ok ? c.positive : c.negative }]}
        >
          {p.smartFeedback.ok
            ? `${t('calendar.repeat_smart_understood')} ${p.smartFeedback.text}`
            : p.smartFeedback.text}
        </Text>
      )}

      <ChoiceWords
        options={presets}
        selected={p.activePreset === '' ? 'none' : p.activePreset}
        onSelect={(v) => p.onPreset(v === 'none' ? '' : v)}
        groupLabel={t('calendar.repeat')}
      />

      {p.customMode && p.recurrence !== '' && (
        <View style={styles.custom}>
          <View style={styles.everyRow}>
            <Text style={[styles.every, { color: c.textPrimary }]}>
              {t('calendar.repeat_every')}
            </Text>
            <Pressable
              onPress={() => p.onInterval(-1)}
              disabled={p.interval <= 1}
              style={[styles.step, p.interval <= 1 && styles.dim]}
              accessibilityRole="button"
              accessibilityLabel={t('calendar.repeat_interval_decrease')}
            >
              <Text style={[styles.sign, { color: c.textPrimary, backgroundColor: c.surface }]}>
                −
              </Text>
            </Pressable>
            <Text style={[styles.n, hand, { color: c.primary }]}>{p.interval}</Text>
            <Pressable
              onPress={() => p.onInterval(1)}
              disabled={p.interval >= MAX_INTERVAL}
              style={[styles.step, p.interval >= MAX_INTERVAL && styles.dim]}
              accessibilityRole="button"
              accessibilityLabel={t('calendar.repeat_interval_increase')}
            >
              <Text style={[styles.sign, { color: c.textPrimary, backgroundColor: c.surface }]}>
                +
              </Text>
            </Pressable>
          </View>
          <ChoiceWords
            options={units}
            selected={p.recurrence}
            onSelect={p.onUnit}
            groupLabel={t('calendar.repeat_every')}
          />
          <Text style={[styles.summary, hand, { color: c.textSecondary }]}>
            {recurrenceLabel(t, p.recurrence, p.interval)}
          </Text>
        </View>
      )}

      {/* Weekly-only: circle the weekdays it lands on (e.g. Mon + Thu). */}
      {p.recurrence === 'weekly' && (
        <View>
          <Text style={[styles.label, { color: c.textSecondary }]}>
            {t('calendar.repeat_on_days')} ({t('common.optional')})
          </Text>
          <View style={styles.days}>
            {WEEKDAY_KEYS.map((key, dow) => {
              const on = p.days.includes(dow);
              return (
                <Pressable
                  key={key}
                  style={styles.day}
                  onPress={() => p.onToggleDay(dow)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={t(`calendar.${key}`)}
                >
                  {on && <PenCircle color={c.primary} style={styles.dayRing} strokeWidth={2.2} />}
                  <Text
                    style={[
                      styles.dayText,
                      { color: on ? c.textPrimary : c.textSecondary },
                      on && styles.dayOn,
                    ]}
                  >
                    {t(`calendar.${key}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {p.days.length === 0 && (
            <Text style={[styles.hint, { color: c.textSecondary }]}>
              {t('calendar.repeat_on_days_hint')}
            </Text>
          )}
        </View>
      )}

      {p.recurrence !== '' &&
        (p.showUntil ? (
          <View>
            <LineField
              label={`${t('calendar.repeat_until')} (${t('common.optional')})`}
              value={p.until ? formatShortDate(p.until, i18n.language) : ''}
              icon="calendar-outline"
              onPress={p.onOpenUntil}
              accessibilityHint={t('calendar.choose_repeat_end_hint')}
            />
            <Pressable
              style={styles.link}
              onPress={p.onClearUntil}
              accessibilityRole="button"
              accessibilityLabel={t('calendar.remove_repeat_end_date')}
            >
              <Text style={[styles.linkText, { color: c.textSecondary }]}>
                {t('calendar.no_end_date')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={styles.link}
            onPress={p.onOpenUntil}
            accessibilityRole="button"
            accessibilityLabel={t('calendar.set_repeat_end_date')}
            accessibilityHint={t('calendar.choose_repeat_end_hint')}
          >
            <Text style={[styles.linkText, { color: c.primary }]}>
              {t('calendar.set_end_date')}
            </Text>
          </Pressable>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: ms(8) },
  label: { fontSize: mf(13.5), ...font.bold },
  smartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: ms(10) },
  smartInput: { flex: 1 },
  fill: { minHeight: 44, justifyContent: 'center', paddingHorizontal: ms(4) },
  fillText: { fontSize: mf(21) },
  feedback: { fontSize: mf(17), lineHeight: mf(20) },
  dim: { opacity: 0.4 },
  custom: { gap: ms(2) },
  everyRow: { flexDirection: 'row', alignItems: 'center' },
  every: { fontSize: mf(15), ...font.medium, marginEnd: ms(4) },
  step: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  sign: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    textAlign: 'center',
    lineHeight: 28,
    fontSize: mf(16),
    ...font.semibold,
  },
  n: { fontSize: mf(25), minWidth: ms(22), textAlign: 'center' },
  summary: { fontSize: mf(18), paddingHorizontal: ms(9) },
  days: { flexDirection: 'row', justifyContent: 'space-between', marginTop: ms(2) },
  day: { minWidth: 40, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  dayRing: {
    position: 'absolute',
    top: ms(6),
    bottom: ms(6),
    left: 0,
    right: 0,
    transform: [{ rotate: '-5deg' }],
  },
  dayText: { fontSize: mf(14.5), ...font.medium },
  dayOn: { ...font.bold },
  hint: { fontSize: mf(12.5), ...font.regular },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  linkText: { fontSize: mf(14.5), ...font.semibold },
});
