/**
 * Settle-up maths: payments between housemates, "settle up to a date", and the
 * overpayment check. Locks in that partial payments add up correctly and that
 * settling up to a date can never make anyone owe more or lose a credit.
 */
jest.mock('@lib/supabase', () => ({ supabase: {} }));
jest.mock('@lib/errorTracking', () => ({ captureError: jest.fn() }));

import type { Bill } from '@stores/billsStore';
import type { HouseholdPayment, RecurringBill } from '@stores/recurringBillsStore';
import { settleDebts } from '@stores/billsStore';
import { asMemberSpans, defaultSplitOn, membersOn, toMemberSpans } from '@utils/membership';
import {
  applySettlementPayments,
  computeHouseNet,
  maxOwedBetween,
  fullySettledUntil,
  isSafeToRecord,
  pairwiseDebts,
  recurringShareUpTo,
  planSettleUpTo,
  type HouseMoney,
  type NetBalances,
  type SettlementPayment,
  type Transfer,
} from '@utils/settleUp';

const MAYA = 'maya';
const DANA = 'dana';
const TOM = 'tom';
const MEMBERS = [MAYA, DANA, TOM];

const bill = (id: string, amount: number, date: string, overrides: Partial<Bill> = {}): Bill => ({
  id,
  title: id,
  amount,
  paidBy: MAYA,
  splitBetween: MEMBERS,
  splitAmounts: null,
  splitType: 'equal',
  category: 'other',
  date,
  createdAt: `${date}T10:00:00Z`,
  settled: false,
  settledBy: null,
  settledAt: null,
  notes: null,
  receiptUrl: null,
  ...overrides,
});

const rent: RecurringBill = {
  id: 'rent',
  name: 'Rent',
  assignedTo: MAYA,
  frequency: 'monthly',
  typicalAmount: 900,
  icon: 'business-outline',
  createdAt: '2026-01-01T00:00:00Z',
};

const rentPayment = (id: string, paidAt: string): HouseholdPayment => ({
  id,
  billId: 'rent',
  amount: 900,
  paidAt,
  note: '',
  paidBy: MAYA,
});

let seq = 0;
const paid = (
  from: string,
  to: string,
  amount: number,
  paidOn = '2026-11-02'
): SettlementPayment => ({
  id: `s${++seq}`,
  from,
  to,
  amount,
  paidOn,
  coversUntil: null,
  note: null,
  createdBy: from,
  createdAt: `${paidOn}T10:00:00Z`,
  updatedAt: `${paidOn}T10:00:00Z`,
});

const money = (overrides: Partial<HouseMoney> = {}): HouseMoney => ({
  bills: [],
  householdBills: [rent],
  householdPayments: [],
  members: asMemberSpans(MEMBERS),
  settlementPayments: [],
  ...overrides,
});

const round = (n: number | undefined): number => Math.round((n ?? 0) * 100) / 100;
const sum = (net: NetBalances): number => round([...net.values()].reduce((a, b) => a + b, 0));

/** Records a plan the way the app does: as settle-up payments. */
const record = (m: HouseMoney, plan: Transfer[]): HouseMoney => ({
  ...m,
  settlementPayments: [
    ...m.settlementPayments,
    ...plan.map((t) => paid(t.from, t.to, t.amount, '2026-11-04')),
  ],
});

describe('applySettlementPayments', () => {
  it('lowers the payer’s debt and the receiver’s credit by the same amount', () => {
    const net = new Map([
      [MAYA, 600],
      [DANA, -300],
      [TOM, -300],
    ]);
    const after = applySettlementPayments(net, [paid(DANA, MAYA, 300)]);
    expect(after.get(DANA)).toBe(0);
    expect(after.get(MAYA)).toBe(300);
    expect(after.get(TOM)).toBe(-300);
    expect(sum(after)).toBe(0);
  });

  it('adds up several partial payments correctly', () => {
    const net = new Map([
      [MAYA, 300],
      [DANA, -300],
    ]);
    const after = applySettlementPayments(net, [
      paid(DANA, MAYA, 100),
      paid(DANA, MAYA, 50.5),
      paid(DANA, MAYA, 49.5),
    ]);
    expect(round(after.get(DANA))).toBe(-100);
    expect(round(after.get(MAYA))).toBe(100);
  });

  it('does not change the map it was given', () => {
    const net = new Map([[DANA, -300]]);
    applySettlementPayments(net, [paid(DANA, MAYA, 100)]);
    expect(net.get(DANA)).toBe(-300);
  });
});

