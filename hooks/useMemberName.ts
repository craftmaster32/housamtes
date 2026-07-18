import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useHousematesStore } from '@stores/housematesStore';
import { resolveMemberName } from '@utils/housemates';

/**
 * Returns a resolver that turns a user id into a display name, aware of people
 * who have left the house. Departed members show "Name (left)"; a deleted
 * (erased) account, whose reference has been blanked, shows "Former member".
 * Use this on any screen that shows historical records (bills, settlements,
 * chat) that can outlive the person who created them.
 */
export function useMemberName(): (userId: string | null | undefined, fallback?: string) => string {
  const { t } = useTranslation();
  const housemates = useHousematesStore((s) => s.housemates);
  const formerMembers = useHousematesStore((s) => s.formerMembers);
  return useCallback(
    (userId, fallback) =>
      resolveMemberName(userId ?? '', housemates, formerMembers, {
        fallback: fallback ?? t('members.former'),
        leftLabel: t('common.left'),
      }),
    [housemates, formerMembers, t]
  );
}
