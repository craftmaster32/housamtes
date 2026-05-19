# Migration Playbook — HouseMates v2 Design System

This is for **Claude Code** to follow on the local repo. The design system
files are already in place (`constants/colors.ts`, `constants/typography.ts`,
`constants/currencies.ts`, `components/ui/*`). This playbook walks every
screen through the same migration recipe so the look upgrades app-wide.

## Prereqs (do these once before any screen)

1. **Settings store migration** — see `specs/spending-v2.md` §3.
   Add `themeMode` and `currencyCode` to `useSettingsStore` with the
   `onRehydrateStorage` migration. Keep `currency` (symbol) readable for one
   release.
2. **Verify build** — `npm start`, app launches, no TypeScript errors.
3. **Dark mode toggle (temporary)** — wire a single switch in
   `app/(tabs)/settings/index.tsx` that calls `setThemeMode()`. This lets
   you test dark mode while migrating.

## Per-screen migration recipe

Apply this to every screen file in `app/(tabs)/**`, `app/(auth)/**`,
`app/(onboarding)/**`. Order: see batch list below.

**Step 1 — swap colors import:**
```diff
- import { colors } from '@constants/colors';
+ import { useThemedColors } from '@constants/colors';
```
Inside the component, add `const C = useThemedColors();` at the top.

**Step 2 — move StyleSheet inside the component (or use a factory):**
The old `StyleSheet.create` runs once at module load and can't see `C`.
Pick one of:

- **Option A (preferred for small screens):** inline most styles directly
  in JSX using `C.*` tokens. Keep `StyleSheet.create` only for static
  layout (paddings, flex). Replace every `colors.*` reference with `C.*`.
- **Option B (large screens):** extract a `makeStyles(C)` function:
  ```ts
  const makeStyles = (C: ColorTokens) => StyleSheet.create({ ... });
  // inside component:
  const styles = useMemo(() => makeStyles(C), [C]);
  ```

**Step 3 — replace ad-hoc surfaces with `<Card>`:**
Any `View` whose style is `{ backgroundColor, borderRadius, padding,
boxShadow }` → swap to `<Card pad="md">`. Drop the manual styles.

**Step 4 — replace ad-hoc buttons with `<Button>`:**
Any `Pressable` styled as a pill button → `<Button variant="primary|secondary|ghost">`.
Loading spinners inside buttons → use `loading` prop.

**Step 5 — replace status badges / category chips with `<Pill>`:**
`<View style={{ backgroundColor: colors.success + '18' ... }}><Text>Paid</Text></View>`
→ `<Pill tone="success">Paid</Pill>`.

**Step 6 — replace headers with `<Header>`:**
The standard "back chevron / title / right slot" row at the top of every
detail screen → `<Header title="Bills" back />`.

**Step 7 — replace currency formatting:**
```diff
- {currency}{amount.toFixed(2)}
+ {formatFull(amount, currencyCode)}
```
Import `formatFull, formatShort` from `@constants/currencies`. Read
`currencyCode` from `useSettingsStore`.

**Step 8 — replace type literals with `type.*` ladder:**
```diff
- { fontSize: 17, ...font.bold, color: colors.textPrimary }
+ [type.subtitle, { color: C.textPrimary }]
```
Common mappings:
- 26-30px bold amount → `type.displayMd` (or `displayLg` for hero numbers)
- 20px screen title → `type.title`
- 17px subtitle → `type.subtitle`
- 14px body → `type.bodyMd`
- 11px UPPERCASE label → `type.eyebrow`

**Step 9 — empty / loading / error states:**
Replace bespoke "No items yet" blocks with `<EmptyState>`. One per state.

**Step 10 — verify:**
Run `npm start`, open the screen in both light + dark mode, tap through
every interaction. Commit per screen.

## Batch order

Land in this order — each batch is one PR. Stop after each batch and
smoke-test the app before moving on.

**Batch 1 — High-traffic core (do first)**
- `app/(tabs)/dashboard/index.tsx`
- `app/(tabs)/bills/index.tsx`
- `app/(tabs)/bills/add.tsx`
- `app/(tabs)/bills/[id].tsx`
- `app/(tabs)/parking/index.tsx`

**Batch 2 — Secondary tabs**
- `app/(tabs)/grocery/index.tsx`
- `app/(tabs)/chores/index.tsx`
- `app/(tabs)/calendar/index.tsx`
- `app/(tabs)/photos/index.tsx`

**Batch 3 — Profile + Settings**
- `app/(tabs)/profile/index.tsx`
- `app/(tabs)/settings/index.tsx`
- `app/(tabs)/settings/categories.tsx`
- `app/(tabs)/settings/members.tsx`
- `app/(tabs)/settings/notifications.tsx`
- `app/(tabs)/more/index.tsx`
- `app/(tabs)/more/chat.tsx`
- `app/(tabs)/more/settings.tsx`

**Batch 4 — Less-trafficked**
- `app/(tabs)/condition/index.tsx`
- `app/(tabs)/maintenance/index.tsx`
- `app/(tabs)/voting/index.tsx`
- `app/(tabs)/property/index.tsx`
- `app/(tabs)/bills/setup.tsx`

**Batch 5 — Onboarding + Auth (lowest risk, do last)**
- `app/(auth)/welcome.tsx`
- `app/(auth)/login.tsx`
- `app/(auth)/signup.tsx`
- `app/(auth)/forgot-password.tsx`
- `app/(auth)/reset-password.tsx`
- `app/(auth)/verify-email.tsx`
- `app/(onboarding)/intro.tsx`
- `app/(onboarding)/house-setup.tsx`

**Batch 6 — Settings UI (after all screens are migrated)**
Wire the proper Theme + Currency pickers into
`app/(tabs)/settings/index.tsx`. Three radio rows for theme
(System / Light / Dark) and a currency list using `CURRENCY_LIST` from
`@constants/currencies`. Remove the temporary toggle from prereq §3.

## Definition of done per screen

- No remaining `import { colors } from '@constants/colors'` (only
  `useThemedColors`)
- No remaining `colors.*` references in style values
- No remaining hard-coded hex values for surfaces, text, or borders
- Currency rendered via `formatFull` / `formatShort`
- Screen looks correct in light AND dark mode
- All `Pressable` action buttons → `<Button>`
- All status/category chips → `<Pill>`
- Empty/loading/error states → `<EmptyState>`

## Reference

The visual target is the design project at
[HouseMates Design System] — see the Mobile UI Kit and `Spending v2.html`
for examples of how each component is composed.
