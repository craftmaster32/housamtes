
# SKILLS.md — Installed Agent Skills for HouseMates

Skills are expert knowledge packs loaded automatically by Claude Code.
They give the AI agent specialized rules and patterns from official sources.
All skills are installed in `.claude/skills/` and active for this project.

To reinstall all skills (e.g. after a fresh clone): run the commands in the Install section below.

---

## Installed Skills (7)

---

### 1. vercel-react-native-skills
**Source:** vercel-labs/agent-skills (23.9K GitHub stars)
**Installs:** 71,600/week — most popular React Native skill
**Security:** Safe — passes all audits (Gen Agent Trust Hub, Socket, Snyk)

**What it does for HouseMates:**
Adds rules for building performant React Native apps across 8 priority categories.
This is the core performance rulebook for all screens and components we build.

**Key rules it enforces:**
- List Performance (CRITICAL): Use FlashList instead of FlatList for large lists, proper memoization
- Animation (HIGH): Use Reanimated for GPU-accelerated animations — no janky JS animations
- Navigation (HIGH): Native stack navigators, Pressable instead of TouchableOpacity
- State optimization: Avoid unnecessary re-renders, proper selector patterns
- Image optimization: expo-image with caching, explicit dimensions
- Configuration patterns: Monorepo-ready structure

**When it activates:** Any time a component, list, or animation is being built

---

### 2. supabase-postgres-best-practices
**Source:** supabase/agent-skills (1.7K GitHub stars — official Supabase repo)
**Installs:** 50,900/week — second most popular overall
**Security:** Safe — passes all audits

**What it does for HouseMates:**
Adds Postgres and Supabase-specific rules. Critical for our database work —
every bill, parking record, and house member record goes through these patterns.

**Key rules it enforces:**
- Query Performance (CRITICAL): Proper indexing, query optimization, EXPLAIN analysis
- Connection Management (CRITICAL): Pooling strategies so the app stays fast under load
- Security & RLS (CRITICAL): Row-Level Security configuration — keeps houses' data separate
- Schema Design (HIGH): Table structure patterns, foreign keys, naming conventions
- Concurrency (MEDIUM-HIGH): How to handle multiple users updating data at the same time
- Monitoring: How to track slow queries before they become problems

**When it activates:** Any time a database migration, query, or RLS policy is being written

---

### 3. building-native-ui
**Source:** expo/skills (1.5K GitHub stars — official Expo repo)
**Installs:** 21,800/week
**Security:** Safe — passes all audits

**What it does for HouseMates:**
Adds rules for building iOS-quality UI using Expo. Makes sure our app looks and feels
like a real Apple-quality app, not a generic mobile website.

**Key rules it enforces:**
- Expo Router navigation patterns: proper tab structure, modal presentations, form sheets
- Apple Human Interface Guidelines (HIG): spacing, typography, colors that feel native
- Safe area handling: content never hidden behind notch or home indicator
- Flexbox layout best practices for iOS screens
- expo-image for optimized image loading with SF Symbols support
- Reanimated for gestures (swipe to dismiss, pull to refresh)
- CSS box shadow, backdrop effects, glass effects

**When it activates:** Any time a screen or UI component is being designed or built

---

### 4. native-data-fetching
**Source:** expo/skills (official Expo repo)
**Installs:** 16,200/week
**Security:** Safe — passes all audits (all platforms)

**What it does for HouseMates:**
Adds networking and data fetching rules specific to Expo. This covers how we
load bills, parking data, and messages from Supabase — and how we handle errors,
loading states, and offline scenarios.