describe('computeHouseNet', () => {
  it('combines one-off bills, recurring payments and settle-up payments', () => {
    const m = money({
      bills: [bill('pizza', 90, '2026-10-10')], // Dana & Tom owe Maya 30 each
      householdPayments: [rentPayment('oct', '2026-10-01')], // 300 each
      settlementPayments: [paid(DANA, MAYA, 100)],
    });
    const net = computeHouseNet(m);
    expect(round(net.get(DANA))).toBe(-230);
    expect(round(net.get(TOM))).toBe(-330);
    expect(round(net.get(MAYA))).toBe(560);
    expect(sum(net)).toBe(0);
  });

  it('ignores one-off bills already marked as settled', () => {
    const m = money({ bills: [bill('old', 90, '2026-10-10', { settled: true })] });
    expect(sum(computeHouseNet(m))).toBe(0);
    expect(computeHouseNet(m).get(DANA) ?? 0).toBe(0);
  });

  it('with a date, only counts expenses on or before it', () => {
    const m = money({
      bills: [bill('oct', 90, '2026-10-31'), bill('nov', 300, '2026-11-01')],
      householdPayments: [rentPayment('oct', '2026-10-01'), rentPayment('nov', '2026-11-01')],
    });
    const upToOct = computeHouseNet(m, '2026-10-31');
    expect(round(upToOct.get(DANA))).toBe(-330); // 30 pizza + 300 rent
  });
});

describe('planSettleUpTo — Maya’s case', () => {
  // Rent paid by Maya in October and November; housemates paid her for
  // October outside the app, then a month went by.
  const m = money({
    householdPayments: [rentPayment('oct', '2026-10-01'), rentPayment('nov', '2026-11-01')],
  });

  it('shows two months owed before settling', () => {
    expect(round(computeHouseNet(m).get(DANA))).toBe(-600);
  });

  it('records only October, leaving November open', () => {
    const plan = planSettleUpTo(computeHouseNet(m), pairwiseDebts(m, '2026-10-31'));
    expect(plan).toEqual(
      expect.arrayContaining([
        { from: DANA, to: MAYA, amount: 300 },
        { from: TOM, to: MAYA, amount: 300 },
      ])
    );
    expect(plan).toHaveLength(2);

    const after = computeHouseNet(record(m, plan));
    expect(round(after.get(DANA))).toBe(-300);
    expect(round(after.get(TOM))).toBe(-300);
    expect(round(after.get(MAYA))).toBe(600);
  });

  it('settling again for the same date records nothing (no double counting)', () => {
    const once = record(m, planSettleUpTo(computeHouseNet(m), pairwiseDebts(m, '2026-10-31')));
    const again = planSettleUpTo(computeHouseNet(once), pairwiseDebts(once, '2026-10-31'));
    expect(again).toEqual([]);
  });

  it('counts a partial payment already recorded and only asks for the rest', () => {
    const withPartial = money({ ...m, settlementPayments: [paid(DANA, MAYA, 200)] });
    const plan = planSettleUpTo(
      computeHouseNet(withPartial),
      pairwiseDebts(withPartial, '2026-10-31')
    );
    expect(plan).toContainEqual({ from: DANA, to: MAYA, amount: 100 });
    const after = computeHouseNet(record(withPartial, plan));
    expect(round(after.get(DANA))).toBe(-300); // exactly November
  });

  it('never wipes out a credit: someone who paid extra keeps it', () => {
    // Dana already paid 500: October (300) plus 200 towards November.
    const prepaid = money({ ...m, settlementPayments: [paid(DANA, MAYA, 500)] });
    const plan = planSettleUpTo(computeHouseNet(prepaid), pairwiseDebts(prepaid, '2026-10-31'));
    expect(plan.find((x) => x.from === DANA || x.to === DANA)).toBeUndefined();
    const after = computeHouseNet(record(prepaid, plan));
    expect(round(after.get(DANA))).toBe(-100); // still owes only the rest of November
  });

  it('settling up to today clears everything', () => {
    const plan = planSettleUpTo(computeHouseNet(m), pairwiseDebts(m, '2026-11-04'));
    const after = computeHouseNet(record(m, plan));
    for (const id of MEMBERS) expect(round(after.get(id))).toBe(0);
  });
});

