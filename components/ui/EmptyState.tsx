// components/ui/EmptyState.tsx
// Consistent empty + loading + error states. One component, three modes.

import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedColors } from '@constants/colors';
import { type } from '@constants/typography';
import { sizes } from '@constants/sizes';
import { Button } from './Button';

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
  icon, title, message, actionLabel, onAction, mode = 'empty',
}: Props): React.JSX.Element {
  const C = useThemedColors();
  const tint = mode === 'error' ? C.danger : C.textTertiary;

  return (
    <View style={styles.container}>
      {mode === 'loading' ? (
        <ActivityIndicator color={C.primary} />
      ) : (
        icon && (
          <View style={[styles.iconWrap, { backgroundColor: tint + '14' }]}>
            <Ionicons name={icon} size={26} color={tint} />
          </View>
        )
      )}
      <Text style={[type.subtitle, styles.title, { color: C.textPrimary }]}>
        {title}
      </Text>
      {message && (
        <Text style={[type.bodyMd, styles.message, { color: C.textSecondary }]}>
          {message}
        </Text>
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
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  title:      { textAlign: 'center' },
  message:    { textAlign: 'center', maxWidth: 280 },
  actionWrap: { marginTop: sizes.sm },
});
