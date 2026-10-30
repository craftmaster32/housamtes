import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Pressable,
  Animated,
  Easing,
  Platform,
  AccessibilityInfo,
  type LayoutChangeEvent,
} from 'react-native';
import { Text } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useParkingStore, findBlockedReservation } from '@stores/parkingStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useAuthStore } from '@stores/authStore';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { Alert } from '@lib/alert';
import { resolveName } from '@utils/housemates';
import { getErrorMessage } from '@utils/errors';
import { useThemedColors } from '@constants/colors';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { type CardStyles } from '@components/dashboard/cards/cardStyles';
import { CardLabel } from '@components/dashboard/cards/CardLabel';
import { CarArt } from '@components/dashboard/art/CarArt';
import { ParkingSignArt } from '@components/dashboard/art/ParkingSignArt';
import { ms } from '@utils/responsive';

// A housemate's car is drawn in a soft red so "taken" reads at a glance.
const HOUSEMATE_CAR = '#F2A7A0';

function formatTime(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

interface ParkingCardProps {
  styles: CardStyles;
  pinned?: boolean;
}

// One glance answers "can I park?": Free (green), You, or a housemate's name
// (red). Tapping toggles in place — claim, release, or confirm before freeing a
// housemate's spot.
export function ParkingCard({ styles, pinned = false }: ParkingCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const headingFont = useHeadingFont('semibold');
  const language = useLanguageStore((s) => s.language);
  const rtl = isRTL(language);
  const current = useParkingStore((s) => s.current);
  const reservations = useParkingStore((s) => s.reservations);
  const claimParking = useParkingStore((s) => s.claim);
  const releaseParking = useParkingStore((s) => s.release);
  const housemates = useHousematesStore((s) => s.housemates);
  const myId = useAuthStore((s) => s.profile?.id);
  const myName = useAuthStore((s) => s.profile?.name);
  const houseId = useAuthStore((s) => s.houseId);
  const busyRef = useRef(false);
  const [isBusy, setIsBusy] = useState(false);
  const [cardW, setCardW] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent): void => {
    setCardW(e.nativeEvent.layout.width);
  }, []);
  const isFree = !current;
  const isMine = !!current && current.occupant === myId;
  const isHousemate = !!current && current.occupant !== myId;
  // Re-check every minute while the spot is taken, so a reserved slot that
  // starts while the car is still parked shows up without a reload.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!current) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return (): void => clearInterval(id);
  }, [current]);
  const blocked = useMemo(
    () => findBlockedReservation(current, reservations ?? [], new Date(nowMs)),
    [current, reservations, nowMs]
  );
  const blockedHolder = blocked
    ? resolveName(blocked.requestedBy, housemates, t('common.unknown')).split(' ')[0]
    : '';
  const occupant = resolveName(current?.occupant ?? '', housemates, '').split(' ')[0];

  // When the spot goes from free to taken, the car drives in from the leading
  // edge — the motion is the confirmation that the tap worked.
  const driveX = useRef(new Animated.Value(0)).current;
  const wasFree = useRef(isFree);
  useEffect(() => {
    const arrived = wasFree.current && !isFree;
    wasFree.current = isFree;
    if (!arrived || cardW === 0) return;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (cancelled || reduce) return;
        driveX.setValue((rtl ? 1 : -1) * cardW);
        Animated.timing(driveX, {
          toValue: 0,
          duration: 650,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }).start();
      })
      .catch(() => {});
    return (): void => {
      cancelled = true;
    };
  }, [isFree, cardW, rtl, driveX]);

  const handleParkingPress = useCallback((): void => {
    // Immediate tactile ack so the toggle feels instant, not delayed.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const uid = myId ?? '';
    const uname = myName ?? '';
    const hId = houseId ?? '';
    const cur = useParkingStore.getState().current;

    if (cur && cur.occupant !== uid) {
      const occupantName = resolveName(cur.occupant, housemates, t('common.unknown'));
      const pinnedId = cur.id;
      const doRelease = (): void => {
        if (useParkingStore.getState().current?.id !== pinnedId) {
          Alert.alert(t('parking.could_not_free'), t('parking.spot_changed'));
          return;
        }
        if (busyRef.current) return;
        busyRef.current = true;
        setIsBusy(true);
        releaseParking(hId, uname)
          .catch(() => Alert.alert(t('parking.could_not_free'), t('parking.failed_release')))
          .finally(() => {
            busyRef.current = false;
            setIsBusy(false);
          });
      };
      if (Platform.OS === 'web') {
        if (window.confirm(t('parking.evict_confirm', { name: occupantName }))) doRelease();
      } else {
        Alert.alert(
          t('parking.kick_out_title', { name: occupantName }),
          t('parking.kick_out_body'),
          [
            { text: t('parking.leave_it'), style: 'cancel' },
            { text: t('parking.free_it_anyway'), style: 'destructive', onPress: doRelease },
          ]
        );
      }
      return;
    }

    if (busyRef.current) return;
    busyRef.current = true;
    setIsBusy(true);
    const done = (): void => {
      busyRef.current = false;
      setIsBusy(false);
    };
    if (cur && cur.occupant === uid) {
      releaseParking(hId, uname)
        .catch((err) =>
          Alert.alert(t('parking.title'), getErrorMessage(err, t('parking.failed_release')))
        )
        .finally(done);
    } else {
      claimParking(uid, uname, hId)
        .catch((err) =>
          Alert.alert(t('parking.title'), getErrorMessage(err, t('parking.failed_claim')))
        )
        .finally(done);
    }
  }, [myId, myName, houseId, housemates, claimParking, releaseParking, t]);

  const parkingA11yLabel = isMine
    ? t('parking.a11y_release', 'Release parking spot')
    : isHousemate
      ? t('parking.a11y_release_housemate', "Free housemate's parking spot")
      : t('parking.a11y_claim', 'Claim parking spot');
  const parkingA11yHint = isHousemate
    ? t('parking.a11y_hint_housemate', "Frees the housemate's reservation")
    : t('parking.a11y_hint', 'Toggles your parking reservation');

  // The one big answer, and its colour.
  const status = isFree
    ? t('dashboard.parking_free')
    : isMine
      ? t('parking.you')
      : occupant || t('parking.taken');
  const statusColor = isFree ? c.success : isHousemate ? c.danger : c.textPrimary;
  const since = current?.startTime ? formatTime(current.startTime, language) : '';
  const artW = ms(52);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.shell,
        pinned && styles.pinnedShell,
        pressed && { opacity: 0.92, transform: [{ scale: 0.97 }] },
      ]}
      onPress={handleParkingPress}
      onLayout={onLayout}
      disabled={isBusy}
      accessibilityRole="button"
      accessibilityLabel={parkingA11yLabel}
      accessibilityHint={parkingA11yHint}
      accessibilityState={{ disabled: isBusy }}
    >
      <CardLabel
        styles={styles}
        icon="car-outline"
        label={t('dashboard.parking_label')}
        pinned={pinned}
      />
      <Text
        style={[styles.big, headingFont, { color: statusColor }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {status}
      </Text>
      {/* Someone's reserved slot has started while this car is still parked. */}
      {!isFree && blocked ? (
        <Text style={[styles.sub, styles.subAlert]} numberOfLines={2}>
          {isMine
            ? t('dashboard.parking_blocked_move', { name: blockedHolder })
            : t('dashboard.parking_blocked_other', { name: blockedHolder })}
        </Text>
      ) : !isFree && since ? (
        <Text style={styles.sub} numberOfLines={1}>
          {t('parking.since', { time: since })}
        </Text>
      ) : null}
      <View style={rtl ? styles.artRTL : styles.art} pointerEvents="none">
        {isFree ? (
          <ParkingSignArt color={c.success} lineColor={c.textTertiary} width={ms(44)} />
        ) : (
          <Animated.View style={{ transform: [{ translateX: driveX }, { scaleX: rtl ? -1 : 1 }] }}>
            <CarArt color={isMine ? c.primary : HOUSEMATE_CAR} width={artW} />
          </Animated.View>
        )}
      </View>
    </Pressable>
  );
}