describe('planSettleUpTo — safety', () => {
  it('never makes anyone owe more or flips a balance, across many random houses', () => {
    let s = 42;
    const rand = (): number => {
      s = (s * 1103515245 + 12345) % 2147483648;
      return s / 2147483648;
    };
    const pick = (): string => MEMBERS[Math.floor(rand() * MEMBERS.length)];
    for (let run = 0; run < 300; run++) {
      const bills = Array.from({ length: 6 }, (_, i) =>
        bill(
          `b${i}`,
          Math.round(rand() * 50000) / 100,
          rand() < 0.5 ? '2026-10-15' : '2026-11-02',
          {
            paidBy: pick(),
          }
        )
      );
      const settlementPayments = Array.from({ length: 3 }, () => {
        const from = pick();
        const to = MEMBERS.find((x) => x !== from) as string;
        return paid(from, to, Math.round(rand() * 30000) / 100);
      });
      const m = money({ bills, settlementPayments });
      const before = computeHouseNet(m);
      const plan = planSettleUpTo(before, pairwiseDebts(m, '2026-10-31'));
      const after = computeHouseNet(record(m, plan));
      expect(Math.abs(sum(after))).toBeLessThanOrEqual(0.02);
      for (const id of MEMBERS) {
        const b = before.get(id) ?? 0;
        const a = after.get(id) ?? 0;
        expect(Math.abs(a)).toBeLessThanOrEqual(Math.abs(b) + 0.01);
        if (Math.abs(a) > 0.01 && Math.abs(b) > 0.01) expect(Math.sign(a)).toBe(Math.sign(b));
      }
      for (const t of plan) expect(t.amount).toBeGreaterThan(0);
    }
  });
});

describe('3+ person houses', () => {
  const internet: RecurringBill = { ...rent, id: 'net', name: 'Internet', assignedTo: TOM };
  const m = money({
    householdBills: [rent, internet],
    householdPayments: [
      rentPayment('oct', '2026-10-01'),
      { id: 'i', billId: 'net', amount: 90, paidAt: '2026-10-03', note: '', paidBy: TOM },
    ],
  });

  it('settle up to a date follows who fronted the money (no made-up routes)', () => {
    const plan = planSettleUpTo(computeHouseNet(m), pairwiseDebts(m, '2026-10-31'));
    // Rent: Dana & Tom owe Maya 300. Internet: Dana & Maya owe Tom 30.
    expect(plan).toEqual(
      expect.arrayContaining([
        { from: DANA, to: MAYA, amount: 300 },
        { from: TOM, to: MAYA, amount: 270 }, // 300 rent − 30 internet, netted per pair
        { from: DANA, to: TOM, amount: 30 },
      ])
    );
    expect(plan).toHaveLength(3);
    const after = computeHouseNet(record(m, plan));
    for (const id of MEMBERS) expect(round(after.get(id))).toBe(0);
  });

  it('per person, the pair-by-pair debts always add up to the same balances', () => {
    const net = computeHouseNet(m);
    const fromPairs = new Map<string, number>();
    for (const t of pairwiseDebts(m)) {
      fromPairs.set(t.from, (fromPairs.get(t.from) ?? 0) - t.amount);
      fromPairs.set(t.to, (fromPairs.get(t.to) ?? 0) + t.amount);
    }
    for (const id of MEMBERS) expect(round(fromPairs.get(id))).toBe(round(net.get(id)));
  });

  it('after one person pays, the whole plan is recalculated for everyone else', () => {
    const SAM = 'sam';
    const four = money({
      members: asMemberSpans([...MEMBERS, SAM]),
      bills: [
        bill('trip', 400, '2026-10-10', { splitBetween: [...MEMBERS, SAM] }), // Maya paid
        bill('food', 200, '2026-10-12', { paidBy: SAM, splitBetween: [...MEMBERS, SAM] }),
      ],
      householdBills: [],
    });
    const before = settleDebts(computeHouseNet(four));
    const first = before[0];
    const afterOne = computeHouseNet(record(four, [first]));
    const replan = settleDebts(new Map(afterOne));
    // The paid transfer is gone and the rest still clears everyone exactly.
    expect(replan).not.toContainEqual(first);
    const done = computeHouseNet(record(record(four, [first]), replan));
    for (const id of [...MEMBERS, SAM]) expect(round(done.get(id))).toBe(0);
  });
});

