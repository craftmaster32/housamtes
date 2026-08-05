// Spacing and sizing — used everywhere for consistency.
// Values are scaled to the device via `ms` so spacing that was tuned on an
// iPhone 17 also fits smaller phones. Touch targets stay fixed at the Apple
// minimum (44pt) and the "fully round" radius is left alone.
import { ms, mf } from '@utils/responsive';

export const sizes = {
  // Spacing
  xs: ms(4),
  sm: ms(8),
  md: ms(16),
  lg: ms(24),
  xl: ms(32),
  xxl: ms(48),

  // Touch targets — Apple requires minimum 44x44pt; never scale below this.
  touchTarget: 44,

  // Bottom navigation
  bottomTabBarHeight: ms(104),
  bottomTabContentPadding: ms(40),

  // Border radius
  borderRadius: ms(12),
  borderRadiusSm: ms(8),
  borderRadiusLg: ms(16),
  borderRadiusFull: 9999,

  // Font sizes
  fontXxs: mf(10),
  fontXs: mf(12),
  fontSm: mf(14),
  fontMd: mf(16),
  fontLg: mf(18),
  fontXl: mf(20),
  fontXxl: mf(24),
  fontTitle: mf(28),

  // New
  borderRadiusXl: ms(20),
} as const;
