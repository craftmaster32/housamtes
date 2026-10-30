import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { UserAvatar } from '@components/shared/UserAvatar';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import type { Housemate } from '@stores/housematesStore';
import { mf, ms } from '@utils/responsive';
import { SettingsDialog, DialogButton } from './SettingsDialog';

interface LeaveHouseModalProps {
  visible: boolean;
  onClose: () => void;
  houseName: string;
  /** Owners must hand the house to someone before leaving. */
  mustPickSuccessor: boolean;
  successors: Housemate[];
  successorId: string | null;
  onPickSuccessor: (id: string) => void;
  leaving: boolean;
  onConfirm: () => void;
}

/** "Leave the house?" — with the new-owner choice when the owner leaves. */
export function LeaveHouseModal({
  visible,
  onClose,
  houseName,
  mustPickSuccessor,
  successors,
  successorId,
  onPickSuccessor,
  leaving,
  onConfirm,
}: LeaveHouseModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  return (
    <SettingsDialog
      visible={visible}
      onClose={onClose}
      title={t('settings.leave_house_title')}
      body={t(houseName ? 'settings.leave_house_body_named' : 'settings.leave_house_body', {
        name: houseName,
      })}
    >
      {mustPickSuccessor && (
        <View style={styles.successors} accessibilityRole="radiogroup">
          <Text style={[styles.pickLabel, { color: c.textPrimary }]}>
            {t('settings.choose_successor')}
          </Text>
          {successors.map((h) => {
            const on = successorId === h.id;
            const role =
              h.role === 'owner'
                ? t('members.owner')
                : h.role === 'admin'
                  ? t('members.admin')
                  : t('members.member');
            return (
              <Pressable
                key={h.id}
                onPress={() => onPickSuccessor(h.id)}
                style={({ pressed }) => [
                  styles.person,
                  { backgroundColor: c.surface, borderColor: on ? c.primary : 'transparent' },
                  pressed && styles.pressed,
                ]}
                accessible
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${h.name}, ${role}`}
              >
                <UserAvatar userId={h.id} size={ms(34)} />
                <Text style={[styles.name, { color: c.textPrimary }]} numberOfLines={1}>
                  {h.name}
                </Text>
                <Text style={[styles.role, { color: c.textSecondary }]}>{role}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <DialogButton
        kind="danger"
        label={leaving ? t('settings.leaving') : t('settings.yes_leave')}
        onPress={onConfirm}
        disabled={leaving || (mustPickSuccessor && !successorId)}
      />
      <DialogButton kind="link" label={t('common.cancel')} onPress={onClose} />
    </SettingsDialog>
  );
}

const styles = StyleSheet.create({
  successors: { gap: ms(8) },
  pickLabel: { fontSize: mf(13.5), ...font.bold },
  person: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(10),
    paddingHorizontal: ms(12),
    borderRadius: ms(16),
    borderWidth: 2,
  },
  name: { flex: 1, fontSize: mf(15), ...font.semibold },
  role: { fontSize: mf(13), ...font.regular },
  pressed: { opacity: 0.7 },
});