describe('maxOwedBetween', () => {
  const net = new Map([
    [MAYA, 600],
    [DANA, -300],
    [TOM, -300],
  ]);

  it('is what the payer owes when the receiver is owed at least that', () => {
    expect(maxOwedBetween(net, DANA, MAYA)).toBe(300);
  });

  it('is 0 when the payer owes nothing', () => {
    expect(maxOwedBetween(net, MAYA, DANA)).toBe(0);
  });

  it('is 0 when the receiver is not owed anything', () => {
    expect(maxOwedBetween(net, DANA, TOM)).toBe(0);
  });
});

describe('"split with everyone" means everyone there on the day', () => {
  // Maya & Dana from the start; Tom joined on 1 Nov; Sam lived there and left on 20 Oct.
  const spans = toMemberSpans(
    [
      { id: MAYA, joinedAt: '2026-09-01T09:00:00Z' },
      { id: DANA, joinedAt: '2026-09-01T09:05:00Z' },
      { id: TOM, joinedAt: '2026-11-01T18:00:00Z' },
    ],
    [{ id: 'sam', leftAt: '2026-10-20T10:00:00Z' }]
  );
  const legacy = (id: string, paidAt: string): HouseholdPayment => ({
    id,
    billId: 'rent',
    amount: 900,
    paidAt,
    note: '',
    paidBy: MAYA,
    // no splitBetween = "everyone"
  });

  it('knows who lived there on each day', () => {
    expect(membersOn(spans, '2026-10-05').sort()).toEqual([DANA, MAYA, 'sam'].sort());
    expect(membersOn(spans, '2026-10-25').sort()).toEqual([DANA, MAYA].sort());
    expect(membersOn(spans, '2026-11-01').sort()).toEqual([DANA, MAYA, TOM].sort());
  });

  it('never crashes on a missing join or leave date (treated as unknown)', () => {
    const odd = [
      { id: MAYA, joinedAt: undefined as unknown as null, leftAt: undefined as unknown as null },
      { id: DANA, joinedAt: '2026-09-01T00:00:00Z', leftAt: null },
    ];
    expect(membersOn(odd, '2026-10-01').sort()).toEqual([DANA, MAYA].sort());
  });

  it('treats an expense dated before the house started in the app as day one', () => {
    // Day one = 1 Sep: Maya, Dana and Sam (who left later) — not Tom.
    expect(membersOn(spans, '2026-08-01').sort()).toEqual([DANA, MAYA, 'sam'].sort());
  });

  it('never charges someone who joined later for older rent', () => {
    const m = money({ members: spans, householdPayments: [legacy('oct', '2026-10-25')] });
    const net = computeHouseNet(m);
    expect(net.get(TOM) ?? 0).toBe(0);
    expect(round(net.get(DANA))).toBe(-450); // split between the 2 who were there
  });

  it('still charges someone who has since left for their time there', () => {
    const m = money({ members: spans, householdPayments: [legacy('early-oct', '2026-10-05')] });
    expect(round(computeHouseNet(m).get('sam'))).toBe(-300);
  });

  it('includes a new housemate from the day they joined, like everyone else', () => {
    const m = money({ members: spans, householdPayments: [legacy('nov', '2026-11-01')] });
    expect(round(computeHouseNet(m).get(TOM))).toBe(-300);
  });

  it('an explicit split always wins over join dates', () => {
    const m = money({
      members: spans,
      householdPayments: [{ ...legacy('x', '2026-10-25'), splitBetween: [MAYA, TOM] }],
    });
    expect(round(computeHouseNet(m).get(TOM))).toBe(-450);
  });

  it('forms pre-tick only the people who lived there on the chosen date', () => {
    const shown = [MAYA, DANA, TOM];
    expect(defaultSplitOn(spans, shown, '2026-10-25').sort()).toEqual([DANA, MAYA].sort());
    expect(defaultSplitOn(spans, shown, '2026-11-02').sort()).toEqual([DANA, MAYA, TOM].sort());
    // Never leaves a form with nobody ticked.
    expect(defaultSplitOn(spans, [TOM], '2026-10-25')).toEqual([TOM]);
  });

  it('pair-by-pair debts use the same rule', () => {
    const m = money({ members: spans, householdPayments: [legacy('oct', '2026-10-25')] });
    expect(pairwiseDebts(m)).toEqual([{ from: DANA, to: MAYA, amount: 450 }]);
  });
});

