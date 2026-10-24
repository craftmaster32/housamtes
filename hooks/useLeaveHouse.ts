import { useCallback, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { navigateToBase } from '@stores/navigationStore';
import { useAuthStore } from '@stores/authStore';
import { useBillsStore, calculateBalances } from '@stores/billsStore';
import { useHousematesStore, type Housemate } from '@stores/housematesStore';
import { useVotingStore } from '@stores/votingStore';
import { useSettingsStore } from '@stores/settingsStore';
import { Alert } from '@lib/alert';

export interface LeaveHouseState {
  showLeaveConfirm: boolean;
  showDebtModal: boolean;
  debtLabel: string;
  leaving: boolean;
  requestingVote: boolean;
  mustPickSuccessor: boolean;
  successors: Housemate[];
  successorId: string | null;
  setSuccessorId: (id: string) => void;
  startLeave: () => void;
  closeLeave: () => void;
  closeDebt: () => void;
  confirmLeave: () => Promise<void>;
  settleUp: () => void;
  requestLeaveVote: () => Promise<void>;
}

/**
 * Everything behind "Leave House": blocks leaving while you owe money (offer to
 * settle up or ask the house to vote), and makes an owner pick a new owner.
 */
export function useLeaveHouse(): LeaveHouseState {
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const myRole = useAuthStore((s) => s.role);
  const leaveHouse = useAuthStore((s) => s.leaveHouse);
  const bills = useBillsStore((s) => s.bills);
  const housemates = useHousematesStore((s) => s.housemates);
  const addProposal = useVotingStore((s) => s.addProposal);
  const currency = useSettingsStore((s) => s.currency);

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [debtAmount, setDebtAmount] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [requestingVote, setRequestingVote] = useState(false);
  const [successorId, setSuccessorId] = useState<string | null>(null);

  // leave_house can promote any remaining member (an admin first, else the
  // longest-standing member), so every fellow member is a valid successor.
  const myId = profile?.id ?? '';
  const successors = useMemo(() => housemates.filter((h) => h.id !== myId), [housemates, myId]);
  // An owner must hand the house over so it's never left without an owner.
  const mustPickSuccessor = myRole === 'owner' && successors.length > 0;

  const startLeave = useCallback((): void => {
    const balances = calculateBalances(
      bills.filter((b) => !b.settled),
      myId
    );
    const owed = balances.filter((b) => b.amount < 0).reduce((s, b) => s + Math.abs(b.amount), 0);
    if (owed > 0.01) {
      setDebtAmount(owed);
      setShowDebtModal(true);
    } else {
      setSuccessorId(null);
      setShowLeaveConfirm(true);
    }
  }, [bills, myId]);

  const confirmLeave = useCallback(async (): Promise<void> => {
    if (mustPickSuccessor && !successorId) return;
    setLeaving(true);
    try {
      await leaveHouse(successorId ?? undefined);
      setShowLeaveConfirm(false);
      router.replace('/(onboarding)/house-setup');
    } catch {
      Alert.alert(t('common.error'), t('settings.could_not_leave'));
    } finally {
      setLeaving(false);
    }
  }, [leaveHouse, t, mustPickSuccessor, successorId]);

  const debtLabel = `${currency}${debtAmount.toFixed(2)}`;

  const requestLeaveVote = useCallback(async (): Promise<void> => {
    if (!profile || !houseId) return;
    setRequestingVote(true);
    try {
      await addProposal(
        t('settings.approve_leave_title', { name: profile.name }),
        t('settings.approve_leave_body', { name: profile.name, amount: debtLabel }),
        profile.id,
        houseId
      );
      setShowDebtModal(false);
      navigateToBase('/(tabs)/voting');
    } catch {
      Alert.alert(t('common.error'), t('settings.could_not_create_vote'));
    } finally {
      setRequestingVote(false);
    }
  }, [profile, houseId, debtLabel, addProposal, t]);

  const settleUp = useCallback((): void => {
    setShowDebtModal(false);
    navigateToBase('/(tabs)/bills');
  }, []);

  const closeLeave = useCallback((): void => setShowLeaveConfirm(false), []);
  const closeDebt = useCallback((): void => setShowDebtModal(false), []);

  return {
    showLeaveConfirm,
    showDebtModal,
    debtLabel,
    leaving,
    requestingVote,
    mustPickSuccessor,
    successors,
    successorId,
    setSuccessorId,
    startLeave,
    closeLeave,
    closeDebt,
    confirmLeave,
    settleUp,
    requestLeaveVote,
  };
}
