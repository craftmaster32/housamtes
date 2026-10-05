/**
 * QA — recurring-bill change history
 *
 * The audit log stores each row as it was *before* a change. These tests lock in
 * how that becomes readable "who changed what" history: the "after" side comes
 * from the next newer entry or the live row, and deletes keep what was removed.
 */
import { buildHistory } from '@utils/recurringHistory';
import type { HistoryEntry, HouseholdPayment, RecurringBill } from '@stores/recurringBillsStore';

const bill: RecurringBill = {
  id: 'b1',
  name: 'Internet',
  assignedTo: 'alice',
  frequency: 'monthly',
  typicalAmount: 80,
  icon: 'wifi-outline',
  createdAt: '2026-01-01T00:00:00Z',
};

const livePayment: HouseholdPayment = {
  id: 'p1',
  billId: 'b1',
  amount: 90,
  paidAt: '2026-09-25',
  note: '',
  coversFrom: '2026-09-01',
};

const paymentRow = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'p1',
  bill_id: 'b1',
  amount: 80,
  paid_at: '2026-09-24',
  note: null,
  split_between: [],
  covers_from: null,
  ...over,
});

const entry = (over: Partial<HistoryEntry>): HistoryEntry => ({
  id: 'a1',
  kind: 'payment_edit',
  recordId: 'p1',
  actorId: 'bob',
  at: '2026-10-01T10:00:00Z',
  oldData: paymentRow(),
  ...over,
});

describe('buildHistory', () => {
  it('compares the latest payment edit against the live payment', () => {
    const items = buildHistory([entry({})], [bill], [livePayment]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'payment_edit', actorId: 'bob', billId: 'b1' });
    expect(items[0].changes).toEqual([
      { field: 'amount', from: 80, to: 90 },
      { field: 'paidAt', from: '2026-09-24', to: '2026-09-25' },
    ]);
  });

  it('compares an older edit against the next newer entry, not the live row', () => {
    const older = entry({ id: 'a1', at: '2026-10-01T10:00:00Z', oldData: paymentRow() });
    const newer = entry({
      id: 'a2',
      at: '2026-10-02T10:00:00Z',
      actorId: 'carol',
      oldData: paymentRow({ amount: 85 }),
    });

    const items = buildHistory([older, newer], [bill], [livePayment]);

    expect(items.map((i) => i.id)).toEqual(['a2', 'a1']); // newest first
    expect(items[1].changes).toEqual([{ field: 'amount', from: 80, to: 85 }]);
    expect(items[0].changes).toEqual([
      { field: 'amount', from: 85, to: 90 },
      { field: 'paidAt', from: '2026-09-24', to: '2026-09-25' },
    ]);
  });

  it('treats an unset covered month as the payment month when comparing', () => {
    // Old row has no covers_from (implied Sept); live row says Sept explicitly — no change.
    const items = buildHistory(
      [entry({ oldData: paymentRow({ amount: 90, paid_at: '2026-09-25' }) })],
      [bill],
      [livePayment]
    );
    expect(items).toEqual([]);
  });

  it('keeps what a deleted payment was, under its bill', () => {
    const items = buildHistory(
      [entry({ kind: 'payment_delete', oldData: paymentRow({ covers_from: '2026-08-01' }) })],
      [bill],
      []
    );

    expect(items[0]).toMatchObject({
      kind: 'payment_delete',
      billId: 'b1',
      payment: { amount: 80, coversFrom: '2026-08-01' },
    });
  });

  it('shows a bill edit against the live bill and a deleted bill with its details', () => {
    const items = buildHistory(
      [
        entry({
          id: 'e1',
          kind: 'bill_edit',
          recordId: 'b1',
          oldData: { name: 'Wifi', assigned_to: 'alice', frequency: 'monthly', typical_amount: 70 },
        }),
        entry({
          id: 'd1',
          kind: 'bill_delete',
          recordId: 'b2',
          oldData: { name: 'Gas', assigned_to: 'bob', frequency: 'quarterly', typical_amount: 300 },
        }),
      ],
      [bill],
      []
    );

    const edit = items.find((i) => i.id === 'e1');
    const deleted = items.find((i) => i.id === 'd1');
    expect(edit?.changes).toEqual([
      { field: 'name', from: 'Wifi', to: 'Internet' },
      { field: 'typicalAmount', from: 70, to: 80 },
    ]);
    expect(deleted?.bill).toEqual({
      name: 'Gas',
      assignedTo: 'bob',
      frequency: 'quarterly',
      typicalAmount: 300,
    });
  });

  it('skips an edit whose row no longer exists and has no newer entry', () => {
    expect(buildHistory([entry({})], [bill], [])).toEqual([]);
  });
});
