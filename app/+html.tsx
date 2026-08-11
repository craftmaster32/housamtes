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
 */
export default function Root({ children }: PropsWithChildren): React.JSX.Element {
  return (
    <html lang="en" translate="no">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="google" content="notranslate" />
        <ScrollViewStyleReset />
      </head>
      <body className="notranslate">{children}</body>
    </html>
  );
}
