import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { CarArt } from '@components/dashboard/art/CarArt';
import { ParkingSignArt } from '@components/dashboard/art/ParkingSignArt';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { isRTL } from '@lib/i18n';
import { useLanguageStore } from '@stores/languageStore';
import type { ParkingReservation, ParkingSession } from '@stores/parkingStore';
import { mf, ms } from '@utils/responsive';
import { ParkingBlockedBanner } from './ParkingBlockedBanner';

// Same car colours as the Home parking card: blue for mine, pink for a housemate's.
const HOUSEMATE_CAR = '#F2A7A0';

interface SpotCardProps {
  current: ParkingSession | null;
  isMine: boolean;
  /** Who is parked, for the big answer when it isn't me. */
  occupantName: string;
  /** "Free real estate!…" / "That's your car in there…" etc. */
  statusLine: string;
  blockedReservation: ParkingReservation | null;
  myId: string;
  nameOf: (id: string) => string;
  onClaim: () => void;
  onRelease: () => void;
  onReleaseOther: () => void;
}

/**
 * The parking spot as a painted bay: one big answer (Free / You / a name), the
 * status line, the Home drawing in the corner (a P sign or the parked car),
 * a pink ticket when a reserved slot is blocked, and the spot's one action.
 */
export function SpotCard({
  current,
  isMine,
  occupantName,
  statusLine,
  blockedReservation,
  myId,
  nameOf,
  onClaim,
  onRelease,
  onReleaseOther,
}: SpotCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const headingFont = useHeadingFont('semibold');
  const rtl = isRTL(useLanguageStore((s) => s.language));
  const isFree = !current;

  const answer = isFree ? t('parking.free') : isMine ? t('parking.you') : occupantName;
  const answerColor = isFree ? c.success : isMine ? c.textPrimary : c.danger;

  return (
    <View style={[styles.bay, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.top}>
        <View style={styles.copy}>
          <Text
            style={[styles.answer, headingFont, { color: answerColor }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityRole="header"
          >
            {answer}
          </Text>
          <Text style={[styles.meta, { color: c.textSecondary }]}>{statusLine}</Text>
        </View>
        <View style={styles.art} pointerEvents="none">
          {isFree ? (
            <ParkingSignArt color={c.success} lineColor={c.textTertiary} width={ms(84)} />
          ) : (
            <View style={rtl && styles.flip}>
              <CarArt color={isMine ? c.primary : HOUSEMATE_CAR} width={ms(96)} />
            </View>
          )}
        </View>
      </View>

      {blockedReservation && current && (
        <ParkingBlockedBanner
          reservation={blockedReservation}
          occupantId={current.occupant}
          myId={myId}
          resolveName={nameOf}
        />
      )}

      {isFree && (
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: c.primary },
            pressed && styles.pressed,
          ]}
          onPress={onClaim}
          accessible
          accessibilityRole="button"
        >
          <Text style={styles.btnPrimaryText}>{t('parking.claim')}</Text>
        </Pressable>
      )}
      {isMine && (
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            styles.btnOutline,
            { borderColor: c.danger },
            pressed && styles.pressed,
          ]}
          onPress={onRelease}
          accessible
          accessibilityRole="button"
        >
          <Text style={[styles.btnOutlineText, { color: c.danger }]}>{t('parking.release')}</Text>
        </Pressable>
      )}
      {!isFree && !isMine && (
        <Pressable
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}
          onPress={onReleaseOther}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('parking.free_the_spot')}
          accessibilityState={{ disabled: false }}
        >
          <Text style={[styles.linkText, { color: c.warning }]}>
            {t('parking.admin_free_spot')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // The painted bay: dashed lines round a white (graphite in dark) card.
  bay: {
    borderRadius: ms(24),
    borderWidth: 2.5,
    borderStyle: 'dashed',
    paddingHorizontal: ms(18),
    paddingTop: ms(16),
    paddingBottom: ms(18),
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: ms(10) },
  copy: { flex: 1, minWidth: 0 },
  answer: { fontSize: mf(48), lineHeight: mf(56), letterSpacing: -0.5 },
  meta: { fontSize: mf(14), ...font.medium, lineHeight: mf(19), marginTop: ms(2) },
  art: { paddingTop: ms(8) },
  flip: { transform: [{ scaleX: -1 }] },
  btn: {
    minHeight: ms(52),
    borderRadius: ms(17),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: ms(16),
  },
  btnOutline: { borderWidth: 2 },
  btnPrimaryText: { color: '#FFFFFF', fontSize: mf(16), ...font.bold },
  btnOutlineText: { fontSize: mf(16), ...font.bold },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: ms(8) },
  linkText: { fontSize: mf(14.5), ...font.bold },
  pressed: { opacity: 0.75 },
});
