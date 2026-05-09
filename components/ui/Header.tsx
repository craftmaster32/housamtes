// components/ui/Header.tsx
// Standard screen header with optional back chevron + right-side slot.

import { ReactNode, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useThemedColors } from '@constants/colors';
import { type } from '@constants/typography';
import { sizes } from '@constants/sizes';

export interface Props {
  title: string;
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
}

export function Header({ title, back = false, onBack, right }: Props): React.JSX.Element {
  const C = useThemedColors();
  const handleBack = useCallback(() => {
    if (onBack) onBack();
    else router.back();
  }, [onBack]);

  return (
    <View style={[styles.row, { borderBottomColor: C.border }]}>
      <View style={styles.side}>
        {back && (
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.iconBtn}
          >
            <Ionicons name="chevron-back" size={24} color={C.textPrimary} />
          </Pressable>
        )}
      </View>
      <Text style={[type.subtitle, { color: C.textPrimary }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.side}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sizes.md,
    paddingVertical: sizes.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  side: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  iconBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
});
