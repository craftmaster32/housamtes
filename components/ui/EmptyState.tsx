// components/ui/EmptyState.tsx
// Consistent empty + loading + error states. One component, three modes.

import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LoadingSpinner } from '@components/shared/LoadingSpinner';
import { useThemedColors } from '@constants/colors';
import { type } from '@constants/typography';
import { sizes } from '@constants/sizes';
import { Button } from './Button';

import { ms } from '@utils/responsive';
interface Props {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  // Optional action — renders a primary button below the message
  actionLabel?: string;
  onAction?: () => void;
  // Mode — visual variant. `loading` shows a spinner instead of an icon.
  mode?: 'empty' | 'loading' | 'error';
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  mode = 'empty',
}: Props): React.JSX.Element {
  const C = useThemedColors();
  const tint = mode === 'error' ? C.danger : C.textTertiary;

  return (
    <View style={styles.container}>
      {mode === 'loading' ? (
        <LoadingSpinner />
      ) : (
        icon && (
          <View style={[styles.iconWrap, { backgroundColor: tint + '14' }]}>
            <Ionicons name={icon} size={26} color={tint} />
          </View>
        )
      )}
      <Text style={[type.subtitle, styles.title, { color: C.textPrimary }]}>{title}</Text>
      {message && (
        <Text style={[type.bodyMd, styles.message, { color: C.textSecondary }]}>{message}</Text>
      )}
      {actionLabel && onAction && (
        <View style={styles.actionWrap}>
          <Button onPress={onAction}>{actionLabel}</Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: sizes.xl,
    paddingHorizontal: sizes.lg,
    gap: sizes.sm,
  },
  iconWrap: {
    width: ms(56),
    height: ms(56),
    borderRadius: ms(28),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: ms(4),
  },
  title: { textAlign: 'center' },
  message: { textAlign: 'center', maxWidth: ms(280) },
  actionWrap: { marginTop: sizes.sm },
});
