import { useTranslation } from 'react-i18next';
import { SettingsDialog, DialogButton } from './SettingsDialog';

interface SettleFirstModalProps {
  visible: boolean;
  onClose: () => void;
  /** What the user still owes, already formatted with the currency. */
  amount: string;
  requestingVote: boolean;
  onSettleUp: () => void;
  onRequestVote: () => void;
}

/** Shown instead of "Leave" while the user still owes money. */
export function SettleFirstModal({
  visible,
  onClose,
  amount,
  requestingVote,
  onSettleUp,
  onRequestVote,
}: SettleFirstModalProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <SettingsDialog
      visible={visible}
      onClose={onClose}
      title={t('settings.settle_first_title')}
      body={t('settings.settle_first_body', { amount })}
    >
      <DialogButton kind="primary" label={t('settings.settle_up')} onPress={onSettleUp} />
      <DialogButton
        kind="outline"
        label={requestingVote ? t('settings.creating_vote') : t('settings.request_vote_leave')}
        onPress={onRequestVote}
        disabled={requestingVote}
      />
      <DialogButton kind="link" label={t('common.cancel')} onPress={onClose} />
    </SettingsDialog>
  );
}
