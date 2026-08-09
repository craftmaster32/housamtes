# PR #194 Review & Launch Checklist

**PR:** #194 — _feat: v2 dashboard redesign in the Claude Design style_
**Branch:** `claude/design-v2-app-implementation-wc1fr3` → `main`
**Reviewed:** 2026-08-09 · **Status at review:** Draft · CI green · 188 files · +17,640 / −9,126 · 147 commits

> Plain-English purpose: this is the checklist for turning PR #194 into something safe to merge
> and, later, safe to put on the App Store. Tick the boxes top-to-bottom. **Tier 1 blocks merge.
> Tier 2 blocks a public launch. Tier 3 is polish.**

---

## Snapshot — what I checked and what's already good ✅

- **CI is green** — both required checks ("PR checks" and "preview" deploy) pass.
- **No passwords or secret keys committed** to the repo. `.env` is correctly untracked. ✅
- **New libraries are safe & standard** — only `expo-linear-gradient` and `react-native-svg`
  were added (both official, both needed for the new gradients and the chores ring). ✅
- **Database changes are protected** — the two new migrations keep Row-Level Security (RLS). ✅
- **The dad jokes are original** household-themed writing, not scraped from a paid joke API — no
  copyright problem. ✅
- **Fonts (Fraunces)** ship under the SIL Open Font License — free to embed and publish. ✅
- **The privacy policy is genuinely excellent** — covers GDPR, CCPA/CPRA, Australian Privacy Act,
  Israeli Privacy Protection Law, COPPA, BIPA, DMCA and CSAM. Better than most shipping apps. ✅
- **Premium & ads are switched OFF** (`PREMIUM_ENABLED = false`), so none of the ads/paywall
  compliance work is needed for a first, free launch. ✅

---

## Tier 1 — before this PR is merged 🔴

### Code review items still open from CodeRabbit (8 threads, all minor)
_None are critical, but close them so the redesign ships clean._

- [ ] **Auth session can expire mid-reset** — `app/(auth)/_layout.tsx` never calls
  `supabase.auth.startAutoRefresh()` / `stopAutoRefresh()`, so the password-reset session can die
  if the app is backgrounded. Add AppState handling to the auth layout.
- [ ] **Hardcoded English in Settings** — the "refresh notifications" handler in
  `app/(tabs)/more/settings.tsx` shows raw English (`'Fresh subscription saved…'`, `'Refresh failed'`)
  instead of `t(...)`. Spanish/Hebrew users see English. Route through i18n.
