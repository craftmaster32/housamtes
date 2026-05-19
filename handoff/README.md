# Handoff — Animation System

## What's in this folder

| File | Drop into | Purpose |
|---|---|---|
| `utils/animations.ts` | `homeapp/utils/animations.ts` | **New file** — reusable animation hooks library |
| `components/ui/Card.tsx` | `homeapp/components/ui/Card.tsx` | **Replace** — adds press-scale + entering support |
| `components/ui/Button.tsx` | `homeapp/components/ui/Button.tsx` | **Replace** — adds spring press + haptics |
| `specs/animations.md` | `homeapp/specs/animations.md` | System spec — read first |
| `specs/dashboard-animations-patch.md` | `homeapp/specs/` | Surgical patch for Dashboard |

## Apply order

1. **Copy the three code files** into the matching paths. Existing call sites keep working — every `<Button>` and `<Card onPress>` instantly gets spring press + haptic. **No screen changes needed.**

2. **Read `specs/animations.md`** — explains every hook and where to use it across the app.

3. **Apply `specs/dashboard-animations-patch.md`** — six surgical edits to `app/(tabs)/dashboard/index.tsx` (no rewrite). Adds count-up on the balance, springy stagger on widgets, animated vote bars, haptics on claim/release/done.

4. **Repeat for other screens** as needed. Each pattern in the spec (one-line additions on Bills, Chores, Parking, etc.) is ~5 minutes per screen.

## What's NOT touched

Per the brief, these are kept exactly as they are:
- Home → May Spending summary card (`SpendingCard.tsx`)
- Floating + tab bar button
- "More" popup with house features (Grocery, Chores, Calendar, Photos, Housemates, Votes, Property)
- Profile popup (avatar tap menu)
- Bills → Settle Up detailed section + sort by date

## Dependencies

Already in your project — no new installs:
- `react-native-reanimated` v3
- `expo-haptics`
- `react-native-gesture-handler`
