import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';

interface HouseSpec {
  width: number;
  wallHeight: number;
  roofHeight: number;
  hasChimney: boolean;
  windows: { top: number; left: number }[];
}

const HOUSES: HouseSpec[] = [
  { width: 46, wallHeight: 58, roofHeight: 22, hasChimney: false, windows: [{ top: 14, left: 8 }] },
  {
    width: 62,
    wallHeight: 78,
    roofHeight: 28,
    hasChimney: true,
    windows: [
      { top: 12, left: 10 },
      { top: 12, left: 36 },
      { top: 42, left: 10 },
      { top: 42, left: 36 },
    ],
  },
  {
    width: 50,
    wallHeight: 64,
    roofHeight: 24,
    hasChimney: false,
    windows: [
      { top: 14, left: 9 },
      { top: 14, left: 29 },
    ],
  },
  {
    width: 66,
    wallHeight: 86,
    roofHeight: 30,
    hasChimney: true,
    windows: [
      { top: 14, left: 12 },
      { top: 14, left: 40 },
      { top: 46, left: 12 },
      { top: 46, left: 40 },
    ],
  },
  { width: 48, wallHeight: 60, roofHeight: 22, hasChimney: false, windows: [{ top: 13, left: 8 }] },
];

/** Decorative row of pitched-roof house silhouettes for the auth hero background. */
export function HouseSkyline(): React.JSX.Element {
  const houses = useMemo(() => HOUSES, []);

  return (
    <View style={styles.row} pointerEvents="none">
      {houses.map((house, index) => (
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
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: WINDOW_COLOR,
  },
  chimney: {
    position: 'absolute',
    top: -10,
    width: 8,
    height: 16,
    backgroundColor: WALL_COLOR,
  },
});