describe('settle up to a date counts recurring bills by the months they pay for', () => {
  const pay = (
    id: string,
    paidAt: string,
    extra: Partial<HouseholdPayment> = {}
  ): HouseholdPayment => ({
    id,
    billId: 'rent',
    amount: 900,
    paidAt,
    note: '',
    paidBy: MAYA,
    splitBetween: MEMBERS,
    ...extra,
  });

  it('November rent paid early (28 Oct) is NOT part of "up to 31 Oct"', () => {
    const p = pay('nov-early', '2026-10-28', { coverageStart: '2026-11-01', coverageMonths: 1 });
    expect(recurringShareUpTo(p, rent, '2026-10-31')).toBe(0);
    expect(recurringShareUpTo(p, rent, '2026-11-30')).toBe(1);
  });

  it('October rent paid late (2 Nov) IS part of "up to 31 Oct"', () => {
    const p = pay('oct-late', '2026-11-02', { coverageStart: '2026-10-01', coverageMonths: 1 });
    expect(recurringShareUpTo(p, rent, '2026-10-31')).toBe(1);
  });

  it('a 2-month bill (Oct–Nov) counts half up to 31 Oct', () => {
    const p = pay('bi', '2026-10-05', { coverageStart: '2026-10-01', coverageMonths: 2 });
    expect(recurringShareUpTo(p, rent, '2026-10-31')).toBe(0.5);
  });

  it('a month counts in full once it has started', () => {
    const p = pay('oct', '2026-10-01', { coverageStart: '2026-10-01', coverageMonths: 1 });
    expect(recurringShareUpTo(p, rent, '2026-10-01')).toBe(1);
    expect(recurringShareUpTo(p, rent, '2026-10-15')).toBe(1);
    expect(recurringShareUpTo(p, rent, '2026-09-30')).toBe(0);
  });

  it('older payments without months use the bill frequency, counted back from the paid month', () => {
    const bimonthly: RecurringBill = { ...rent, frequency: 'bimonthly' };
    const p = pay('old', '2026-10-10'); // no coverage saved → Sep–Oct
    expect(recurringShareUpTo(p, bimonthly, '2026-09-30')).toBe(0.5);
    expect(recurringShareUpTo(p, bimonthly, '2026-10-31')).toBe(1);
  });

  it('end to end: only the October half of a 2-month bill is settled', () => {
    const m = money({
      householdPayments: [
        pay('bi', '2026-10-05', { coverageStart: '2026-10-01', coverageMonths: 2 }),
      ],
    });
    const plan = planSettleUpTo(computeHouseNet(m), pairwiseDebts(m, '2026-10-31'));
    expect(plan).toEqual(
      expect.arrayContaining([
        { from: DANA, to: MAYA, amount: 150 },
        { from: TOM, to: MAYA, amount: 150 },
      ])
    );
    const after = computeHouseNet(record(m, plan));
    expect(round(after.get(DANA))).toBe(-150); // November half still open
  });
});

