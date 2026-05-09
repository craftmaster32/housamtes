import { useCallback, useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Switch, Pressable, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useNotificationStore, type BillDueDays } from '@stores/notificationStore';
import { useAuthStore } from '@stores/authStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

const DAYS_OPTIONS: BillDueDays[] = [1, 2, 3, 7];

const makeStyles = (C: ColorTokens) => StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    scroll: { padding: sizes.lg, gap: sizes.md, paddingBottom: 60 },

    header: { gap: 4, marginBottom: sizes.xs },
    backBtn: { alignSelf: 'flex-start', marginBottom: sizes.sm },
    backText: { color: C.primary, fontSize: 15, ...font.semibold },
    heading: { fontSize: 26, ...font.extrabold, color: C.textPrimary, letterSpacing: -0.5 },
    subheading: { fontSize: 14, ...font.regular, color: C.textSecondary, marginTop: 2 },

    sectionTitle: { fontSize: 13, ...font.semibold, color: C.textSecondary, letterSpacing: 0.5, marginTop: sizes.xs },
    card: {
      backgroundColor: C.surface,
      borderRadius: 14,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sizes.md,
      paddingVertical: 14,
      gap: sizes.md,
    },
    rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    rowText: { flex: 1 },
    rowLabel: { fontSize: 15, ...font.medium, color: C.textPrimary },
    rowDesc: { fontSize: 12, ...font.regular, color: C.textSecondary, marginTop: 2 },

    daysRow: {
      paddingHorizontal: sizes.md,
      paddingBottom: sizes.md,
      gap: sizes.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
      paddingTop: sizes.sm,
    },
    daysLabel: { fontSize: 13, ...font.medium, color: C.textSecondary },
    daysOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.xs },
    dayChip: {
      paddingVertical: 7,
      paddingHorizontal: sizes.sm,
      borderRadius: sizes.borderRadiusFull,
      borderWidth: 1.5,
      borderColor: C.border,
      backgroundColor: C.surface,
    },
    dayChipActive: { backgroundColor: C.primary, borderColor: C.primary },
    dayChipText: { fontSize: 13, ...font.medium, color: C.textPrimary },
    dayChipTextActive: { color: '#fff' },

    footer: {
      fontSize: 12,
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      marginTop: sizes.sm,
      lineHeight: 18,
    },
});

interface ToggleRowProps {
  label: string;
  description?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  isLast?: boolean;
}

function ToggleRow({ label, description, value, onToggle, isLast }: ToggleRowProps): React.JSX.Element {
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={[styles.row, !isLast && styles.rowBorder]}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {description ? <Text style={styles.rowDesc}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: C.border, true: C.primary + '80' }}
        thumbColor={value ? C.primary : C.surface}
      />
    </View>
  );
}

export default function NotificationSettingsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const prefs = useNotificationStore((s) => s.prefs);
  const updatePrefs = useNotificationStore((s) => s.update);
  const user = useAuthStore((s) => s.user);
  const houseId = useAuthStore((s) => s.houseId);

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const save = useCallback((changes: Parameters<typeof updatePrefs>[2]) => {
    if (!user?.id || !houseId) return;
    updatePrefs(user.id, houseId, changes);
  }, [user, houseId, updatePrefs]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        <ScrollView contentContainerStyle={styles.scroll}>

          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backText}>{t('common.back')}</Text>
            </Pressable>
            <Text style={styles.heading}>{t('nav.settings')}</Text>
            <Text style={styles.subheading}>{t('settings.notifications_section')}</Text>
          </View>

          <Text style={styles.sectionTitle}>💰 Bills</Text>
          <View style={styles.card}>
            <ToggleRow
              label={t('settings.notify_bill_added')}
              description={t('settings.notify_bill_added_sub')}
              value={prefs.notifyBillAdded}
              onToggle={(v) => save({ notifyBillAdded: v })}
            />
            <ToggleRow
              label={t('settings.notify_bill_settled')}
              description={t('settings.notify_bill_settled_sub')}
              value={prefs.notifyBillSettled}
              onToggle={(v) => save({ notifyBillSettled: v })}
            />
            <ToggleRow
              label={t('settings.notify_bill_due')}
              description={t('settings.notify_bill_due_sub')}
              value={prefs.notifyBillDue}
              onToggle={(v) => save({ notifyBillDue: v })}
              isLast={!prefs.notifyBillDue}
            />
            {prefs.notifyBillDue && (
              <View style={styles.daysRow}>
                <Text style={styles.daysLabel}>{t('settings.remind_me')}</Text>
                <View style={styles.daysOptions}>
                  {DAYS_OPTIONS.map((d) => (
                    <Pressable
                      key={d}
                      style={[styles.dayChip, prefs.billDueDaysBefore === d && styles.dayChipActive]}
                      onPress={() => save({ billDueDaysBefore: d })}
                      accessible
                      accessibilityRole="radio"
                      accessibilityState={{ selected: prefs.billDueDaysBefore === d }}
                    >
                      <Text style={[styles.dayChipText, prefs.billDueDaysBefore === d && styles.dayChipTextActive]}>
                        {t('common.day', { count: d })} {t('settings.before_due')}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>🚗 Parking</Text>
          <View style={styles.card}>
            <ToggleRow
              label={t('settings.notify_parking_claimed')}
              description={t('settings.notify_parking_claimed_sub')}
              value={prefs.notifyParkingClaimed}
              onToggle={(v) => save({ notifyParkingClaimed: v })}
            />
            <ToggleRow
              label={t('settings.notify_parking_reservation')}
              description={t('settings.notify_parking_reservation_sub')}
              value={prefs.notifyParkingReservation}
              onToggle={(v) => save({ notifyParkingReservation: v })}
              isLast
            />
          </View>

          <Text style={styles.sectionTitle}>🧹 Chores</Text>
          <View style={styles.card}>
            <ToggleRow
              label={t('settings.notify_chore')}
              description={t('settings.notify_chore_sub')}
              value={prefs.notifyChoreOverdue}
              onToggle={(v) => save({ notifyChoreOverdue: v })}
              isLast
            />
          </View>

          <Text style={styles.sectionTitle}>💬 Chat</Text>
          <View style={styles.card}>
            <ToggleRow
              label={t('settings.notify_chat')}
              description={t('settings.notify_chat_sub')}
              value={prefs.notifyChatMessage}
              onToggle={(v) => save({ notifyChatMessage: v })}
              isLast
            />
          </View>

          <Text style={styles.footer}>
            Changes save instantly. Notifications only work on a real device build, not in Expo Go.
          </Text>

        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}
