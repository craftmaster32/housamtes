import { resolveMemberName } from '@utils/housemates';
import type { Housemate, FormerMember } from '@stores/housematesStore';

const current: Housemate[] = [
  {
    id: 'u1',
    memberId: 'm1',
    name: 'Alice',
    color: '#111',
    role: 'owner',
    permissions: {} as Housemate['permissions'],
    joinedAt: null,
  },
];

const former: FormerMember[] = [
  { id: 'u2', name: 'Bob', color: '#222', reason: 'left', leftAt: null },
];

describe('resolveMemberName', () => {
  it('returns the plain name for a current member', () => {
    expect(resolveMemberName('u1', current, former)).toBe('Alice');
  });

  it('tags a departed member with the left label', () => {
    expect(resolveMemberName('u2', current, former, { leftLabel: 'left' })).toBe('Bob (left)');
  });

  it('falls back for an erased (unknown) user id', () => {
    expect(resolveMemberName('gone', current, former, { fallback: 'Former member' })).toBe(
      'Former member'
    );
  });

  it('treats an empty id (blanked reference) as the fallback', () => {
    expect(resolveMemberName('', current, former, { fallback: 'Former member' })).toBe(
      'Former member'
    );
  });

  it('prefers the current member even if a stale former row exists', () => {
    const staleFormer: FormerMember[] = [
      { id: 'u1', name: 'Alice (old)', color: '#333', reason: 'removed', leftAt: null },
    ];
    expect(resolveMemberName('u1', current, staleFormer, { leftLabel: 'left' })).toBe('Alice');
  });
});
