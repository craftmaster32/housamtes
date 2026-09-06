// Responsive sizing — makes the app fit every iPhone, not just the one it was
// designed on. Every hard-coded pixel in the app was tuned on an iPhone 17
// (402pt wide). On narrower phones those numbers are too big and things spill
// over, so we gently scale them down toward the device width. On the iPhone 17
// the scale is exactly 1, so that layout is left untouched.

import { Dimensions, PixelRatio } from 'react-native';

// The screen the design was built on (iPhone 17 logical width, in points).
export const BASE_WIDTH = 402;

// How far a raw ratio is allowed to stray, so text never becomes unreadable on
// the smallest phone nor blows up on the biggest Pro Max / desktop web.
const MIN_SCALE = 0.84;
const MAX_SCALE = 1.06;

/**
 * Pure scale factor for a given screen width. Exported so it can be unit-tested
 * without a device. `ms`/`mf` below feed it the real device width.
 */
export const scaleForWidth = (width: number): number => {
  const raw = width / BASE_WIDTH;
  if (!Number.isFinite(raw) || raw <= 0) return MIN_SCALE;
  return Math.min(Math.max(raw, MIN_SCALE), MAX_SCALE);
};

/**
 * Pure moderate-scale for a given width — the math behind `ms`, testable in
 * isolation. Nudges a size part-way toward the device width (factor 0.5 by
 * default) and rounds to the nearest device pixel.
 */
export const moderateScaleForWidth = (size: number, width: number, factor = 0.5): number => {
  const scale = scaleForWidth(width);
  const scaled = size + (size * scale - size) * factor;
  return PixelRatio.roundToNearestPixel(scaled);
};

// Phones only — read once at startup. Portrait width is the shorter side, so we
// stay stable even if the device reports landscape at some odd moment.
const { width, height } = Dimensions.get('window');
const shortSide = Math.min(width, height);

/**
 * Moderate scale — the everyday helper. Nudges a size toward this device's
 * width but only part-way (factor 0.5 by default), so small phones shrink
 * gently instead of collapsing.
 *
 * @param size   the value designed on the iPhone 17
 * @param factor 0 = never change, 1 = scale fully with the screen (default 0.5)
 */
export const ms = (size: number, factor = 0.5): number =>
  moderateScaleForWidth(size, shortSide, factor);

/**
 * Font scale — like `ms` but tuned for text. Uses a slightly softer factor so
 * type stays comfortably readable on the smallest screens.
 */
export const mf = (size: number): number => ms(size, 0.4);

// Exposed for the rare screen that needs the true device width (e.g. a full-
// bleed carousel). Prefer `ms`/`mf` for everything else.
export const deviceWidth = width;
export const deviceHeight = height;

// ── Large-screen framing ─────────────────────────────────────────────────────
// The whole app is a phone-shaped, single-column layout. On anything wider than
// a phone — desktop web, an iPad, a large monitor — letting it stretch edge to
// edge looks broken (a 44px button floating in a sea of empty canvas). Instead
// we cap the app to a comfortable phone-like column and centre it, painting the
// space around it with `appBackdrop`. The design was tuned at 402pt; 480 gives a
// little breathing room without the layout losing its phone proportions.
export const APP_MAX_WIDTH = 480;

/**
 * Width the app frame should occupy for a given window width: the full window on
 * a phone, capped at APP_MAX_WIDTH once the window is wider. Pure + exported so
 * it can be unit-tested; the layout feeds it the live `useWindowDimensions`
 * width so it also reacts to rotation and browser-window resizing.
 */
export const contentWidthForWindow = (windowWidth: number): number => {
  if (!Number.isFinite(windowWidth) || windowWidth <= 0) return APP_MAX_WIDTH;
  return Math.min(windowWidth, APP_MAX_WIDTH);
};

/**
 * True when the window is wider than the phone frame — i.e. the backdrop and the
 * centred-frame chrome (side borders) should show. Pure + exported for testing.
 */
export const isLargeScreen = (windowWidth: number): boolean =>
  Number.isFinite(windowWidth) && windowWidth > APP_MAX_WIDTH;
