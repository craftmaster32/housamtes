/**
 * QA — notificationStore
 *
 * BUGS PROVEN HERE (marked ⚠️):
 *  ⚠️  update() applies optimistic UI change but never rolls it back on DB failure.
 *      Users think a preference was saved when it wasn't. On next cold load
 *      the UI silently reverts to the old value — confusing and trust-breaking.
 *
 * CORRECT BEHAVIOURS VERIFIED:
 *  ✓   load() DB error → keeps whatever prefs are already in state (does not reset to defaults)
 *  ✓   load() success → merges DB row into state using sensible defaults for missing columns
 *  ✓   update() fires optimistic update immediately (before await)
 */

import { useNotificationStore } from '../../stores/notificationStore';
import { ok, fail } from '../__helpers__/supabaseMock';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockFrom = jest.fn();

jest.mock('@lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]) => mockFrom(...a),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_PREFS = {
  notifyBillAdded: true,
  notifyBillSettled: true,
  notifyBillDue: true,
  billDueDaysBefore: 2 as 1 | 2 | 3 | 7,
  notifyParkingClaimed: true,
  notifyParkingReservation: true,
  notifyChoreOverdue: true,
  notifyChatMessage: true,
};

beforeEach(() => {
  useNotificationStore.setState({ prefs: { ...DEFAULT_PREFS }, isLoading: false });
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// load
// ─────────────────────────────────────────────────────────────────────────────

describe('notificationStore — load', () => {
  it('sets isLoading=false and keeps existing prefs when DB query fails', async () => {
    // User has already customised prefs (billDueDaysBefore = 7).
    // A network blip on load must NOT wipe those preferences back to defaults.
    useNotificationStore.setState({
      prefs: { ...DEFAULT_PREFS, billDueDaysBefore: 7 },
      isLoading: false,
    });
    mockFrom.mockReturnValue(fail('connection lost'));

    await useNotificationStore.getState().load('user-1', 'house-1');

    expect(useNotificationStore.getState().isLoading).toBe(false);
    expect(useNotificationStore.getState().prefs.billDueDaysBefore).toBe(7); // preserved
  });

  it('overwrites state with DB row values on success', async () => {
    const row = {
      notify_bill_added: false,
      notify_bill_settled: true,
      notify_bill_due: false,
      bill_due_days_before: 3,
      notify_parking_claimed: false,
      notify_parking_reservation: true,
      notify_chore_overdue: false,
      notify_chat_message: true,
    };
    mockFrom.mockReturnValue(ok(row));

    await useNotificationStore.getState().load('user-1', 'house-1');

    const { prefs } = useNotificationStore.getState();
    expect(prefs.notifyBillAdded).toBe(false);
    expect(prefs.billDueDaysBefore).toBe(3);
    expect(prefs.notifyParkingClaimed).toBe(false);
  });

  it('falls back to all-true defaults when no row exists in DB (new user)', async () => {
    mockFrom.mockReturnValue(ok(null)); // maybeSingle returns null

    await useNotificationStore.getState().load('new-user', 'house-1');

    const { prefs } = useNotificationStore.getState();
    expect(prefs).toMatchObject(DEFAULT_PREFS);
  });

  it('uses default true for missing columns (partial row from old schema)', async () => {
    // Simulate a row where some columns are absent (undefined → ?? default)
    const row = {
      notify_bill_added: false,
      // all others missing — should default to true
    };
    mockFrom.mockReturnValue(ok(row));

    await useNotificationStore.getState().load('user-1', 'house-1');

    const { prefs } = useNotificationStore.getState();
    expect(prefs.notifyBillAdded).toBe(false);
    expect(prefs.notifyBillSettled).toBe(true);   // defaulted
    expect(prefs.notifyParkingClaimed).toBe(true); // defaulted
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// update
// ─────────────────────────────────────────────────────────────────────────────

describe('notificationStore — update', () => {
  it('applies the change to state immediately (optimistic)', async () => {
    // We track state synchronously mid-function using a flag
    let stateAfterSet: boolean | null = null;

    mockFrom.mockImplementation(() => {
      // At the moment the DB call is made, the optimistic update has already fired
      stateAfterSet = useNotificationStore.getState().prefs.notifyBillAdded;
      return ok();
    });

    await useNotificationStore.getState().update('user-1', 'house-1', { notifyBillAdded: false });

    expect(stateAfterSet).toBe(false); // optimistic update already applied
    expect(useNotificationStore.getState().prefs.notifyBillAdded).toBe(false);
  });

  it('silently reverts optimistic update when DB upsert fails', async () => {
    // Fix: previousPrefs captured before optimistic set; restored on error.
    // No throw (preference toggle failing silently is acceptable UX).
    useNotificationStore.setState({ prefs: { ...DEFAULT_PREFS, notifyBillAdded: true } });
    mockFrom.mockReturnValue(fail('upsert error'));

    await useNotificationStore.getState().update('user-1', 'house-1', { notifyBillAdded: false });

    // State rolled back to what it was before the failed save
    expect(useNotificationStore.getState().prefs.notifyBillAdded).toBe(true);
  });

  it('only updates the specified fields, leaves others unchanged', async () => {
    mockFrom.mockReturnValue(ok());

    await useNotificationStore.getState().update('user-1', 'house-1', { billDueDaysBefore: 7 });

    const { prefs } = useNotificationStore.getState();
    expect(prefs.billDueDaysBefore).toBe(7);
    expect(prefs.notifyBillAdded).toBe(true);    // unchanged
    expect(prefs.notifyChatMessage).toBe(true);  // unchanged
  });

  it('⚠️ BUG: rapid successive updates race — last optimistic wins in UI but DB order may differ', async () => {
    // User toggles "bill added" off then on quickly.
    // Both DB writes are in-flight simultaneously. Whichever resolves last wins on the server,
    // but the UI shows the final optimistic state regardless.
    const calls: unknown[] = [];
    mockFrom.mockImplementation(() => {
      calls.push(useNotificationStore.getState().prefs.notifyBillAdded);
      return ok();
    });

    const p1 = useNotificationStore.getState().update('user-1', 'house-1', { notifyBillAdded: false });
    const p2 = useNotificationStore.getState().update('user-1', 'house-1', { notifyBillAdded: true });
    await Promise.all([p1, p2]);

    // Final UI state matches last optimistic write (true), but server result depends on race
    expect(useNotificationStore.getState().prefs.notifyBillAdded).toBe(true);
    // Both DB writes fired — server got two requests, order undefined
    expect(calls).toHaveLength(2);
  });
});
