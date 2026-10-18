import { useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors, darkColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { toneColors, type CategoryTone } from '@utils/groceryCategory';
import type { IoniconName } from '@/types/icons';
import { mf, ms } from '@utils/responsive';

export interface CategoryTileData {
  labelKey: string;
  icon: IoniconName;
  tone: CategoryTone;
  /** Items still to buy in this category. */
  count: number;
  /** Where the category's section sits in the list, for jumping to it. */
  sectionIndex: number;
}

export interface CategoryTilesProps {
  tiles: CategoryTileData[];
  onPressTile: (sectionIndex: number) => void;
}

/** A row of up to four aisle tiles — tap one to jump to that part of the list. */
export function CategoryTiles({ tiles, onPressTile }: CategoryTilesProps): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const isDark = C.background === darkColors.background;
  const s = useMemo(() => makeStyles(C, isDark), [C, isDark]);

  return (
    <View style={s.row}>
      {tiles.map((tile) => {
        const tone = toneColors(tile.tone, isDark);
        const label = t(tile.labelKey);
        return (
          <Pressable
            key={tile.labelKey}
            style={({ pressed }) => [s.tile, pressed && s.tilePressed]}
            onPress={() => onPressTile(tile.sectionIndex)}
            accessibilityRole="button"
            accessibilityLabel={t('grocery.category_tile_a11y', { name: label, count: tile.count })}
          >
            <View style={[s.iconChip, { backgroundColor: tone.bg }]}>
              <Ionicons name={tile.icon} size={20} color={tone.fg} />
            </View>
            <Text style={s.label} numberOfLines={2}>
              {label}
            </Text>
            <Text style={s.count}>{tile.count}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(C: ColorTokens, isDark: boolean): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
    row: { flexDirection: 'row', gap: ms(8), marginBottom: ms(14) },
    tile: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      gap: ms(5),
      paddingVertical: ms(12),
      paddingHorizontal: ms(4),
      borderRadius: ms(18),
      backgroundColor: C.surface,
      borderWidth: isDark ? 1 : 0,
      borderColor: C.border,
    },
    tilePressed: { opacity: 0.7 },
    iconChip: {
      width: ms(40),
      height: ms(40),
      borderRadius: ms(12),
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: { fontSize: mf(12), ...font.semibold, color: C.textPrimary, textAlign: 'center' },
    count: { fontSize: mf(12), ...font.medium, color: C.textSecondary },
  });
}
