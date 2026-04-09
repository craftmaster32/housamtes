# CLAUDE.md — Nestiq

**App:** Shared household management (bills, parking, chores, groceries, chat). 3 housemates, iPhone-first. Future: public App Store, ads + premium.
**Owner:** Non-technical — plain English always.

---

## TECH STACK — LOCKED

| Layer | Tool | Version |
|---|---|---|
| Framework | React Native + Expo | SDK 51+ |
| Routing | Expo Router | v3+ |
| Language | TypeScript | 5.x strict |
| UI | React Native Paper | v5 |
| State | Zustand | v4+ |
| Backend | Supabase | Latest JS SDK |
| Forms | React Hook Form + Zod | Latest |
| Notifications | Expo Notifications + Supabase Edge Functions | Latest |
| Icons | Expo Vector Icons (Ionicons) | Built-in |
| Dates | date-fns | v3 |
| Secure storage | expo-secure-store | Latest |
| Errors | Sentry (Expo SDK) | Latest |
| Code quality | ESLint + Prettier + Husky | Latest |

New dependency: flag before installing. **Never:** Redux, MobX, GraphQL, class components, moment.js, lodash.

---

## FOLDER STRUCTURE

```
nestiq/
├── app/
│   ├── _layout.tsx              # Root layout
│   ├── index.tsx                # Redirect to auth or tabs
│   ├── (auth)/                  # login, signup, forgot-password
│   └── (tabs)/                  # dashboard/, bills/[id], parking/, grocery/, chores/, more/
├── components/shared/           # Button, Card, EmptyState, LoadingSpinner, ErrorMessage, Avatar
├── components/{feature}/        # bills/, parking/, grocery/, chores/, chat/
├── hooks/                       # useHouse, useBills, useParking, useAuth, useRealtime
├── stores/                      # authStore, houseStore, billsStore, parkingStore
├── lib/                         # supabase.ts, notifications.ts, errorTracking.ts
├── types/                       # database.ts, navigation.ts, api.ts
├── constants/                   # colors.ts, sizes.ts, strings.ts
├── utils/                       # currency.ts, dates.ts, validation.ts
├── supabase/migrations/         # SQL — numbered YYYYMMDDHHmmss_description.sql
├── supabase/functions/          # Edge functions
├── specs/                       # BDD feature specs
└── assets/
```

- One component + one named export per file; no business logic in screens; file >300 lines → split

---

## TYPESCRIPT

```json
{
  "compilerOptions": {
    "strict": true, "noImplicitAny": true, "strictNullChecks": true,
    "noUnusedLocals": true, "noUnusedParameters": true, "baseUrl": ".",
    "paths": {
      "@/*": ["*"], "@components/*": ["components/*"], "@hooks/*": ["hooks/*"],
      "@stores/*": ["stores/*"], "@types/*": ["types/*"], "@constants/*": ["constants/*"],
      "@utils/*": ["utils/*"], "@lib/*": ["lib/*"]
    }
  }
}
```

- No `any` (use `unknown` + narrowing); explicit return types; typed `Props` interface per component
- DB rows → `types/database.ts`; API responses → `types/api.ts`
- `interface` for objects, `type` for unions; `npx tsc --noEmit` must pass before every commit

```typescript
interface BillCardProps {
  bill: Bill;
  onPress: (billId: string) => void;
  isHighlighted?: boolean;
}
export const BillCard: React.FC<BillCardProps> = ({ bill, onPress, isHighlighted = false }) => { /* ... */ };
```

---

## REACT NATIVE COMPONENTS

- Functional only; `useCallback` on all handlers; `FlatList` for all lists (never `ScrollView` + map)
- `StyleSheet.create()` outside component — no inline static styles
- Explicit `width`/`height` on images; split at >300 lines / 5+ state vars / 3+ render branches

```typescript
const styles = StyleSheet.create({ container: { padding: 16, backgroundColor: colors.white } });
```

---

## ZUSTAND STORES

```typescript
export const useBillsStore = create<BillsStore>()(
  devtools((set) => ({
    bills: [], isLoading: false, error: null,
    fetchBills: async (houseId) => { /* ... */ },
    addBill: async (bill) => { /* ... */ },
    clearError: () => set({ error: null }),
  }), { name: 'bills-store' })
);
```

- One store per domain; never import store into another store; use selectors: `useBillsStore((s) => s.bills)`
- Every store: `isLoading: boolean`, `error: string | null`; state flat (max 2 levels deep)

---

## NAVIGATION

- `<Link>` over `router.push()`; `router.replace()` for login→dashboard; dynamic routes: `[id].tsx`
- Route params typed in `types/navigation.ts`; multi-tab shared screens → `app/(shared)/`

---

## SUPABASE

**Client (`lib/supabase.ts`):**
```typescript
export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } }
);
```

**Table schema (every table):**
- `id uuid DEFAULT gen_random_uuid() PRIMARY KEY`
- `house_id uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE`
- `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`
- Names: `snake_case` plural tables; FK: `{singular}_id`; index every WHERE/RLS column

