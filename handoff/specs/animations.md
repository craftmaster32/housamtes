# Animation System — Spec & Rollout

The whole app gets its "feels alive" quality from **one tiny hooks library** plus **two upgraded primitives**. No screen-by-screen rewrites needed.

## Files

| Path | What it is | Status |
|---|---|---|
| `utils/animations.ts` | Hooks library (count-up, press scale, spring bar, expandable, haptics) | **New** |
| `components/ui/Card.tsx` | Drop-in replacement — adds press scale + entering | **Replace** |
| `components/ui/Button.tsx` | Drop-in replacement — adds spring press + haptic | **Replace** |

All three are backward-compatible: existing call sites keep working unchanged. New animation features are opt-in via new props.

## Dependencies (already in your project)
- `react-native-reanimated` v3
- `expo-haptics`
- `react-native-gesture-handler`

No new packages.

## The five hooks

### `useCountUp(value, { formatter, duration, skipOnMount })`
Animated number that smoothly counts from previous value to new. **Use this for any prominent amount** — balance hero, spending totals, vote counts, settle-up rows.

```tsx
const display = useCountUp(myShare, {
  formatter: (n) => formatFull(n, currencyCode),
  duration: 800,
});
<Text>{display}</Text>
```

### `usePressScale(target?)`
Spring scale on press. **Use on any custom Pressable** that should feel tactile. Card and Button use this internally already.

```tsx
const { animatedStyle, onPressIn, onPressOut } = usePressScale();
<Pressable onPressIn={onPressIn} onPressOut={onPressOut}>
  <Animated.View style={[styles.thing, animatedStyle]}>...</Animated.View>
</Pressable>
```

### `useFadeInUp(delay?, distance?)`
Spring fade-in + slide-up on mount. **Use for staggered widget reveals** — 0, 80, 160, 240ms delays cascade nicely.

```tsx
<Animated.View style={[styles.card, useFadeInUp(80)]}>...</Animated.View>
```

### `useSpringBar(value, max, { delay })`
Returns `animatedStyle` that animates a `width: %`. **Use for any progress bar** — votes, chore completion, spending share.

```tsx
const { animatedStyle } = useSpringBar(yesCount, totalVotes);
<Animated.View style={[styles.bar, animatedStyle]} />
```

### `useExpandable(isOpen)`
Drives an accordion / dropdown / inline expander. Returns `containerStyle` for the body and `caretStyle` for a rotating chevron.

```tsx
const { containerStyle, caretStyle } = useExpandable(showDetails);
{showDetails && <Animated.View style={containerStyle}>...</Animated.View>}
<Animated.View style={caretStyle}><Ionicons name="chevron-down" /></Animated.View>
```

### `useHaptic()`
Curated haptic wrappers. **Call on every meaningful interaction.**

| Method | When |
|---|---|
| `tap()` | Every button press |
| `toggle()` | Switch flipped, chore checked, tab changed |
| `success()` | Settle up, chore complete, bill added |
| `warn()` | Confirming a destructive action |
| `error()` | Failed submit |

`Button` calls `tap()` automatically. Pass `haptic="success"` to override or `haptic={null}` to silence.

## Rollout — three phases

### Phase 1 — drop these 3 files in (5 min)
Copy `utils/animations.ts`, `components/ui/Card.tsx`, `components/ui/Button.tsx` over your existing files. Every `<Button>` in the app now has spring press + light haptic. Every `<Card onPress={...}>` now has spring press. **No screen changes needed** — this alone makes the app feel alive.

### Phase 2 — sprinkle `useCountUp` on the four big numbers (15 min)
Replace static `<Text>{formatFull(amount, code)}</Text>` with the hook on:
1. **Dashboard → Balance hero** — `netAmount`
2. **Dashboard → Spending card** — house total + your share
3. **Bills → Settle up rows** — each transfer amount
4. **Spending screen** — already done in v2

Pattern:
```tsx
// Before
<Text style={styles.amount}>{formatFull(amount, currencyCode)}</Text>

// After
const display = useCountUp(amount, { formatter: (n) => formatFull(n, currencyCode) });
<Text style={styles.amount}>{display}</Text>
```

### Phase 3 — stagger reveals on Dashboard widgets (10 min)
Wrap each top-level widget on the dashboard in a staggered `useFadeInUp`:

```tsx
// Dashboard sections, in render order:
<Animated.View style={useFadeInUp(0)}>   {/* greeting */}
<Animated.View style={useFadeInUp(60)}>  {/* quick actions */}
<Animated.View style={useFadeInUp(120)}> {/* balance hero */}
<Animated.View style={useFadeInUp(180)}> {/* spending card */}
<Animated.View style={useFadeInUp(240)}> {/* today at home */}
<Animated.View style={useFadeInUp(300)}> {/* widget grid */}
```

Replace the existing `entering={FadeIn.duration(400)}` and `entering={FadeInDown.delay(...)}` calls on Dashboard sections. The new hooks use springs instead of linear easing — feels noticeably better.

## What stays from the current app
Per the brief, these are kept and **not** touched by this rollout:
- **Home → May Spending summary card** (`SpendingCard.tsx`)
- **Floating + button** in the tab bar
- **More popup** (the animated pop-in with Grocery / Chores / Calendar / etc)
- **Profile popup** (avatar tap → Profile / Settings / Sign out)
- **Bills → Settle Up detailed rows + sort by date**

The `useCountUp` upgrade on Settle Up rows is *additive* — same layout, just animated numbers.

## Per-screen polish notes
After Phases 1–3, the whole app feels animated. These are optional next steps when you want a specific screen to feel *more* alive:

| Screen | Polish |
|---|---|
| Bills list | `LinearTransition` on rows so the sort-by-date toggle animates |
| Chores | `useHaptic().success()` on "mark done"; `LinearTransition` on the list |
| Parking | `useCountUp` on the duration timer; `useExpandable` on reservations |
| Voting | `useSpringBar` on yes/no bars (replace fixed widths) |
| Grocery | `LinearTransition` on the FlatList so swipe-deletes animate |
| Calendar | `usePressScale` on day cells |

Each of these is a 1–5 line change per screen. None require rewrites.
