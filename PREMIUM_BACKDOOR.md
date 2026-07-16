# Premium & Ads — The Back Door 🔒

**Plain English:** We built the whole premium + ads system (the "Fable Season 5"
money stuff), but we are **not showing it to anyone yet**. It is switched OFF.
Nothing was deleted. When you want to go live, you flip **one switch** and it all
comes back — no digging, no "it took forever like the Hebrew thing."

---

## The one switch

**File:** `constants/featureFlags.ts`

```ts
export const PREMIUM_ENABLED = false;  // ← change to true to publish premium
```

- `false` = premium & ads are hidden. (This is how it is now.)
- `true` = everything below turns back on at once.

That's it. There is nothing else to un-hide.

---

## What the switch controls

When `PREMIUM_ENABLED` is `true`, these come back automatically:

| Where | What the user sees |
| ----- | ------------------ |
| Bottom of every screen | The ad banner (placeholder for now — real ads need the step below) |
| Settings screen | The **Premium ✨** row that opens the paywall |
| Photos screen | The 50-photo free limit + the "Upgrade" card when they hit it |

The paywall screen itself (`app/(tabs)/settings/premium.tsx`) was never removed —
it just has no way in while the switch is off.

---

## What was changed to hide it (so you can trust it's reversible)

Only **5 small edits**, all guarded by the switch — no premium code was deleted:

1. `constants/featureFlags.ts` — **new file**, holds the switch.
2. `components/premium/AdBanner.tsx` — shows nothing while off.
3. `app/(tabs)/settings/index.tsx` — hides the Premium row while off.
4. `app/(tabs)/photos/index.tsx` — no photo limit / no upsell while off.
5. `app/(tabs)/settings/premium.tsx` — redirects direct navigation while off.

The "engine" (`stores/entitlementsStore.ts`) and its tests were **not touched**,
so everything is still proven to work for when you flip it on.

---

## When you're ready to actually publish (future you)

1. Set `PREMIUM_ENABLED = true` in `constants/featureFlags.ts`.
2. Everything above appears immediately.
3. The ad banner is still a **placeholder**. To show real paying ads and let
   people actually buy premium, follow the money-plumbing steps in
   **`MONETIZATION.md`** (hooking up AdMob + the purchase system). That part is a
   separate job — the switch just makes the screens visible.

Ask Claude: _"turn premium on"_ and it will do step 1 for you.
