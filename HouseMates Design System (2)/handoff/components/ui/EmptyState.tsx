// components/ui/EmptyState.tsx
// Consistent empty + loading + error states. One component, three modes.

import { View, Text, ActivityIndicator } from 'react-native';
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
    <View style={{ alignItems: 'center', paddingVertical: sizes.xl, paddingHorizontal: sizes.lg, gap: sizes.sm }}>
      {mode === 'loading' ? (
        <ActivityIndicator color={C.primary} />
      ) : (
        icon && (
          <View
            style={{
              width: 56, height: 56, borderRadius: 28,
              backgroundColor: tint + '14',
              justifyContent: 'center', alignItems: 'center',
              marginBottom: 4,
            }}
          >
            <Ionicons name={icon} size={26} color={tint} />
          </View>
        )
      )}
      <Text style={[type.subtitle, { color: C.textPrimary, textAlign: 'center' }]}>
        {title}
      </Text>
      {message && (
        <Text style={[type.bodyMd, { color: C.textSecondary, textAlign: 'center', maxWidth: 280 }]}>
          {message}
        </Text>
      )}
      {actionLabel && onAction && (
        <View style={{ marginTop: sizes.sm }}>
          <Button onPress={onAction}>{actionLabel}</Button>
        </View>
      )}
    </View>
  );
}
