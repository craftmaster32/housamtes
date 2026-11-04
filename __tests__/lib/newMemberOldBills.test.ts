/**
 * QA — newMemberOldBills
 *
 * Someone joining is never added to older expenses automatically. Only in a
 * brand-new house (joined within a day of it being set up) does the rest of
 * the house get one message asking whether to add them to any older expense.
 */
const mockFrom = jest.fn();
const mockNotify = jest.fn();

jest.mock('@lib/supabase', () => ({
  supabase: { from: (...a: unknown[]): unknown => mockFrom(...a) },
}));
jest.mock('@lib/errorTracking', () => ({ captureError: jest.fn() }));
jest.mock('@lib/notifyHousemates', () => ({
  notifyHousemates: (...a: unknown[]): unknown => mockNotify(...a),
}));

import { checkOldBillsForNewMember, isNewHouseJoin } from '@lib/newMemberOldBills';

/** house row, then bills count, then payments count. */
function mockHouse(createdAt: string, bills: number, payments: number): void {
  const counted = (count: number): Record<string, unknown> => {
    const chain: Record<string, unknown> = {};
    chain.select = (): unknown => chain;
    chain.eq = (): unknown => chain;
    chain.lt = (): Promise<unknown> => Promise.resolve({ count, error: null });
    return chain;
  };
  const house: Record<string, unknown> = {};
  house.select = (): unknown => house;
  house.eq = (): unknown => house;
  house.single = (): Promise<unknown> =>
    Promise.resolve({ data: { created_at: createdAt }, error: null });
  const member: Record<string, unknown> = {};
  member.select = (): unknown => member;
  member.eq = (): unknown => member;
  member.single = (): Promise<unknown> =>
    Promise.resolve({ data: { joined_at: '2026-11-05T10:00:00Z' }, error: null });
  mockFrom
    .mockReturnValueOnce(house)
    .mockReturnValueOnce(member)
    .mockReturnValueOnce(counted(bills))
    .mockReturnValueOnce(counted(payments));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFrom.mockReset();
});

describe('isNewHouseJoin', () => {
  it('counts the day it was created and the day after as a new house', () => {
    expect(isNewHouseJoin('2026-11-04', '2026-11-04')).toBe(true);
    expect(isNewHouseJoin('2026-11-04', '2026-11-05')).toBe(true);
    expect(isNewHouseJoin('2026-11-04', '2026-11-06')).toBe(false);
  });
});

describe('checkOldBillsForNewMember', () => {
  it('asks the rest of the house once when someone joins a new house with older expenses', async () => {
    mockHouse('2026-11-04T09:00:00Z', 2, 1);
    await checkOldBillsForNewMember('house-1', 'tom', 'Tom', '2026-11-05');
    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        excludeUserId: 'tom',
        copyKey: 'new_member_old_bills',
        copyParams: { name: 'Tom', count: 3 },
      })
    );
  });

  it('sends nothing when the house is not new (joining late = not part of older expenses)', async () => {
    mockHouse('2026-09-01T09:00:00Z', 5, 5);
    await checkOldBillsForNewMember('house-1', 'tom', 'Tom', '2026-11-05');
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('sends nothing when there are no older expenses', async () => {
    mockHouse('2026-11-04T09:00:00Z', 0, 0);
    await checkOldBillsForNewMember('house-1', 'tom', 'Tom', '2026-11-05');
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('never throws, so joining a house can never fail because of it', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('offline');
    });
    await expect(
      checkOldBillsForNewMember('house-1', 'tom', 'Tom', '2026-11-05')
    ).resolves.toBeUndefined();
  });
});
