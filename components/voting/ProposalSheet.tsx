import { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useThemedColors, darkColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useVotingStore } from '@stores/votingStore';
import { getErrorMessage } from '@utils/errors';
import { SheetHeader } from '@components/bills/recurring/SheetHeader';
import { UnderlineInput } from '@components/bills/form/UnderlineInput';
import { mf, ms } from '@utils/responsive';

interface ProposalSheetProps {
  visible: boolean;
  createdBy: string;
  houseId: string;
  onClose: () => void;
}

/** Bottom sheet for a new proposal: the question and some context, on lines. */
export function ProposalSheet({
  visible,
  createdBy,
  houseId,
  onClose,
}: ProposalSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const overlay = c === darkColors ? 'rgba(0,0,0,0.6)' : 'rgba(34,32,29,0.42)';
  const addProposal = useVotingStore((s) => s.addProposal);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setTitle('');
    setDescription('');
    setSaveError('');
    setIsSaving(false);
  }, [visible]);

  const handleSave = useCallback(async (): Promise<void> => {
    if (!title.trim() || isSaving) return;
    setIsSaving(true);
    setSaveError('');
    try {
      await addProposal(title.trim(), description.trim(), createdBy, houseId);
      onClose();
    } catch (err) {
      setSaveError(getErrorMessage(err, t('voting.failed_post')));
      setIsSaving(false);
    }
  }, [title, description, createdBy, houseId, addProposal, onClose, isSaving, t]);

  const off = !title.trim() || isSaving;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={[styles.overlay, { backgroundColor: overlay }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View style={[styles.sheet, { backgroundColor: c.background }]} accessibilityViewIsModal>
          <SheetHeader
            eyebrow={t('voting.title')}
            title={t('voting.new_proposal_title')}
            onClose={onClose}
          />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            <UnderlineInput
              value={title}
              onChangeText={(v) => setTitle(v.slice(0, 100))}
              placeholder={t('voting.proposal_placeholder')}
              accessibilityLabel={t('voting.proposal_placeholder')}
              accessibilityHint={t('voting.proposal_placeholder')}
            />
            <UnderlineInput
              label={t('voting.context_label')}
              value={description}
              onChangeText={(v) => setDescription(v.slice(0, 1000))}
              placeholder={t('voting.context_placeholder')}
              multiline
              accessibilityLabel={t('voting.context_label')}
              accessibilityHint={t('voting.context_placeholder')}
            />
            {!!saveError && <Text style={[styles.error, { color: c.danger }]}>{saveError}</Text>}
            <Pressable
              style={({ pressed }) => [
                styles.submit,
                { backgroundColor: c.primary },
                (off || pressed) && styles.dim,
              ]}
              onPress={handleSave}
              disabled={off}
              accessibilityRole="button"
              accessibilityLabel={t('voting.post_proposal')}
              accessibilityState={{ disabled: off }}
            >
              <Text style={styles.submitText}>
                {isSaving ? t('voting.posting') : t('voting.post_proposal')}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: ms(26),
    borderTopRightRadius: ms(26),
    maxHeight: '92%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  body: { padding: ms(20), paddingTop: ms(8), paddingBottom: ms(36), gap: ms(20) },
  error: { fontSize: mf(13), ...font.regular },
  submit: {
    minHeight: 52,
    borderRadius: ms(17),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(16),
  },
  submitText: { fontSize: mf(16), ...font.semibold, color: '#FFFFFF' },
  dim: { opacity: 0.5 },
});
