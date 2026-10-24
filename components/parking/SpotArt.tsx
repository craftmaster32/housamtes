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
 * The spot's drawing. When someone parks, their car glides in from the reading
 * start and eases to a stop; when the spot is freed, the car drives off
 * forwards and the P sign eases up into place — calm, no bounce.
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
  const carVisible = useRef(!isFree);
  const carX = useRef(new Animated.Value(0)).current;
  const sign = useRef(new Animated.Value(1)).current;
  const wasFree = useRef(isFree);

  const drawCar = (visible: boolean): void => {
    carVisible.current = visible;
    setShowCar(visible);
  };

  useEffect(() => {
    const before = wasFree.current;
    wasFree.current = isFree;
    if (!isFree) setCarMine(isMine);
    if (before === isFree) return;

    // Quick taps: stop whatever is still moving and carry on from where it is.
    carX.stopAnimation();
    sign.stopAnimation();

    if (reduceMotion) {
      drawCar(!isFree);
      carX.setValue(0);
      sign.setValue(1);
      return;
    }

    if (!isFree) {
      // Arrive: glide in from behind and ease to a stop. If the car was still
      // driving off, it simply turns back from where it is.
      if (!carVisible.current) carX.setValue(-dir * DRIVE);
      drawCar(true);
      Animated.timing(carX, {
        toValue: 0,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    // Leave: drive off forwards, then the sign eases up where the car stood.
    sign.setValue(0);
    Animated.timing(carX, {
      toValue: dir * DRIVE,
      duration: 400,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      // Interrupted (someone parked again mid-drive) — leave the car be.
      if (!finished) return;
      drawCar(false);
      carX.setValue(0);
      Animated.timing(sign, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
    // drawCar only touches a ref and a state setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            { translateY: sign.interpolate({ inputRange: [0, 1], outputRange: [ms(8), 0] }) },
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
