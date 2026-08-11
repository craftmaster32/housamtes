import { View, StyleSheet } from 'react-native';

import { ms } from '@utils/responsive';
interface HouseSpec {
  width: number;
  wallHeight: number;
  roofHeight: number;
  hasChimney: boolean;
  windows: { top: number; left: number }[];
}

const HOUSES: HouseSpec[] = [
  {
    width: ms(46),
    wallHeight: 58,
    roofHeight: 22,
    hasChimney: false,
    windows: [{ top: ms(14), left: ms(8) }],
  },
  {
    width: ms(62),
    wallHeight: 62,
    roofHeight: 22,
    hasChimney: true,
    windows: [
      { top: ms(12), left: ms(10) },
      { top: ms(12), left: ms(36) },
      { top: ms(42), left: ms(10) },
      { top: ms(42), left: ms(36) },
    ],
  },
  {
    width: ms(50),
    wallHeight: 64,
    roofHeight: 24,
    hasChimney: false,
    windows: [
      { top: ms(14), left: ms(9) },
      { top: ms(14), left: ms(29) },
    ],
  },
  {
    width: ms(66),
    wallHeight: 64,
    roofHeight: 24,
    hasChimney: true,
    windows: [
      { top: ms(14), left: ms(12) },
      { top: ms(14), left: ms(40) },
      { top: ms(46), left: ms(12) },
      { top: ms(46), left: ms(40) },
    ],
  },
  {
    width: ms(48),
    wallHeight: 60,
    roofHeight: 22,
    hasChimney: false,
    windows: [{ top: ms(13), left: ms(8) }],
  },
];

/** Decorative row of pitched-roof house silhouettes for the auth hero background. */
export function HouseSkyline(): React.JSX.Element {
  return (
    <View
      style={[styles.row, { pointerEvents: 'none' }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {HOUSES.map((house, index) => (
        <View key={index} style={[styles.house, { width: house.width }]}>
          {house.hasChimney && <View style={[styles.chimney, { left: house.width * 0.62 }]} />}
          <View
            style={[
              styles.roof,
              {
                borderLeftWidth: house.width / 2,
                borderRightWidth: house.width / 2,
                borderBottomWidth: house.roofHeight,
              },
            ]}
          />
          <View style={[styles.wall, { height: house.wallHeight }]}>
            {house.windows.map((w, i) => (
              <View key={i} style={[styles.window, { top: w.top, left: w.left }]} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const WALL_COLOR = 'rgba(255,255,255,0.16)';
const WINDOW_COLOR = 'rgba(255,255,255,0.32)';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    width: '100%',
  },
  house: {
    alignItems: 'center',
  },
  roof: {
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: WALL_COLOR,
  },
  wall: {
    width: '100%',
    backgroundColor: WALL_COLOR,
  },
  window: {
    position: 'absolute',
    width: ms(10),
    height: ms(10),
    borderRadius: ms(2),
    backgroundColor: WINDOW_COLOR,
  },
  chimney: {
    position: 'absolute',
    top: ms(-10),
    width: ms(8),
    height: ms(16),
    backgroundColor: WALL_COLOR,
  },
});
