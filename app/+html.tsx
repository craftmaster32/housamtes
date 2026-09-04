import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Web-only root HTML shell. Expo Router renders this once to produce index.html.
 *
 * The `translate="no"` attribute + `notranslate` signals tell Chrome/Safari to
 * leave the page alone: the app already ships its own English/Hebrew/Spanish
 * copy, and browser auto-translation both mistranslates our labels (e.g.
 * "Personal" → "Staff") and breaks the icon font (glyphs turn into empty
 * boxes). Opting out keeps the UI rendering exactly as designed.
 *
 * The PWA tags below (manifest link, theme-color, apple-touch-icon) are what
 * let Android Chrome offer a proper "Install app" prompt — without the
 * manifest link, "Add to Home screen" only makes a plain browser shortcut.
 * The apple-* tags do the equivalent for adding to the iPhone home screen.
 */
export default function Root({ children }: PropsWithChildren): React.JSX.Element {
  return (
    <html lang="en" translate="no">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="google" content="notranslate" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0D1421" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="HouseMates" />
        <ScrollViewStyleReset />
      </head>
      <body className="notranslate">{children}</body>
    </html>
  );
}
