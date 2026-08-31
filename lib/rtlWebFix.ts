/**
 * CSS injected into the document on web when the active language is
 * right-to-left (Hebrew). It corrects a few react-native-paper /
 * react-native-web quirks whose styles are hardcoded to the physical
 * left/right and ignore text direction.
 *
 * Note: the trailing TextInput icon (e.g. the password "eye") is NOT handled
 * here. Paper positions its adornments with inline styles that CSS can't
 * reliably override, so the screens pass the icon to Paper's `left` prop in RTL
 * instead — see the auth screens.
 */
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
  'html[dir="rtl"] [data-testid$="-label-active"], html[dir="rtl"] [data-testid$="-label-inactive"] { left: auto !important; right: 0 !important; direction: rtl !important; text-align: right !important; }',
  // The little background patch that notches the outline behind a floated label
  // is hardcoded to the physical left (`left: 8`); mirror it so the border is
  // hidden behind the right-anchored label instead of showing through it.
  'html[dir="rtl"] [data-testid$="-label-background"] { left: auto !important; right: 8px !important; }',
].join('\n');
