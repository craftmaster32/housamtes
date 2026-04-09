// Design tokens — pulled from Banani/Figma export (single source of truth)
export const colors = {
  // Brand
  primary:       '#3B6FBF',
  primaryLight:  '#5B8FD6',
  primaryDark:   '#2B5A99',

  // Semantic
  success:  '#4FB071',
  warning:  '#E0B24D',
  danger:   '#D9534F',
  info:     '#3B6FBF',

  // Neutrals
  white:            '#FFFFFF',
  black:            '#000000',
  background:       '#F6F2EA',   // --background
  surface:          '#FFFFFF',   // --card
  surfaceSecondary: '#F3ECE5',   // --muted
  border:           'rgba(0,0,0,0.08)',  // --border (very subtle)
  borderLight:      'rgba(0,0,0,0.05)',
  textPrimary:      '#23323E',   // --foreground
  textSecondary:    '#8D8F8F',   // --muted-foreground
  textTertiary:     '#AEAEB2',
  textDisabled:     '#C7C7CC',

  // Secondary palette (badges, highlights)
  secondary:           '#EAF3FF',  // --secondary
  secondaryForeground: '#274056',  // --secondary-foreground
  accent:              '#D6E9FF',  // --accent
  accentForeground:    '#12324A',  // --accent-foreground

  // Aliases
  positive: '#4FB071',
  negative: '#D9534F',

  // Avatar palette
  avatar: ['#3B6FBF', '#FF2D55', '#E0B24D', '#4FB071', '#007AFF', '#AF52DE'],
} as const;
