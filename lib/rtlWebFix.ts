/**
 * CSS injected into the document on web when the active language is
 * right-to-left (Hebrew). It corrects a handful of react-native-paper /
 * react-native-web quirks whose styles are hardcoded to the physical
 * left/right and ignore text direction.
 *
 * The two icon selectors below are coupled to react-native-paper's *internal*
 * DOM structure (verified against the version pinned in package-lock.json:
 * react-native-paper 5.15.0 on react-native-web 0.21.2). They live here, as
 * named exports, so the regression test in
 * `__tests__/screens/rtl-icon-input.test.ts` can pin that coupling without
 * duplicating the selector strings. If you bump react-native-paper, re-verify
 * the rendered DOM and update both this file and that test together.
 */

/**
 * The trailing TextInput icon (e.g. the password "eye") carries
 * `data-testid="right-icon-adornment"` on its nested IconButton. Its
 * absolutely-positioned adornment container is the icon's *direct* parent, so
 * we anchor with the child combinator `:has(> …)`. The `>` is essential: a
 * plain descendant `:has(…)` would also match every ancestor div (the field,
 * the card, the root) and shove them all to `left: 16px`.
 */
export const RTL_RIGHT_ICON_CONTAINER_SELECTOR =
  'html[dir="rtl"] div:has(> [data-testid="right-icon-adornment"])';

/**
 * react-native-web wraps the TextInput's `<input>` in a child `<div>` that is a
 * sibling of the adornment container, so reaching the input from the field
 * container is `> div > input`, not `> input`. Covers `<textarea>` too (Paper
 * renders one for multiline inputs).
 */
export const RTL_RIGHT_ICON_INPUT_SELECTOR =
  'html[dir="rtl"] div:has([data-testid="right-icon-adornment"]) > div > input, ' +
  'html[dir="rtl"] div:has([data-testid="right-icon-adornment"]) > div > textarea';

export const RTL_WEB_FIX_CSS: string = [
  'html[dir="rtl"] body, html[dir="rtl"] #root, html[dir="rtl"] #root > div { direction: rtl !important; }',
  'html[dir="rtl"] input, html[dir="rtl"] textarea, html[dir="rtl"] select { text-align: right; direction: rtl; }',
  // react-native-paper's Text component hardcodes textAlign: 'left' in its base
  // style, which silently overrides RNW's RTL-aware default for any Paper <Text>
  // that doesn't set its own textAlign. No !important here: this rule must lose
  // to any component-specified textAlign (e.g. explicit `textAlign: 'center'`
  // styles elsewhere in the app), and only needs to beat Paper's own base style.
  'html[dir="rtl"] [dir="auto"] { text-align: right; }',
  // react-native-paper's outlined/flat TextInput hardcodes `left: 0` on its
  // floating label (placeholderStyle), ignoring I18nManager entirely, so the
  // label sits pinned to the physical left of the field in RTL instead of the
  // right. Flip it for the label text and its background mask.
  'html[dir="rtl"] [data-testid$="-label-active"], html[dir="rtl"] [data-testid$="-label-inactive"] { left: auto !important; right: 0 !important; }',
  // react-native-paper positions the trailing TextInput icon (e.g. the
  // password "eye") with a hardcoded physical `right` inline style and never
  // consults I18nManager, so in RTL it stays pinned to the physical right —
  // landing on top of the right-anchored label (see the login screen). Move the
  // icon adornment to the mirrored (left) side so it clears the label. Every
  // icon field in the app is `mode="outlined"` with a trailing icon only.
  `${RTL_RIGHT_ICON_CONTAINER_SELECTOR} { right: auto !important; left: 16px !important; }`,
  // The native input reserves space for that icon with a physical `margin-right`
  // (ADORNMENT_OFFSET + OUTLINED_INPUT_OFFSET = 32). Flip it to the left so the
  // right-aligned text keeps clear of the moved icon.
  `${RTL_RIGHT_ICON_INPUT_SELECTOR} { margin-right: 0 !important; margin-left: 32px !important; }`,
].join('\n');
