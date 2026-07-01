import type { ComponentProps } from 'react';
import { TextInput } from 'react-native-paper';

/**
 * Shared prop-builder for the password show/hide eye icon.
 * Must return plain props spread onto `TextInput.Icon` directly (not a
 * wrapping component) — Paper's TextInput detects left/right adornments
 * by checking `element.type === TextInputIcon`, which a wrapper breaks.
 */
export function passwordVisibilityIconProps(
  visible: boolean,
  onToggle: () => void,
  showLabel: string,
  hideLabel: string
): ComponentProps<typeof TextInput.Icon> {
  return {
    icon: visible ? 'eye-off' : 'eye',
    onPress: onToggle,
    accessibilityLabel: visible ? hideLabel : showLabel,
    accessibilityState: { checked: visible },
  };
}
