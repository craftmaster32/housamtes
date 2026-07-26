import type * as React from 'react';
import type { Ionicons } from '@expo/vector-icons';

// Single source of truth for the Ionicons glyph-name type. Stores and
// components that type an icon field reuse this instead of each re-deriving
// `React.ComponentProps<typeof Ionicons>['name']`, so the icon typing can
// change in one place if the icon library ever does.
export type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
