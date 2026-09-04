import { useState, useCallback, useMemo, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { BackLink } from '@components/shared/BackLink';
import { LoadingSpinner } from '@components/shared/LoadingSpinner';
import { MachineCard } from '@components/machines/MachineCard';
import { StartSheet } from '@components/machines/StartSheet';
import { useAppliancesStore, APPLIANCE_KINDS, type ApplianceKind } from '@stores/appliancesStore';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { resolveName } from '@utils/housemates';
import { Alert } from '@lib/alert';
import { getErrorMessage } from '@utils/errors';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';
import { mf, ms } from '@utils/responsive';

export default function MachinesScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const headingFont = useHeadingFont();
  const styles = useMemo(() => makeStyles(c), [c]);

  const sessions = useAppliancesStore((s) => s.sessions);
  const presets = useAppliancesStore((s) => s.presets);
  const isLoading = useAppliancesStore((s) => s.isLoading);
  const storeError = useAppliancesStore((s) => s.error);
  const start = useAppliancesStore((s) => s.start);
  const stop = useAppliancesStore((s) => s.stop);
  const addPreset = useAppliancesStore((s) => s.addPreset);
  const deletePreset = useAppliancesStore((s) => s.deletePreset);

  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const housemates = useHousematesStore((s) => s.housemates);
  const myId = profile?.id ?? '';
  const myName = profile?.name ?? '';

  const [now, setNow] = useState(() => new Date());
  const [startKind, setStartKind] = useState<ApplianceKind | null>(null);
  const [busy, setBusy] = useState(false);

  // Tick the clock once a second while any machine is running so the countdowns
  // stay live; when everything is free there's nothing to animate.
  const anyRunning = APPLIANCE_KINDS.some((k) => sessions[k] !== null);
  useEffect(() => {
    if (!anyRunning) return;
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return (): void => clearInterval(id);
  }, [anyRunning]);

  const resolveMemberName = useCallback(
    (id: string): string => resolveName(id, housemates, t('common.unknown')),
    [housemates, t]
  );

  const handleOpenStart = useCallback((kind: ApplianceKind): void => setStartKind(kind), []);

  const handleStart = useCallback(
    async ({
      durationMinutes,
      label,
    }: {
      durationMinutes: number;
      label: string;
    }): Promise<void> => {
      if (!startKind) return;
      const kind = startKind;
      setStartKind(null);
      setBusy(true);
      try {
        await start({
          appliance: kind,
          userId: myId,
          displayName: myName,
          durationMinutes,
          label,
          houseId: houseId ?? '',
        });
      } catch (err) {
        Alert.alert(t('common.error'), getErrorMessage(err, t('machines.failed_start')));
      } finally {
        setBusy(false);
      }
    },
    [startKind, start, myId, myName, houseId, t]
  );

  const handleStop = useCallback(
    (kind: ApplianceKind): void => {
      Alert.alert(t('machines.stop_title'), t('machines.stop_confirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('machines.mark_free'),
          onPress: async (): Promise<void> => {
            setBusy(true);
            try {
              await stop(kind, houseId ?? '', myName);
            } catch (err) {
              Alert.alert(t('common.error'), getErrorMessage(err, t('machines.failed_stop')));
            } finally {
              setBusy(false);
            }
          },
        },
      ]);
    },
    [stop, houseId, myName, t]
  );

  const handleSavePreset = useCallback(
    ({ name, durationMinutes }: { name: string; durationMinutes: number }): void => {
      if (!startKind) return;
      addPreset({
        appliance: startKind,
        name,
        durationMinutes,
        userId: myId,
        houseId: houseId ?? '',
      }).catch((err) =>
        Alert.alert(t('common.error'), getErrorMessage(err, t('machines.failed_preset')))
      );
    },
    [startKind, addPreset, myId, houseId, t]
  );

  const handleDeletePreset = useCallback(
    (id: string): void => {
      deletePreset(id).catch((err) =>
        Alert.alert(t('common.error'), getErrorMessage(err, t('machines.failed_preset')))
      );
    },
    [deletePreset, t]
  );

  const sheetPresets = useMemo(
    () => (startKind ? presets.filter((p) => p.appliance === startKind) : []),
    [presets, startKind]
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <BackLink label={t('common.home')} />
        <Text style={[styles.title, headingFont]}>{t('machines.title')}</Text>
        <Text style={styles.subtitle}>{t('machines.subtitle')}</Text>

        {isLoading ? (
          <View style={styles.center}>
            <LoadingSpinner accessibilityLabel={t('machines.title')} />
          </View>
        ) : storeError ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={20} color={c.danger} />
            <Text style={styles.errorText}>{storeError}</Text>
          </View>
        ) : (
          <Animated.View entering={FadeIn.duration(300)} style={styles.cards}>
            {APPLIANCE_KINDS.map((kind) => (
              <MachineCard
                key={kind}
                kind={kind}
                session={sessions[kind]}
                now={now}
                myId={myId}
                resolveMemberName={resolveMemberName}
                onStart={handleOpenStart}
                onStop={handleStop}
                busy={busy}
              />
            ))}
            <View style={styles.hint}>
              <Ionicons name="notifications-outline" size={15} color={c.textSecondary} />
              <Text style={styles.hintText}>{t('machines.notify_hint')}</Text>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      <StartSheet
        kind={startKind}
        presets={sheetPresets}
        busy={busy}
        onClose={() => setStartKind(null)}
        onStart={handleStart}
        onSavePreset={handleSavePreset}
        onDeletePreset={handleDeletePreset}
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: ColorTokens): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    scroll: {
      paddingHorizontal: ms(18),
      paddingTop: ms(8),
      paddingBottom: sizes.bottomTabContentPadding,
    },
    title: { fontSize: mf(26), ...font.extrabold, color: c.textPrimary, letterSpacing: -0.78 },
    subtitle: { fontSize: mf(13.5), ...font.regular, color: c.textSecondary, marginTop: ms(2) },
    cards: { gap: ms(14), marginTop: ms(18) },
    center: { paddingVertical: ms(60), alignItems: 'center' },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(9),
      marginTop: ms(24),
      padding: ms(14),
      borderRadius: ms(14),
      backgroundColor: c.dangerTint,
    },
    errorText: { flex: 1, fontSize: mf(13.5), ...font.medium, color: c.danger },
    hint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(8),
      paddingHorizontal: ms(4),
      marginTop: ms(2),
    },
    hintText: { flex: 1, fontSize: mf(12.5), ...font.regular, color: c.textSecondary },
  });
