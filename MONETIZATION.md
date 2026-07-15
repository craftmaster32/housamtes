# MONETIZATION.md — What's built and what you need to do to go live

The app is now **monetization-ready**: the free-with-ads + premium structure
exists, but no real ads and no real payments are wired up. Everyone is on the
free tier, nothing costs money, and the only visible change for users is a
small labelled "Ad placeholder" strip above the bottom tab bar and a Premium
section in Settings.

---

## What was built (Session 5 — monetization groundwork)

| Piece              | File                                                    | What it does                                                                                                                                                               |
| ------------------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entitlements store | `stores/entitlementsStore.ts`                           | Single source of truth: `isPremium` flag (defaults to **false**), `hasEntitlement(feature)` gate helper, photo-limit maths. Persisted locally.                             |
| Ad slot            | `components/premium/AdBanner.tsx`                       | One 50pt banner placeholder, rendered above the bottom tab bar (`app/_layout.tsx`). Premium users see nothing.                                                             |
| Upsell card        | `components/premium/PremiumUpsell.tsx`                  | Reusable "Unlock with Premium" card — drop it wherever a free user hits a premium boundary.                                                                                |
| Paywall screen     | `app/(tabs)/settings/premium.tsx`                       | Lists the four premium unlocks. The upgrade / restore buttons show a "coming soon" notice until real billing exists. Includes a dev-build-only switch to simulate Premium. |
| Photo limit gate   | `app/(tabs)/photos/index.tsx`                           | The existing 50-photo cap now reads from the entitlements store — Premium removes it. Free users at the cap see the upsell card.                                           |
| Settings entry     | `app/(tabs)/settings/index.tsx`                         | "HouseMates Premium" row → paywall screen.                                                                                                                                 |
| Tests              | `__tests__/stores/entitlementsStore.test.ts`            | Locks in the gating and photo-limit behaviour.                                                                                                                             |
| Strings            | `locales/en.json`, `locales/he.json`, `locales/es.json` | All premium copy in all three languages.                                                                                                                                   |

**The four premium unlocks** (from FEATURES.md Phase 7 + IDEAS.md):
ad-free · unlimited photos · PDF reports · custom themes.

PDF reports and custom themes are not built yet — the paywall advertises them
as part of the premium plan, and when they are built they must check
`useEntitlementsStore.getState().hasEntitlement('pdf_reports')` and/or
`hasEntitlement('custom_themes')` before unlocking each one.

---

## How the future billing layer plugs in

Everything funnels through **one flag**. When a purchase SDK is added, it only
has to call:

```ts
useEntitlementsStore.getState().setPremium(true); // after a verified purchase/restore
```

- `AdBanner` hides itself.
- The photo limit disappears.
- The paywall switches to its "Premium is active" state.
- Any feature gated with `hasEntitlement(...)` unlocks.

MONETIZATION markers in the code (search for `MONETIZATION:`) show the exact
swap points:

- `components/premium/AdBanner.tsx` — replace the placeholder `<View>` with the
  real AdMob `<BannerAd>`.
- `app/(tabs)/settings/premium.tsx` — connect the upgrade/restore buttons to
  the real IAP flow.
- `stores/entitlementsStore.ts` — `setPremium` is the hook the IAP layer calls.

`setPremium(true)` is only the happy path. When the real IAP layer lands, it
must also re-check the verified entitlement on app launch and foreground (not
just once at purchase time), and call `setPremium(false)` only when that
entitlement has actually become inactive — expired or refunded. A
**cancellation** is not the same thing: cancelling only turns off
auto-renewal, and the user typically keeps access for the rest of the period
they already paid for. Don't revoke on cancellation alone — base
`setPremium(false)` on the entitlement itself lapsing, not the cancellation
event.

---

## Your to-do list to go live (only you can do these)

### 1. Apple developer setup

- [ ] Enroll in the **Apple Developer Program** ($99/year) if not already done.
- [ ] In **App Store Connect**, create the app record with the final bundle ID.
- [ ] Create the in-app purchase product (suggested: one auto-renewing
      subscription, e.g. `premium_monthly`, plus optionally `premium_yearly`).
- [ ] Decide the price tier (nothing in the app hardcodes a price — the
      paywall shows "pricing announced at launch" until you set one).
- [ ] Fill in the App Privacy questionnaire (ads = "used for advertising",
      once AdMob is added).

### 2. Payments SDK (needs your accounts + a dependency approval)

- [ ] Pick the IAP layer — recommendation: **RevenueCat** (free up to
      $2.5k/month Monthly Tracked Revenue (MTR), handles receipt validation,
      restores, and subscription state so we don't build a backend for it —
      recheck their current pricing terms before launch, vendor pricing shifts).
- [ ] Create the RevenueCat account, add the App Store app, and get the API key.
- [ ] Approve adding the SDK (`react-native-purchases`) — per CLAUDE.md no
      dependency is installed without your yes.

### 3. Ads (AdMob)

- [ ] Create a **Google AdMob** account and an iOS app entry.
- [ ] Create one **banner ad unit** and note its unit ID.
- [ ] Approve adding the SDK (`react-native-google-mobile-ads`) and the
      `app.json` config (AdMob app ID goes there).
- [ ] Decide on consent: AdMob requires a CMP/UMP consent flow for users in
      the EEA, UK, and Switzerland specifically (not universally), including a
      visible "privacy options" entry point so a user can withdraw consent
      later. We build the exact flow when the SDK lands and the setup is final.

### 4. Keys & secrets

- [ ] AdMob App ID + banner unit ID → `app.json` / env config (they are not
      secret, but keep them out of source until final).
- [ ] RevenueCat public API key → env config (`EXPO_PUBLIC_` prefixed is fine,
      it is a public key).
- [ ] Nothing goes in the repo until you provide the real values.

### 5. Product decisions still open

- [ ] Price point and whether there's a yearly plan / free trial.
- [ ] Whether existing housemates (you three) get Premium granted manually.
- [ ] Final premium feature list — the paywall currently advertises the four
      from FEATURES.md/IDEAS.md; PDF reports and custom themes need to be
      built before launch or removed from the paywall copy.

---

## What deliberately did NOT happen this session

- No payment SDK, ad SDK, or any new dependency was installed.
- No App Store products were created.
- No real money can change hands — the upgrade button only shows a notice.
- No user-facing behaviour changed for premium-less users beyond the labelled
  ad placeholder and the new Premium screens (the 50-photo cap already
  existed).
