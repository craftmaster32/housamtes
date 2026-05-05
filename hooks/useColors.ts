import { useSettingsStore } from '@stores/settingsStore';
import { lightColors, darkColors, type ColorPalette } from '@constants/colors';

export type { ColorPalette };

export function useColors(): ColorPalette {
  const theme = useSettingsStore((s) => s.theme);
  return theme === 'dark' ? darkColors : lightColors;
}