- [ ] **Touch targets under 44×44pt** — several new chips/toggles are 21–40pt tall
  (`grocery/index.tsx` `segBtn`, `photos/index.tsx` `catChip`, `maintenance/index.tsx`
  `resolvedToggle`). Raise `minHeight` to 44 (Apple's minimum tap size / our own a11y rule).
- [ ] **Avatar images missing labels** — new avatar `<Image>`s in `bills/index.tsx` and the voting
  screen have no `accessibilityLabel`, so VoiceOver announces an unlabeled image. Add
  `accessibilityLabel={name}`.
- [ ] **Icon-picker options not screen-reader friendly** — `settings/categories.tsx` icon options
  expose raw names like `home-outline`. Mark them `accessible` with a plain-language label.
- [ ] **`useCallback` missing** — `components/tasks/AddTaskForm.tsx` recreates the priority handler
  every render (our component rule = handlers memoized).
- [ ] **Duplicate icon type** — `IoniconName` is redeclared locally in grocery/calendar/intro;
  import the shared type from `types/icons.ts` instead.

### Repo hygiene blocking a clean merge
- [ ] **Version numbers disagree** — `package.json` says `2.0.0`, `app.json` says `1.0.0`. Pick one
  (this is a v2, so `2.0.0`) and set both. A public build needs a matching iOS `buildNumber` and
  Android `versionCode` too (see Tier 2).
- [ ] **Run the done-check locally** before pushing: `npx tsc --noEmit` → `npm run lint` → `npm test`.
  (Couldn't be run in this review environment — dependencies aren't installed here.)
- [ ] **This is still a Draft PR** — mark "Ready for review" only after the boxes above are ticked.

---

## Tier 2 — before a public App Store / Play Store launch 🟠

### Legal / policy consistency
- [ ] **Age gate is promised but not built.** The privacy policy (§10) says _"Registration is blocked
  for users who indicate they are under 18."_ There is **no age question anywhere in signup** — no
  date-of-birth, no 18+ checkbox. Either **add an explicit "I am 18 or older" confirmation** to
  signup/accept-terms, or soften the policy wording. App Store age rating must match reality.
- [ ] **Support inboxes must actually exist & be monitored.** The policy commits to legal response
  windows at `privacy@housemates.app`, `safety@housemates.app`, `legal@housemates.app`. Set these
  up (even as forwards) before publishing — they are legally binding contact points.
- [ ] **In-app account deletion must work.** Apple Guideline 5.1.1(v) requires it, and the policy
  points users to _Profile → Delete Account_. Test that this fully deletes the account end-to-end.
- [ ] **App name / brand is not finalized.** Public name is **"HouseMates"** (bundle
  `com.housemates.app`), but the design system and `CLAUDE.md` call it **"Nestiq."** Decide the real
  name, then (a) check the name is free on the App Store, (b) do a basic trademark check. "HouseMates"
  is a common term — confirm it's available before you commit.

### Ads / Premium — only when you flip `PREMIUM_ENABLED = true` (future)
_Not needed for a free launch. Do NOT enable until all of these are done, or you'll fail review and
your own privacy policy will be false._
- [ ] **Rewrite the privacy policy** — it currently states "we do not use advertising trackers" and
  "we do not sell or share your data." Turning on AdMob makes both statements untrue. Update the
  policy and the App Store **privacy nutrition labels** in the same release.
- [ ] **Add App Tracking Transparency (ATT)** prompt if ads use the advertising identifier.
- [ ] **Digital purchases must use Apple In-App Purchase** (Guideline 3.1.1) — you can't charge for
  premium through an outside payment link. Wire up real IAP + AdMob per `MONETIZATION.md`.

### Build & release configuration
- [ ] **There is no `eas.json`.** You cannot build for TestFlight / the App Store without it. Create
  the EAS Build config (`eas build:configure`).
- [ ] **Set store versioning** — iOS `buildNumber` and Android `versionCode` in `app.json`
  (`ios.buildNumber`, `android.versionCode`). These must increment every submission.
- [ ] **Trim unused permissions.** `app.json` requests **media library** and **calendar/reminders**.
  Apple rejects apps that ask for permissions they don't visibly use — confirm every feature that
  needs these actually ships, and remove any that don't.
- [ ] **Push notifications need real credentials** — configure the APNs key (iOS) and FCM (Android)
  in EAS before push works in production.
- [ ] **App Store Connect / Play Console setup** — screenshots, description, keywords, support URL,
  marketing privacy-policy URL (host the policy on the web too, not just in-app), and the data-safety
  / privacy-label questionnaire.
- [ ] **Run on a real device** (TestFlight internal build) — the redesign uses gradients, SVG rings
  and count-up animations; confirm performance and that light/dark themes both look right.

---

## Tier 3 — polish & good practice 🟢

- [ ] **Test coverage for the redesign.** CLAUDE.md requires a matching `__tests__/stores/` test when
  behavior changes. The new `dashboardCardsStore.ts` and reworked `groceryStore.ts` /
  `photoStore.ts` should each get/keep a store test so the new behavior can't silently regress.
- [ ] **Design mockups are committed to the app repo** (`design/mockups/*.html`, ~30 files). Harmless
  but bloats the bundle repo — consider moving them to a separate design folder/repo later.
- [ ] **Confirm no leftover `console.log`, `any`, or `TODO`** in the diff (ESLint should already block
  these — just verify the pre-commit hook ran on all 147 commits).
- [ ] **VoiceOver pass** on the new dashboard before calling the phase done (per CLAUDE.md a11y rule).

---

## One-line summary for the owner

PR #194 is **healthy** — green tests, no security or licensing problems, and a very strong privacy
policy. To **merge**, close the 8 small review nits and fix the 1.0.0/2.0.0 version mismatch. To
**launch on the App Store**, the big three are: (1) add a real **18+ age check** to match the policy,
(2) create the missing **`eas.json`** build config, and (3) leave **ads/premium switched off** until
you've redone the privacy policy and wired up Apple's payment system.