**RLS — required on every table, separate policy per operation:**
```sql
CREATE POLICY "house members can read bills" ON bills FOR SELECT
  USING (house_id IN (SELECT house_id FROM house_members WHERE user_id = auth.uid()));
CREATE INDEX idx_house_members_user_id ON house_members(user_id);
```
Test via JS SDK only (SQL editor bypasses RLS).

**Realtime — filter by `house_id`, clean up on unmount:**
```typescript
useEffect(() => {
  const ch = supabase.channel(`bills:${houseId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bills', filter: `house_id=eq.${houseId}` }, handleChange)
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}, [houseId]);
```

**Query pattern:**
```typescript
const { data, error } = await supabase.from('bills')
  .select('*, paid_by_user:users(name, avatar_color)')
  .eq('house_id', houseId).order('due_date', { ascending: true });
if (error) throw new Error(`Failed to fetch bills: ${error.message}`);
```

---

## SECURITY

- Tokens: `expo-secure-store` only (never `AsyncStorage`)
- `EXPO_PUBLIC_` prefix for client vars; service role key in Edge Functions only
- Never log tokens, passwords, user objects, or house data
- Zod-validate all user input before Supabase calls; `.env` in `.gitignore`, use `.env.example`
- AppState token refresh:
```typescript
AppState.addEventListener('change', (s) => {
  if (s === 'active') supabase.auth.startAutoRefresh(); else supabase.auth.stopAutoRefresh();
});
```

---

## ERROR HANDLING

```typescript
const fetchBills = async (houseId: string): Promise<Bill[]> => {
  try {
    const { data, error } = await supabase.from('bills').select('*').eq('house_id', houseId);
    if (error) throw error;
    return data ?? [];
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load bills';
    Sentry.captureException(err, { extra: { houseId } });
    set({ error: message });
    return [];
  }
};
```

- Every async function: try/catch; user-facing messages in plain English
- Every screen: loading + error UI; every list: empty state UI
- Sentry logs with context (houseId, userId) — never credentials

---

## ACCESSIBILITY

- Touch targets: min 44×44pt; text contrast: min 4.5:1 (WCAG AA)
```typescript
<Pressable accessible accessibilityRole="button" accessibilityLabel="Add new bill"
  accessibilityState={{ disabled: isLoading }}
  style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
  onPress={handlePress}>
```
- Images: `accessibilityLabel`; inputs: `accessibilityLabel` + `accessibilityHint`
- Test iOS VoiceOver before each phase completion

---

## MIGRATIONS

Format: `supabase/migrations/YYYYMMDDHHmmss_description.sql`
- `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` (idempotent)
- One logical change per file; include indexes + RLS in same file as table
- Never modify dashboard schema without a migration; run `npx supabase db push` before deploying

---

## CODE QUALITY

**`.eslintrc.json`:**
```json
{
  "extends": ["eslint:recommended","plugin:@typescript-eslint/recommended","plugin:react/recommended","plugin:react-hooks/recommended","plugin:react-native/all","prettier"],
  "rules": {
    "no-console": ["warn",{"allow":["warn","error"]}],
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "error",
    "react-native/no-inline-styles": "error",
    "react-native/no-unused-styles": "error",
    "react/react-in-jsx-scope": "off"
  }
}
```

**`.prettierrc.json`:** `{ "singleQuote": true, "semi": true, "printWidth": 100, "tabWidth": 2, "trailingComma": "es5", "endOfLine": "lf" }`

**Pre-commit (Husky):** TypeScript → ESLint (auto-fix) → Prettier → Jest (changed files)

---

## TESTING

- Required before marking phase complete; test behavior not implementation
- Unit: utility functions, store actions, Zod schemas
- Integration: screens (happy path + error case); coverage 80% on auth/bills/parking

```typescript
describe('BillCard', () => {
  it('shows overdue label when past due', () => {
    render(<BillCard bill={overdueBill} onPress={jest.fn()} />);
    expect(screen.getByText('Overdue')).toBeTruthy();
  });
  it('calls onPress with bill id', async () => {
    const onPress = jest.fn();
    render(<BillCard bill={mockBill} onPress={onPress} />);
    await userEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledWith(mockBill.id);
  });
});
```

---

## NEVER DO

- Modify `CLAUDE.md`, `FEATURES.md`, `PHASES.md`, `AGENTS.md` without owner approval
- Add features not in `FEATURES.md` (log in `IDEAS.md`)
- Install packages without flagging first
- Store tokens in `AsyncStorage`
- Use `any` type or leave TODO comments in commits
- Create Supabase table without RLS
- Push to remote without explicit owner instruction
- Write screens missing loading/error/empty states
- Use `console.log()` (use Sentry / `console.warn` / `console.error`)

---

## COMMANDS

```bash
npx expo start               # Dev server
npx expo run:ios             # iOS simulator
npx tsc --noEmit             # Type check (required before commit)
npm test                     # Tests
npm run test:coverage        # Coverage
npm run lint && npm run format
npx supabase db push         # Apply migrations
npx supabase db pull         # Pull from dashboard
```

---

## AGENT READ ORDER

1. `CLAUDE.md` — rules  2. `FEATURES.md` — what's built  3. `PHASES.md` — progress  4. `AGENTS.md` — your role  5. `specs/[feature].md`
