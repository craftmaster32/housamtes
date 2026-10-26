import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { lightColors } from '@constants/colors';
import type { Photo } from '@stores/photoStore';
import { ms } from '@utils/responsive';
import { PenTick } from '@components/shared/PenTick';

interface PolaroidTileProps {
  photo: Photo;
  size: number;
  /** Position in the row: prints lean a little differently so they look handled. */
  index: number;
  selectMode: boolean;
  selected: boolean;
  label: string;
  onPress: (photo: Photo) => void;
  onLongPress: (photo: Photo) => void;
}

const TILTS = ['-1.4deg', '0.9deg', '-0.5deg', '1.3deg'];

/** One photo as a print with a white border; in select mode, a box to tick in pen. */
function PolaroidTileComponent({
  photo,
  size,
  index,
  selectMode,
  selected,
  label,
  onPress,
  onLongPress,
}: PolaroidTileProps): React.JSX.Element {
  const inner = size - ms(12);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.print,
        { width: size, transform: [{ rotate: TILTS[index % TILTS.length] }] },
        pressed && styles.pressed,
      ]}
      onPress={() => onPress(photo)}
      onLongPress={() => onLongPress(photo)}
      delayLongPress={350}
      accessibilityRole="imagebutton"
      accessibilityLabel={label}
      accessibilityState={{ selected: selectMode ? selected : undefined }}
    >
      <Image
        source={{ uri: photo.url, cacheKey: photo.id }}
        style={[styles.img, { width: inner, height: inner }]}
        contentFit="cover"
        recyclingKey={photo.id}
        transition={100}
        accessibilityLabel={label}
      />
      {selectMode && selected && (
        <View style={[styles.wash, { width: inner, height: inner }]} pointerEvents="none" />
      )}
      {selectMode && (
        <View style={styles.boxWrap} pointerEvents="none">
          <View style={[styles.box, selected && styles.boxOn]}>
            <PenTick
              checked={selected}
              size={ms(24)}
              color={lightColors.primary}
              style={styles.tick}
              strokeWidth={3.2}
            />
          </View>
        </View>
      )}
    </Pressable>
  );
}

export const PolaroidTile = React.memo(PolaroidTileComponent);

const styles = StyleSheet.create({
  print: {
    backgroundColor: '#FFFFFF',
    padding: ms(6),
    paddingBottom: ms(16),
    borderRadius: ms(2),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(2) },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 3,
  },
  pressed: { opacity: 0.85 },
  img: { backgroundColor: '#E9E4DA' },
  // A picked print gets a light blue wash, the way a phone gallery dims picks.
  wash: {
    position: 'absolute',
    top: ms(6),
    left: ms(6),
    backgroundColor: 'rgba(59,111,191,0.22)',
  },
  boxWrap: { position: 'absolute', end: ms(5), bottom: ms(2) },
  box: {
    width: ms(18),
    height: ms(18),
    borderWidth: 2,
    borderColor: lightColors.paperMuted,
    borderRadius: ms(3),
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '-2deg' }],
  },
  boxOn: { borderColor: lightColors.paperInk },
  tick: { position: 'absolute', left: -ms(1), top: -ms(9) },
});
