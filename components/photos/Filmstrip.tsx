import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  type ListRenderItemInfo,
} from 'react-native';
import { Image } from 'expo-image';
import type { Photo } from '@stores/photoStore';
import { ms } from '@utils/responsive';

const THUMB = ms(42);
const GAP = ms(4);
const ITEM = THUMB + GAP;

interface FilmstripProps {
  photos: Photo[];
  current: number;
  onPick: (index: number) => void;
  labelFor: (photo: Photo) => string;
}

/** The row of little thumbnails under the open photo (like a phone gallery's scrubber). */
export function Filmstrip({
  photos,
  current,
  onPick,
  labelFor,
}: FilmstripProps): React.JSX.Element {
  const listRef = useRef<FlatList<Photo>>(null);
  const { width } = useWindowDimensions();
  // Half a screen either side lets the first and last photo sit in the middle.
  const side = Math.max(0, (width - THUMB) / 2);

  // Keep the open photo's thumbnail in the middle of the strip. With half a
  // screen of padding either side, thumbnail i is centred at offset i × ITEM.
  const [initialOffset] = useState(() => ({ x: Math.max(0, current) * ITEM, y: 0 }));
  useEffect(() => {
    if (current < 0 || current >= photos.length) return;
    listRef.current?.scrollToOffset({ offset: current * ITEM, animated: true });
  }, [current, photos.length]);

  const getItemLayout = useCallback(
    (_: ArrayLike<Photo> | null | undefined, index: number) => ({
      length: ITEM,
      offset: side + ITEM * index,
      index,
    }),
    [side]
  );

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Photo>) => {
      const on = index === current;
      return (
        <Pressable
          onPress={() => onPick(index)}
          style={[styles.thumb, on ? styles.thumbOn : styles.thumbOff]}
          accessibilityRole="imagebutton"
          accessibilityLabel={labelFor(item)}
          accessibilityState={{ selected: on }}
          hitSlop={{ top: 6, bottom: 6 }}
        >
          <Image
            source={{ uri: item.url, cacheKey: item.id }}
            style={styles.img}
            contentFit="cover"
            recyclingKey={item.id}
          />
        </Pressable>
      );
    },
    [current, onPick, labelFor]
  );

  return (
    <FlatList
      ref={listRef}
      data={photos}
      horizontal
      renderItem={renderItem}
      keyExtractor={(p) => p.id}
      extraData={current}
      getItemLayout={getItemLayout}
      contentOffset={initialOffset}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingHorizontal: side }]}
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 0 },
  content: { alignItems: 'center', paddingVertical: ms(4) },
  thumb: {
    width: THUMB,
    height: THUMB,
    marginEnd: GAP,
    borderRadius: ms(5),
    overflow: 'hidden',
    backgroundColor: '#2A2B2F',
  },
  thumbOn: { borderWidth: 2, borderColor: '#FFFFFF', transform: [{ scale: 1.12 }] },
  thumbOff: { opacity: 0.55 },
  img: { width: '100%', height: '100%' },
});
