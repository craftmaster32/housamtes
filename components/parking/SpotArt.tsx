import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { useThemedColors } from '@constants/colors';
import { CarArt } from '@components/dashboard/art/CarArt';
import { ParkingSignArt } from '@components/dashboard/art/ParkingSignArt';
import { useReduceMotion } from '@hooks/useReduceMotion';
import { isRTL } from '@lib/i18n';
import { useLanguageStore } from '@stores/languageStore';
import { ms } from '@utils/responsive';

// Same car colours as the Home parking card: blue for mine, pink for a housemate's.
const HOUSEMATE_CAR = '#F2A7A0';
// How far the car travels on and off the card.
const DRIVE = ms(300);

interface SpotArtProps {
  isFree: boolean;
  isMine: boolean;
}

/**
 * The spot's drawing. When someone parks, their car drives in from the reading
 * start and settles; when the spot is freed, the car drives off forwards and
 * the P sign rises into place behind it — one continuous move, never a swap.
 * With Reduce Motion on, the end state just shows.
 */
export function SpotArt({ isFree, isMine }: SpotArtProps): React.JSX.Element {
  const c = useThemedColors();
  const rtl = isRTL(useLanguageStore((s) => s.language));
  const reduceMotion = useReduceMotion();
  const dir = rtl ? -1 : 1;

  // What is drawn lags the real state while the car drives off.
  const [showCar, setShowCar] = useState(!isFree);
  const [carMine, setCarMine] = useState(isMine);
  const carX = useRef(new Animated.Value(0)).current;
  const sign = useRef(new Animated.Value(1)).current;
  const wasFree = useRef(isFree);

  useEffect(() => {
    const before = wasFree.current;
    wasFree.current = isFree;
    if (!isFree) setCarMine(isMine);
    if (before === isFree) return;

    if (reduceMotion) {
      setShowCar(!isFree);
      carX.setValue(0);
      sign.setValue(1);
      return;
    }

    if (!isFree) {
      // Arrive: drive in from behind and settle with a small overshoot.
      setShowCar(true);
      carX.setValue(-dir * DRIVE);
      Animated.timing(carX, {
        toValue: 0,
        duration: 650,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }).start();
      return;
    }

    // Leave: drive off forwards, then the sign rises where the car stood.
    sign.setValue(0);
    Animated.timing(carX, {
      toValue: dir * DRIVE,
      duration: 450,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setShowCar(false);
      carX.setValue(0);
      Animated.spring(sign, {
        toValue: 1,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }).start();
    });
  }, [isFree, isMine, reduceMotion, dir, carX, sign]);

  if (showCar) {
    return (
      <Animated.View
        style={{ transform: [{ translateX: carX }, { scaleX: rtl ? -1 : 1 }] }}
        pointerEvents="none"
      >
        <CarArt color={carMine ? c.primary : HOUSEMATE_CAR} width={ms(96)} />
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.sign,
        {
          opacity: sign,
          transform: [
            { translateY: sign.interpolate({ inputRange: [0, 1], outputRange: [ms(18), 0] }) },
          ],
        },
      ]}
      pointerEvents="none"
    >
      <ParkingSignArt color={c.success} lineColor={c.textTertiary} width={ms(84)} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sign: { alignItems: 'center' },
});
