# Dashboard — Animation Patch

The current `app/(tabs)/dashboard/index.tsx` is ~1200 lines and most of it is fine. Don't rewrite it — make these **six surgical changes** to bring it up to the new motion bar. Each is independent; apply them in any order.

## 1. Update imports

```diff
- import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
+ import Animated from 'react-native-reanimated';
+ import { useFadeInUp, useCountUp, useSpringBar, useHaptic } from '@utils/animations';
```

## 2. Replace `FadeIn` / `FadeInDown` with springy fade-in-up

Find every `entering={FadeIn.duration(...)}` and `entering={FadeInDown.delay(X).duration(...)}` in the file. Replace the wrapping `Animated.View` with the hook pattern.

```diff
- <Animated.View entering={FadeIn.duration(400)} style={styles.hero}>
+ <Animated.View style={[styles.hero, useFadeInUp(0)]}>

- <Animated.View entering={FadeInDown.delay(60).duration(400)} style={styles.quickActions}>
+ <Animated.View style={[styles.quickActions, useFadeInUp(60)]}>

- <Animated.View entering={FadeInDown.delay(120).duration(450)} style={styles.row}>
+ <Animated.View style={[styles.row, useFadeInUp(120)]}>
```

Continue the cascade for the remaining sections at delays of 180, 240, 300, 360.

## 3. Animate the Balance Hero amount

Inside `BalanceHeroCard`:

```diff
+ const displayAmount = useCountUp(Math.abs(netAmount), {
+   formatter: (n) => formatFull(n, currencyCode),
+   duration: 700,
+ });

  <Text style={styles.balanceHeroAmt}>
-   {formatFull(Math.abs(netAmount), currencyCode)}
+   {displayAmount}
  </Text>
```

## 4. Add haptics to claim / release / settle buttons

Inside `ParkingCard`:

```diff
+ const haptic = useHaptic();

- const handleClaim = useCallback(async (): Promise<void> => {
-   await claim(myId, myName, houseId ?? '').catch(() => {});
- }, [claim, myId, myName, houseId]);
+ const handleClaim = useCallback(async (): Promise<void> => {
+   haptic.success();
+   await claim(myId, myName, houseId ?? '').catch(() => {});
+ }, [claim, myId, myName, houseId, haptic]);

- const handleRelease = useCallback(async (): Promise<void> => {
-   await release(houseId ?? '').catch(() => {});
- }, [release, houseId]);
+ const handleRelease = useCallback(async (): Promise<void> => {
+   haptic.warn();
+   await release(houseId ?? '').catch(() => {});
+ }, [release, houseId, haptic]);
```

Inside `ChoreCard`, on the "Mark as Done" press:

```diff
+ const haptic = useHaptic();

  onPress={(e) => {
    e.stopPropagation?.();
+   haptic.success();
    toggleChore(myChore.id);
  }}
```

## 5. Spring-animate the vote bars

Inside `VotesWidget`, replace the static-width bar with `useSpringBar`:

```diff
- <View style={styles.voteBarRow}>
-   <Text style={[styles.voteBarLabel, { color: c.textSecondary }]}>Yes</Text>
-   <View style={[styles.voteTrack, { backgroundColor: c.surfaceSecondary }]}>
-     <View style={[styles.voteBar, { width: `${yesWidth}%`, backgroundColor: '#7C4DFF' }]} />
-   </View>
-   <Text style={[styles.voteCount, { color: c.textPrimary }]}>{yesCount}</Text>
- </View>
+ const yesBar = useSpringBar(yesCount, Math.max(1, totalVotes), { delay: 200 });
+ const noBar  = useSpringBar(noCount,  Math.max(1, totalVotes), { delay: 240 });
+
+ <View style={styles.voteBarRow}>
+   <Text style={[styles.voteBarLabel, { color: c.textSecondary }]}>Yes</Text>
+   <View style={[styles.voteTrack, { backgroundColor: c.surfaceSecondary }]}>
+     <Animated.View style={[styles.voteBar, { backgroundColor: '#7C4DFF' }, yesBar.animatedStyle]} />
+   </View>
+   <Text style={[styles.voteCount, { color: c.textPrimary }]}>{yesCount}</Text>
+ </View>
```

(And the same for the "No" row using `noBar`.)

## 6. Press-scale on every WidgetCard — already done

`WidgetCard` wraps a `Pressable`. As soon as you replace `components/ui/Card.tsx` with the upgraded version, **every** `<Card onPress={...}>` in the app gets press scale. `WidgetCard` is custom (defined inline in dashboard), so add scale to it manually:

```diff
  function WidgetCard({ children, style, onPress }: WidgetCardProps): React.JSX.Element {
    const c = useThemedColors();
+   const press = usePressScale(0.97);
    const cardStyle = [styles.card, { backgroundColor: c.surface, borderColor: c.border }, style];

    if (onPress) {
      return (
-       <Pressable style={cardStyle} onPress={onPress} accessibilityRole="button">
-         {children}
-       </Pressable>
+       <Animated.View style={press.animatedStyle}>
+         <Pressable
+           style={cardStyle}
+           onPress={onPress}
+           onPressIn={press.onPressIn}
+           onPressOut={press.onPressOut}
+           accessibilityRole="button"
+         >
+           {children}
+         </Pressable>
+       </Animated.View>
      );
    }
    return <View style={cardStyle}>{children}</View>;
  }
```

Plus this import at the top:
```ts
import { usePressScale } from '@utils/animations';
```

---

That's it. ~30 lines of changes across the whole file, and the dashboard now has:
- Springy staggered entrance for every section
- Count-up on the balance hero
- Spring-animated vote bars
- Haptic feedback on claim / release / mark-done
- Tactile press scale on every widget card

The May Spending summary, floating +, More popup, and Profile popup are all untouched.
