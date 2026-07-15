# SUBMISSION_CHECKLIST.md — App Store submission prep (Phase 8)

Plain-English checklist of everything needed to get HouseMates onto the App
Store. Two lists: what's already done in the code, and what **only you** can do
(accounts, art, screenshots). Work through your list top to bottom.

_Last updated: 2026-07-15 (Session 6 — app-store-prep)._

---

## ✅ Done in the code (this repo)

### App configuration (`app.json`)

- [x] App name: **HouseMates**, version **1.0.0**
- [x] iOS bundle identifier: `com.housemates.app` (confirm this is the exact ID
      you register in your Apple Developer account — it must match)
- [x] iOS build number `1` and Android version code `1` set (EAS auto-increments
      them on production builds via `eas.json`)
- [x] Camera + photo library permission texts with clear user-facing reasons
      (Apple rejects vague ones) — camera/photos via `expo-image-picker`,
      saving photos via `expo-media-library`, calendar/reminders via
      `expo-calendar`
- [x] Notifications: permission is requested at runtime with the system prompt —
      no extra config needed
- [x] `ITSAppUsesNonExemptEncryption: false` — the app only uses standard HTTPS,
      so you can skip Apple's export-compliance question on every build
- [x] `eas.json` created with development / preview / production build profiles

### Apple requirements already met

- [x] **In-app account deletion** (Apple requires this for any app with sign-up):
      Profile → Delete Account → double confirmation → `delete-account` Edge
      Function permanently deletes the auth user and all personal data
      (cascade), with a GDPR audit trail in `deletion_requests`
- [x] **Privacy policy** in-app: reachable logged-out (accept-terms screen) and
      logged-in (Settings and Profile) — real content, not placeholder
- [x] **Terms of service** in-app: same two paths
- [x] Sign in / sign up / forgot-password / email verification all work
- [x] Error boundary (friendly crash screen) wraps the whole app
- [x] Sentry crash reporting — only active in production builds and only when
      a DSN is set; never logs tokens or personal data

### No secrets / debug code in the build

- [x] No API keys, tokens, or service-role keys anywhere in the client code
- [x] `.env` is git-ignored; only `.env.example` (placeholders) is committed
- [x] No `console.log` in the app (Sentry + `console.warn`/`error` only)
- [x] Dev-only code (e.g. the "simulate Premium" switch) is behind `__DEV__`,
      which is stripped from production builds automatically

### Quality gates (run this session)

- [x] `npx tsc --noEmit` — zero errors
- [x] `npm run lint` — zero errors/warnings
- [x] `npm test` — full suite green
- [x] Playwright smoke test of the logged-out flows (welcome → login,
      signup, forgot-password screens render and navigate)

---

## 🟡 Flags — decide before submitting

1. **App icon and splash screen are still the Expo template defaults**
   (`assets/images/icon.png`, `splash-icon.png`, `adaptive-icon.png`,
   `favicon.png`). Apple will not reject a working icon, but these are
   placeholder art — you're waiting on Banani's final designs. Drop the new
   files in at the same paths (icon: 1024×1024 PNG, no transparency for iOS)
   and nothing else needs to change.
2. **App name vs. docs**: the repo docs call the app "Nestiq" in places but
   `app.json` says **HouseMates** and the bundle ID is `com.housemates.app`.
   The App Store name, in-app name, and bundle ID should tell one story —
   confirm which name you're shipping under before you register the bundle ID
   (it cannot be changed after the first upload).
3. **Phase 6 (push notifications)** — the Edge Functions now exist
   (`send-push`, `bill-due-reminder`, `chore-due-reminder`, `parking-check`,
   `grocery-reminder-check`), but PHASES.md's "done signal" is a week of
   reliable delivery on real iPhones. Push on a physical device also needs the
   Expo project ID set (`EXPO_PUBLIC_PROJECT_ID`) and an Apple Push key
   uploaded to Expo — that's part of your EAS setup below.
4. **Premium/ads are placeholders** (see MONETIZATION.md). Submitting v1.0
   free with a visible "Ad placeholder" strip would look unfinished — either
   hide the placeholder for the first release or wire real ads first. Apple
   also requires real, working purchases before you may advertise a paid tier.

---

## 👤 Your to-do list (only you can do these)

Work top to bottom; each step unblocks the next.

1. **Apple Developer account** — enroll at developer.apple.com ($99/year).
   Needs your legal name/entity and two-factor turned on.
2. **Expo account + EAS setup** — create an account at expo.dev, then in the
   repo run:
   - `npx eas login`
   - `npx eas init` (links the repo to your Expo project and writes the
     project ID — then put that ID in `.env` as `EXPO_PUBLIC_PROJECT_ID`)
3. **Register the app in App Store Connect** — create the app with bundle ID
   `com.housemates.app` (or your final choice — see flag #2).
4. **Final art from Banani** — replace the four placeholder images in
   `assets/images/` (flag #1).
5. **First iOS build** — `npx eas build --platform ios --profile production`.
   EAS walks you through certificates and the push key automatically — say yes
   to letting it manage credentials.
6. **TestFlight** — `npx eas submit --platform ios`, then install the build
   via TestFlight on all 3 housemates' iPhones and use it for a week. This is
   also how you verify push notifications end-to-end (Phase 6's done signal).
7. **App Store listing** (App Store Connect):
   - Description, subtitle, keywords, support URL, marketing URL
   - Screenshots: 6.7" (iPhone 15 Pro Max) and 6.1" sizes minimum — take them
     from the TestFlight build
   - **App Privacy questionnaire** — declare: email address, name, photos,
     user content (messages), identifiers (account ID), all "linked to you",
     none used for tracking (no ads/analytics SDKs are shipped in v1)
   - Age rating questionnaire (nothing sensitive → 4+)
   - Privacy policy URL — needs a public web page, not just the in-app screen;
     the web build at housemates-five.vercel.app can serve it
8. **Supabase production hygiene** (dashboard, 5 minutes):
   - Authentication → enable leaked-password protection
   - Confirm email verification is required
   - 2FA on your Supabase, Vercel, GitHub, and Apple accounts
9. **Submit for review** — from App Store Connect, after TestFlight week is
   clean and Sentry shows no crashes. Apple typically reviews in 1–3 days.

---

## Suggested order with the current repo state

TestFlight (steps 1–6) can start **now** — placeholder icon is fine for
internal testing. Hold the public submission (steps 7–9) until: final art is
in, the name decision is made, the ad placeholder is hidden or real, and the
3-housemate TestFlight week passes with quiet Sentry.