describe("Maya's real case: two months in the app, September paid outside it", () => {
  // Maya pays rent for September and October (₪900, split by 3), and a
  // ₪90 internet bill each month that Tom pays. Dana & Tom paid Maya for
  // September by bank transfer, never recorded. Today is 4 November.
  const internet: RecurringBill = { ...rent, id: 'net', name: 'Internet', assignedTo: TOM };
  const monthOf = (
    id: string,
    billId: string,
    start: string,
    payer: string,
    amount: number
  ): HouseholdPayment => ({
    id,
    billId,
    amount,
    paidAt: start,
    note: '',
    paidBy: payer,
    splitBetween: MEMBERS,
    coverageStart: start,
    coverageMonths: 1,
  });
  const m = money({
    householdBills: [rent, internet],
    householdPayments: [
      monthOf('rent-sep', 'rent', '2026-09-01', MAYA, 900),
      monthOf('rent-oct', 'rent', '2026-10-01', MAYA, 900),
      // October rent's partner: internet paid a few days into each month.
      { ...monthOf('net-sep', 'net', '2026-09-01', TOM, 90), paidAt: '2026-09-05' },
      { ...monthOf('net-oct', 'net', '2026-10-01', TOM, 90), paidAt: '2026-10-05' },
    ],
    bills: [
      bill('groceries-sep', 120, '2026-09-20'), // Maya paid, split 3
      bill('groceries-oct', 60, '2026-10-12'),
    ],
  });

  it('before: both months are counted', () => {
    // Dana owes Maya 300+300 rent + 40+20 groceries, and Tom 30+30 internet = 720
    expect(round(computeHouseNet(m).get(DANA))).toBe(-720);
  });

  it('"settled up to 30 Sept" leaves exactly October open', () => {
    const plan = planSettleUpTo(computeHouseNet(m), pairwiseDebts(m, '2026-09-30'));
    const after = computeHouseNet(record(m, plan));
    // October only: rent 300 + groceries 20 to Maya, internet 30 to Tom.
    expect(round(after.get(DANA))).toBe(-350);
    expect(round(after.get(TOM))).toBe(-260); // 300 + 20 to Maya − 60 from Maya & Dana
    expect(round(after.get(MAYA))).toBe(610);
  });

  it('picking 1 October by mistake would also settle October rent — the screen must say so', () => {
    const plan = planSettleUpTo(computeHouseNet(m), pairwiseDebts(m, '2026-10-01'));
    const after = computeHouseNet(record(m, plan));
    expect(round(after.get(DANA))).not.toBe(-350);
  });
});

describe('only part of a plan can be recorded (3+ people)', () => {
  // Dana owes Tom 100 and Tom owes Maya 100: Tom is square overall.
  const net = new Map([
    [DANA, -100],
    [TOM, 0],
    [MAYA, 100],
  ]);
  const debts: Transfer[] = [
    { from: DANA, to: TOM, amount: 100 },
    { from: TOM, to: MAYA, amount: 100 },
  ];

  it('the full plan is safe', () => {
    expect(isSafeToRecord(net, planSettleUpTo(net, debts))).toBe(true);
  });

  it('recording only Dana → Tom is NOT safe on its own (Tom would look like he owes)', () => {
    expect(isSafeToRecord(net, [{ from: DANA, to: TOM, amount: 100 }])).toBe(false);
  });

  it('the direct route skips the middle person: Dana pays Maya', () => {
    const direct = planSettleUpTo(net, debts, { direct: true });
    expect(direct).toEqual([{ from: DANA, to: MAYA, amount: 100 }]);
    expect(isSafeToRecord(net, direct)).toBe(true);
  });
});

