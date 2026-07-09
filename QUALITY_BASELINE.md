# QUALITY_BASELINE.md — Nestiq stabilization baseline

Recorded 2026-07-09 (FABLE_PLAYBOOK Session 1 — "Stabilize & measure").
All numbers from a clean checkout of `main` (commit `d7f693d`), Node LTS, fresh `npm install`.

---

## 1. Baseline numbers (before this session's fixes)

| Check                 | Command                 | Result                                     |
| --------------------- | ----------------------- | ------------------------------------------ |
| TypeScript            | `npx tsc --noEmit`      | **0 errors**                               |
| ESLint                | `npm run lint`          | **0 errors, 0 warnings**                   |
| Tests                 | `npm run test:coverage` | **205 passed / 205, 10 suites, 0 failing** |
| Coverage (statements) | "                       | **47.26%**                                 |
| Coverage (branches)   | "                       | 41.07%                                     |
| Coverage (functions)  | "                       | 48.19%                                     |
| Coverage (lines)      | "                       | 47.66%                                     |

> ⚠️ **Coverage caveat:** the Jest config has no `collectCoverageFrom`, so these
> percentages only count files that at least one test _imports_. Untested files
> (16 stores, all screens, all components, most of `utils/` and `lib/`) are
> invisible to the number. True whole-codebase coverage is much lower.
> Recommend adding `collectCoverageFrom` in a future session so the 80% target
> in CLAUDE.md measures reality.

### After this session

| Check                 | Result                                                 |
| --------------------- | ------------------------------------------------------ |
| TypeScript            | 0 errors                                               |
| ESLint                | 0 errors, 0 warnings                                   |
| Tests                 | **233 passed / 233, 12 suites** (+28 tests, +2 suites) |
| Coverage (statements) | **54.16%** (+6.9 pts)                                  |
| authStore coverage    | **2.18% → 38.31%**                                     |

---

## 2. Inventory — what has tests and what doesn't

### Stores (25 total — 11 tested, 14 untested)

| Store                  | Tests?                  | Notes                                                             |
| ---------------------- | ----------------------- | ----------------------------------------------------------------- |
| authStore              | ✅ **new this session** | signIn/signUp/signOut/changePassword/leaveHouse/deleteAccount     |
| billsStore             | ✅                      | 86.7% stmts — best-covered money path                             |
| choresStore            | ✅                      |                                                                   |
| expenseCategoriesStore | ✅ **new this session** | remove/add/seedDefaults                                           |
| groceryStore           | ✅                      | ~52% — large store, big untested regions (lines 303–371, 484–764) |
| notificationStore      | ✅                      |                                                                   |
| parkingStore           | ✅                      | ~67% — reservation approval flow partly untested                  |
| photoStore             | ✅                      | delete/upload paths partly untested (127–193)                     |
| recurringBillsStore    | ✅                      | only 31% — generation logic mostly untested (56–223)              |
| spendingStore          | ✅                      |                                                                   |
| votingStore            | ✅                      |                                                                   |
| announcementsStore     | ❌                      |                                                                   |
| badgeStore             | ❌                      | low risk (UI badges)                                              |
| calendarSyncStore      | ❌                      | device-calendar heavy; hard to unit test                          |
| chatStore              | ❌                      | send/remove have proper error guards (verified by inspection)     |
| conditionStore         | ❌                      |                                                                   |
| drawerStore            | ❌                      | UI-only                                                           |
| eventsStore            | ❌                      |                                                                   |
| houseStore             | ❌                      | pure setters, low risk                                            |
| housematesStore        | ❌                      | updateRole/updatePermissions untested (admin actions)             |
| languageStore          | ❌                      | UI-only                                                           |
| maintenanceStore       | ❌                      |                                                                   |
| morePopupStore         | ❌                      | UI-only                                                           |
| profilePopupStore      | ❌                      | UI-only                                                           |
| settingsStore          | ❌                      | local-only preferences                                            |

### Screens (39 route files — 0 tested)

No screen/integration tests exist. All screens under `app/(auth)`, `app/(onboarding)`,
and `app/(tabs)` are untested. CLAUDE.md's target ("Integration: screens — happy path

- error case; coverage 80% on auth/bills/parking") is not met yet.

### Edge Functions (7 — 0 tested)

