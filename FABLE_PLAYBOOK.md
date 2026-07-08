# FABLE_PLAYBOOK.md — Getting the most out of Fable before it's gone

Six copy-paste prompts, one per session. Each is self-contained: it tells Fable
its mission, the guardrails already baked into this repo (CLAUDE.md), how much
freedom it has, and how to prove the work is done. Run them **in order** — later
sessions assume earlier ones landed.

## How to use this file

1. Start a fresh Fable session on this repo.
2. Copy **one** prompt block below (everything inside the ``` fence) and paste it.
3. Let it run to the end. It will branch, build, test, commit, and push on its own.
4. Review the branch, merge, then run the deploy commands it gives you.
5. Move to the next prompt in a new session (fresh context = sharper work).

**Golden rules that apply to every prompt (they're already in CLAUDE.md, but
worth knowing):** never pushes to `main`, never force-pushes, always runs
`npx tsc --noEmit` + `npm run lint` + `npm test` before committing, and flags
any new dependency before installing it. A migration means you run
`npx supabase db push` after merging; an Edge Function change means
`npx supabase functions deploy <name>`; every web change ends with `npm run deploy`.

---

## Session 1 — Stabilize & measure (do this first)

```text
You are working on Nestiq (this repo). Read CLAUDE.md, FEATURES.md, and PHASES.md
first and follow every rule in them exactly.

Mission: establish a rock-solid baseline before any new work. Do NOT add features
this session — only measure and stabilize.

Work on a branch named chore/stabilize-baseline. You have full autonomy: fix,
commit, and push to that branch yourself; only stop to ask me if you hit a
genuine product decision or something destructive.

Do all of this:
1. Run npx tsc --noEmit, npm run lint, and npm run test:coverage. Record the exact
   numbers (errors, warnings, coverage %) in a new file QUALITY_BASELINE.md.
2. List every store, screen, and Edge Function, and note which have tests and which
   don't — put this table in QUALITY_BASELINE.md.
3. Fix every TypeScript error and ESLint warning you find. Zero must remain.
4. Find the 5 riskiest untested store actions (money, auth, or data-deleting logic)
   and write tests for them following the existing __tests__/ patterns.
5. Search for silent failure points: empty catch blocks, promises without .catch,
   any-casts, and screens missing loading/error/empty states. Fix the clear-cut ones;
   list the rest in QUALITY_BASELINE.md under "Known gaps".

End by committing everything, pushing the branch, and giving me a plain-English
summary: baseline numbers, what you fixed, and the top 5 risks that remain.
```

---

## Session 2 — Release-readiness hardening

```text
You are working on Nestiq (this repo). Read CLAUDE.md and PHASES.md (Phase 7
quality gate) first and follow every rule exactly.

Mission: get the app to App-Store-submittable quality. This is the Phase 7 gate.

Branch: chore/release-readiness. Full autonomy — fix and push yourself; only stop
for destructive actions or real product decisions.

Cover all of these and check them against the Phase 7 quality gate in PHASES.md:
1. Every screen must have a loading state, an error state, and an empty state.
   Find the ones that don't and add them, matching the existing shared components.
2. Accessibility: every interactive element needs an accessibilityLabel and
   accessibilityRole; every touch target must be >= 44x44pt; check text contrast
   hits WCAG AA. Fix violations.
3. Performance: confirm every list uses FlatList (never ScrollView + map); add
   keyExtractor and sensible getItemLayout where possible; verify images have
   explicit width/height. Fix what you find.
4. Crash-proofing: wrap risky render paths, make sure the ErrorBoundary covers the
   whole app, and confirm no user input reaches Supabase without Zod validation.
5. Split any file over 300 lines that CLAUDE.md's rules would flag.

Drive the web build with Playwright to confirm the key screens still work (use the
webapp-testing skill; the browser is at /opt/pw-browsers/chromium; run expo with
EXPO_OFFLINE=1 and placeholder Supabase env vars). Run tsc + lint + tests — all green.

Commit, push, and give me a plain-English checklist of which Phase 7 gate items now
pass and which still need real-device testing that only I can do.
```

---

## Session 3 — Deep code-quality sweep

```text
You are working on Nestiq (this repo). Read CLAUDE.md first and follow every rule.

Mission: raise code quality without changing behaviour. No new features, no visible
changes — pure internal cleanup.

Branch: chore/code-quality-sweep. Full autonomy.

Do all of this:
1. Find and remove dead code: unused exports, unused files, commented-out blocks,
   and anything unreferenced. Be careful — verify each is truly unused before deleting.
2. De-duplicate: find repeated logic across stores/screens (currency formatting,
   date handling, Supabase query patterns, notification calls) and extract shared
   helpers in utils/ or hooks/, following existing conventions.
3. Consistency: make error handling, loading patterns, and store shape uniform across
   all stores (every store: isLoading, error, clearError; selectors used correctly).
4. Strengthen tests: raise coverage on the money and auth paths toward the 80% target
   in CLAUDE.md. Test behaviour, not implementation.
5. Type safety: remove every remaining `any` and `as any`; replace with proper types
   or `unknown` + narrowing.

Behaviour must be identical before and after — the full test suite is your proof.
Run tsc + lint + tests (all green), commit, push, and summarize what you cleaned up
and how much coverage moved.
```

---

## Session 4 — Ship the highest-value missing features

```text
You are working on Nestiq (this repo). Read CLAUDE.md, FEATURES.md, IDEAS.md, and
PHASES.md first and follow every rule exactly. Remember: nothing gets built unless
it's in FEATURES.md — if you want something from IDEAS.md, the rule is to propose it,
not silently build it.

Mission: ship the most valuable UNBUILT items still in FEATURES.md / the Phase 6
notification list, in priority order.

Branch: feature/backlog-highest-value. Full autonomy on anything already specified
in FEATURES.md. For anything only in IDEAS.md, or any real product decision, STOP and
ask me with a concrete recommendation.

Steps:
1. Cross-reference FEATURES.md and PHASES.md against the actual code and list every
   MUST/SHOULD item that isn't built yet. Show me that list first with your proposed
   order (highest user value + lowest risk first).
2. Then build them one at a time: each as its own commit, each with a store test
   locking in the behaviour (per CLAUDE.md), each with loading/error/empty states.
3. If a feature needs a new table, write the migration with RLS + indexes in the same
   file, and flag clearly that I'll need to run npx supabase db push.
4. Don't install any new dependency without flagging it and waiting for my yes.

Run tsc + lint + tests after each feature. Commit, push, and give me a plain-English
list of what shipped, what needs a migration/function deploy, and what you're blocked
on pending my decision.
```

---

## Session 5 — Monetization groundwork (structure only, no live billing)

```text
You are working on Nestiq (this repo). Read CLAUDE.md and PHASES.md (Phase 7 mentions
AdMob + premium IAP) first and follow every rule exactly.

Mission: build the STRUCTURE for the planned free-with-ads + premium tiers, without
wiring real payment SDKs yet (those need my accounts and store setup). Think of this
as making the app "monetization-ready".

Branch: feature/monetization-groundwork. Full autonomy on structure; STOP and ask me
before adding any paid SDK (AdMob, RevenueCat, expo-in-app-purchases) or new dependency.

Build:
1. A single source of truth for entitlements: a store/hook that exposes isPremium and
   a feature-gate helper, defaulting everyone to free for now (no real purchase yet).
2. A reusable "Premium" upsell component and a paywall/upgrade screen that reads from
   FEATURES.md/IDEAS.md for what premium unlocks (ad-free, unlimited photos, PDF
   reports, custom themes). Copy can be placeholder but real-feeling.
3. Ad-slot placeholders: a single <AdBanner/> component that renders a labelled
   placeholder for free users and nothing for premium — so real ads drop in later
   with a one-line change. Put it where banner ads would go, gated by isPremium.
4. Gate the premium-only features behind the entitlement helper so flipping isPremium
   to true actually unlocks them.
5. Write tests for the entitlement/gating logic.

Do NOT touch real billing, App Store products, or add payment SDKs — leave clear TODO
markers and a MONETIZATION.md explaining exactly what I need to set up (accounts,
products, keys) to go live. Run tsc + lint + tests, commit, push, and summarize.
```

---

## Session 6 — App Store submission prep

```text
You are working on Nestiq (this repo). Read CLAUDE.md and PHASES.md (Phase 8) first
and follow every rule exactly.

Mission: prepare everything for a real App Store submission that doesn't require
writing product features — the config, metadata, and checklist.

Branch: chore/app-store-prep. Full autonomy on files and config; STOP and ask me for
anything that needs my Apple account, real bundle ID, or paid signup.

Do this:
1. Audit app.json / app config: bundle identifier, version, build number, required
   iOS permission strings (camera, photos, notifications) with clear user-facing
   reasons, and confirm the icon + splash config points at real assets (flag if
   they're still Expo defaults — I need to supply final art).
2. Verify the privacy policy and terms screens are complete and reachable, and that
   account deletion works end-to-end (Apple requires in-app account deletion).
3. Produce a SUBMISSION_CHECKLIST.md: every Phase 8 prerequisite, what's done, and
   the exact list of things only I can do (Apple Developer account, screenshots,
   App Privacy answers, TestFlight, EAS build commands).
4. Confirm no secrets, debug logging, or console.log ship in a production build.
5. Do a final full pass: tsc + lint + full test suite + a Playwright smoke test of
   the logged-out flows.

Commit, push, and hand me a plain-English "here's what's ready and here's your
to-do list to actually submit" summary.
```

---

## After each session

- Review the pushed branch (open a PR if you want CodeRabbit's eyes on it).
- Merge with a merge commit (per CLAUDE.md), then run whatever deploy commands the
  session told you — usually `npm run deploy`, plus `npx supabase db push` and
  `npx supabase functions deploy <name>` if that session touched them.
- Start the next session fresh so Fable has clean, focused context.

## Two things only you can do (no session can)

- In the **Supabase dashboard → Authentication**: turn on leaked-password protection
  and confirm email verification is required.
- Enable **2FA** on your Supabase, Vercel, GitHub, and Apple accounts — for an app
  this size, a compromised founder account is a bigger risk than the code.