describe('fullySettledUntil — "Settled" only when a period is really fully paid', () => {
  const m = money({
    householdPayments: [rentPayment('oct', '2026-10-01'), rentPayment('nov', '2026-11-01')],
  });
  const settle = (from: string, amount: number): SettlementPayment => ({
    ...paid(from, MAYA, amount, '2026-11-04'),
    coversUntil: '2026-10-31',
  });

  it('nothing settled yet → no settled period', () => {
    expect(fullySettledUntil(m, computeHouseNet(m))).toBeNull();
  });

  it('only Dana recorded her part of October → October is NOT shown as settled', () => {
    const partly = money({ ...m, settlementPayments: [settle(DANA, 300)] });
    expect(fullySettledUntil(partly, computeHouseNet(partly))).toBeNull();
  });

  it('Dana and Tom both recorded October → October is settled', () => {
    const fully = money({ ...m, settlementPayments: [settle(DANA, 300), settle(TOM, 300)] });
    expect(fullySettledUntil(fully, computeHouseNet(fully))).toBe('2026-10-31');
  });
});

describe('settling up to the middle of a month', () => {
  // October: rent (Maya, ₪900, Oct 1–31), groceries on 10 Oct (₪90) and on 20 Oct (₪60).
  const m = money({
    householdPayments: [
      {
        id: 'rent-oct',
        billId: 'rent',
        amount: 900,
        paidAt: '2026-10-01',
        note: '',
        paidBy: MAYA,
        splitBetween: MEMBERS,
        coverageStart: '2026-10-01',
        coverageMonths: 1,
      },
    ],
    bills: [bill('g10', 90, '2026-10-10'), bill('g20', 60, '2026-10-20')],
  });

  it('up to 15 Oct: October rent counts in full (its month has started), only the 10 Oct bill', () => {
    const plan = planSettleUpTo(computeHouseNet(m), pairwiseDebts(m, '2026-10-15'));
    expect(plan).toContainEqual({ from: DANA, to: MAYA, amount: 330 }); // 300 rent + 30
    const after = computeHouseNet(record(m, plan));
    expect(round(after.get(DANA))).toBe(-20); // only the 20 Oct bill is left
  });

  it('then up to 31 Oct adds only what came after the 15th — nothing counted twice', () => {
    const mid = record(m, planSettleUpTo(computeHouseNet(m), pairwiseDebts(m, '2026-10-15')));
    const plan = planSettleUpTo(computeHouseNet(mid), pairwiseDebts(mid, '2026-10-31'));
    expect(plan).toContainEqual({ from: DANA, to: MAYA, amount: 20 });
    const after = computeHouseNet(record(mid, plan));
    for (const id of MEMBERS) expect(round(after.get(id))).toBe(0);
  });
});

describe('amounts that don’t split evenly (₪200 between 3)', () => {
  // Maya and Tom each pay a ₪200 bill split three ways: shares of ₪66.666…
  const m = money({
    householdBills: [rent, { ...rent, id: 'net', assignedTo: TOM }],
    householdPayments: [
      {
        id: 'a',
        billId: 'rent',
        amount: 200,
        paidAt: '2026-10-01',
        note: '',
        paidBy: MAYA,
        splitBetween: MEMBERS,
        coverageStart: '2026-10-01',
        coverageMonths: 1,
      },
      {
        id: 'b',
        billId: 'net',
        amount: 200,
        paidAt: '2026-10-02',
        note: '',
        paidBy: TOM,
        splitBetween: MEMBERS,
        coverageStart: '2026-10-01',
        coverageMonths: 1,
      },
    ],
  });

  it('each person’s own part can still be recorded (rounding isn’t "unsafe")', () => {
    const net = computeHouseNet(m);
    const plan = planSettleUpTo(net, pairwiseDebts(m, '2026-10-31'));
    for (const me of MEMBERS) {
      const mine = plan.filter((t) => t.from === me || t.to === me);
      expect(isSafeToRecord(net, mine)).toBe(true);
    }
    const after = computeHouseNet(record(m, plan));
    for (const id of MEMBERS) expect(Math.abs(after.get(id) ?? 0)).toBeLessThan(0.02);
  });
});