| Function               | Tests? | Risk                                                              |
| ---------------------- | ------ | ----------------------------------------------------------------- |
| delete-account         | ❌     | **High** — irreversible account deletion (client side now tested) |
| send-push              | ❌     | Medium — notification fan-out + preference filtering              |
| bill-due-reminder      | ❌     | Medium — money reminders                                          |
| spending-analysis      | ❌     | Medium — money math                                               |
| grocery-reminder-check | ❌     | Low                                                               |
| parking-check          | ❌     | Low                                                               |
| parking-toggle         | ❌     | Medium — shared-state race potential                              |

### Utils / lib

| File                                                                        | Tests?                                                              |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| utils/validation.ts                                                         | ✅ (partial — 22.7%)                                                |
| utils/dates.ts, storage.ts, housemates.ts, calendarWeb.ts, downloadPhoto.ts | ❌                                                                  |
| lib/notifyHousemates.ts, notifications.ts, webPush.ts, errorTracking.ts     | ❌ (all verified to swallow their own errors — non-fatal by design) |

---

## 3. Fixed this session

1. **Removed the last real `any` types** (CLAUDE.md forbids `any`):
   - `stores/authStore.ts` — `getSecureStore(): any` → typed `SecureStoreModule` interface.
   - `stores/calendarSyncStore.ts` — `EventInput = Record<string, any>` → typed from `expo-calendar`'s `Event`.
   - Removed 2 stale `eslint-disable no-explicit-any` comments (calendarSyncStore, usePersonalCalendar) that no longer suppressed anything.
2. **Silent-failure fix:** `expenseCategoriesStore.seedDefaults` ignored the upsert
   error — a failed seed silently showed an empty category list. Now throws; `load()`
   catches, reports to Sentry, and resets `isLoading`. Locked in with a regression test.
3. **28 new tests** covering the riskiest untested actions (see §4).

## 4. The 5 riskiest untested store actions — now tested

Chosen for money / auth / data-deleting impact (all were at ~2% coverage):

1. `authStore.deleteAccount` — irreversible account deletion via Edge Function.
   Tested: refuses when signed out, preserves login when server rejects, clears all state on success.
2. `authStore.signOut` — must log the user out locally even when the server call fails,
   and must unregister push tokens first. All tested.
3. `authStore.signIn` — credential/network/unverified errors sanitized to plain English
   (raw Supabase messages never reach the screen); full state population on success.
4. `authStore.changePassword` — re-authentication required, password policy enforced,
   other devices signed out. All tested.
5. `authStore.leaveHouse` + `expenseCategoriesStore.remove` — membership/data deletion:
   state cleared correctly, and deletion failures keep local state consistent.

---

## 5. Known gaps (not fixed — listed for future sessions)

- **Coverage number is inflated** — no `collectCoverageFrom` (see caveat in §1).
- **`recurringBillsStore` at 31%** — recurring bill _generation_ (the money math that
  creates next month's bills, lines 56–223) is untested. Highest-value next test target.
- **`groceryStore` lines 484–764 untested** — big block of list logic.
- **Reservation approval flow in `parkingStore`** (lines 225–317) untested.
- **No screen tests at all** — CLAUDE.md's integration-test requirement unmet.
- **No Edge Function tests** — `send-push` preference filtering and `delete-account`
  server side are the riskiest.
- **`authStore.ts` is 822 lines** (CLAUDE.md flags files >300 lines). Splitting it is
  behaviour-risky; deferred to the code-quality sweep session (Session 3).
- Screens that are static or thin on explicit loading states (verified low risk, no
  data fetching or fed by already-loaded stores): `settings/notifications`,
  `settings/members`, `more/settings`, `games`. Re-check during Session 2's
  loading/error/empty-state pass.
- Deliberate `catch { /* non-fatal */ }` blocks exist in authStore cache helpers,
  calendarSyncStore, and the push-notification libs. All verified intentional
  (best-effort side effects that must never block the main action) — not bugs,
  but they hide infra problems; Sentry breadcrumbs could be added later.

## 6. Top 5 remaining risks (plain English)

1. **Recurring bills generate money rows with almost no tests** — a bug here creates
   wrong debts every month, silently.
2. **Push delivery logic (Edge Functions) has zero tests** — Phase 6's core feature
   can regress without any signal until a real phone misses a notification.
3. **No screen tests** — a broken screen (crash, stuck spinner) ships undetected;
   only manual iPhone testing catches it today.
4. **Coverage metric doesn't measure untested files** — quality decisions made on a
   misleading number until `collectCoverageFrom` is added.
5. **822-line authStore** — every auth change touches one giant file; highest chance
   of accidental breakage in the codebase (mitigated somewhat by the new tests).
