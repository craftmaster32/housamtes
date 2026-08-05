// Responsive sizing — makes the app fit every iPhone, not just the one it was
// designed on. Every hard-coded pixel in the app was tuned on an iPhone 17
// (402pt wide). On narrower phones those numbers are too big and things spill
// over, so we gently scale them down toward the device width. On the iPhone 17
// the scale is exactly 1, so that layout is left untouched.

import { Dimensions, PixelRatio } from 'react-native';

// The screen the design was built on (iPhone 17 logical width, in points).
const BASE_WIDTH = 402;

// Phones only — read once at startup. Portrait width is the shorter side, so we
// stay stable even if the device reports landscape at some odd moment.
const { width, height } = Dimensions.get('window');
const shortSide = Math.min(width, height);

// Raw ratio of this phone to the design phone, clamped so we never shrink so far
// that text becomes unreadable, nor blow things up on the biggest Pro Max.
const rawScale = shortSide / BASE_WIDTH;
const scale = Math.min(Math.max(rawScale, 0.84), 1.06);

/**
 * Moderate scale — the everyday helper. Nudges a size toward the device width
 * but only part-way (factor 0.5 by default), so small phones shrink gently
 * instead of collapsing. Result is rounded to the nearest pixel for crisp edges.
 *
 * @param size   the value designed on the iPhone 17
 * @param factor 0 = never change, 1 = scale fully with the screen (default 0.5)
 */
export const ms = (size: number, factor = 0.5): number => {
  const scaled = size + (size * scale - size) * factor;
  return PixelRatio.roundToNearestPixel(scaled);
};

/**
 * Font scale — like `ms` but tuned for text. Uses a slightly softer factor so
 * type stays comfortably readable on the smallest screens.
 */
export const mf = (size: number): number => ms(size, 0.4);

// Exposed for the rare screen that needs the true device width (e.g. a full-
// bleed carousel). Prefer `ms`/`mf` for everything else.
export const deviceWidth = width;
export const deviceHeight = height;