**Key rules it enforces:**
- Token management: expo-secure-store for auth tokens (not AsyncStorage — that's insecure)
- Retry logic with exponential backoff: if a request fails, try again with increasing delays
- Offline-first strategies: using NetInfo to detect connection, queue operations when offline
- React Query patterns for caching and background refresh
- Environment variables: EXPO_PUBLIC_ prefix for safe client-side config
- Authentication workflows: token storage, refresh flows, session expiry handling
- Expo Router data loaders for route-level data loading

**When it activates:** Any time a Supabase query, auth flow, or data loading is implemented

---

### 5. typescript-advanced-types
**Source:** wshobson/agents (32.3K GitHub stars — highly popular community repo)
**Installs:** 18,100/week
**Security:** Safe — passes all audits

**What it does for HouseMates:**
Adds advanced TypeScript rules that prevent entire categories of bugs before they happen.
Since the owner is non-technical, we need the code to catch its own mistakes — TypeScript
strict mode with these patterns is the best tool for that.

**Key rules it enforces:**
- Generics with constraints: reusable, type-safe components (e.g. a typed list component)
- Discriminated unions: safe handling of different states (loading / success / error)
- Mapped types: transforming Supabase table types automatically
- Utility types: Partial, Required, Pick, Omit — avoiding repetitive type definitions
- Type guards: safely narrowing `unknown` types from API responses
- 10 strict best practices including: prefer `unknown` over `any`, enable strict mode, test types

**When it activates:** Any time TypeScript types, interfaces, or generics are being written

---

### 6. expo-deployment
**Source:** expo/skills (official Expo repo)
**Installs:** 12,900/week
**Security:** Safe (Gen Agent Trust Hub + Socket pass; Snyk shows Medium — due to shell commands used in deployment, not a security issue for the app itself)

**What it does for HouseMates:**
Adds rules for deploying the app to the App Store. Not needed until Phase 8,
but having it installed means the rules are ready when we get there.

**Key rules it enforces:**
- EAS Build configuration: `eas.json` setup for iOS App Store, TestFlight, Android Play Store
- CI/CD automation: automated builds and submissions
- Version management: automatic version bumping with remote tracking
- iOS-specific requirements: signing, certificates, provisioning profiles
- Build monitoring: checking build status and submission via CLI
- Platform requirements checklist before submission

**When it activates:** Phase 8 — App Store submission

---

### 7. react-native-best-practices
**Source:** callstackincubator/agent-skills (1.1K GitHub stars — Callstack, a leading React Native company)
**Installs:** 8,400/week
**Security:** Safe — passes all audits

**What it does for HouseMates:**
Adds a structured performance reference covering 27 guides across 3 categories.
Complements the Vercel skill with deeper focus on native-level optimization.

**Key rules it enforces:**
- JavaScript/React (9 guides): FPS optimization, list rendering, animations, memory management
- Native Optimization (9 guides): iOS threading models, time-to-interactive measurement
- Bundling (9 guides): Bundle analysis, tree-shaking, code splitting, size reduction
- Priority ratings: CRITICAL → HIGH → MEDIUM-HIGH → MEDIUM for each rule
- Measure-first approach: profile before optimizing, don't guess

**When it activates:** Performance audits, component optimization, Phase 7 polish work

---

## Skills NOT Installed (and Why)

| Skill | Reason Skipped |
|---|---|
| expo-tailwind-setup | We use React Native Paper, not Tailwind CSS |
| upgrading-expo | Not needed now — add when Expo SDK version needs upgrading |
| expo-dev-client | We use Expo Go for development (no custom native code needed) |
| typescript-best-practices (0xbigboss) | typescript-advanced-types covers this more thoroughly |
| vercel-react-best-practices | Focused on Next.js/web, not React Native |
| mobile-ios-design | building-native-ui already covers Apple HIG guidelines |
| mobile-android-design | iOS first — add in Phase 7+ when adding Android |

---

## Reinstall Commands

Run these from the `c:/homeapp` directory to reinstall all skills after a fresh setup:

```bash
npx skills add vercel-labs/agent-skills --skill vercel-react-native-skills --agent claude-code -y
npx skills add supabase/agent-skills --skill supabase-postgres-best-practices --agent claude-code -y
npx skills add expo/skills --skill building-native-ui --skill native-data-fetching --skill expo-deployment --agent claude-code -y
npx skills add wshobson/agents --skill typescript-advanced-types --agent claude-code -y
npx skills add callstackincubator/agent-skills --skill react-native-best-practices --agent claude-code -y
```

To check what's installed at any time:
```bash
npx skills list
```

To update all skills to latest versions:
```bash
npx skills update
```
