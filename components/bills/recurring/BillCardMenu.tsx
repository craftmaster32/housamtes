import { useCallback } from 'react';
import { View, StyleSheet, Pressable, Modal } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconName } from '@/types/icons';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';
import { useRecurringPalette } from './palette';

export type BillMenuAction = 'edit' | 'changes' | 'delete';

interface BillCardMenuProps {
  visible: boolean;
  billName: string;
  onSelect: (action: BillMenuAction) => void;
  onClose: () => void;
}

const ITEMS: { action: BillMenuAction; icon: IoniconName; labelKey: string }[] = [
  { action: 'edit', icon: 'create-outline', labelKey: 'bills.recurring_menu_edit' },
  { action: 'changes', icon: 'time-outline', labelKey: 'bills.recurring_menu_changes' },
  { action: 'delete', icon: 'trash-outline', labelKey: 'bills.recurring_menu_delete' },
];

/** The ⋯ menu on a recurring bill card: edit, change history, delete. */
export function BillCardMenu({
  visible,
  billName,
  onSelect,
  onClose,
}: BillCardMenuProps): React.JSX.Element {
  const { t } = useTranslation();
  const p = useRecurringPalette();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: p.overlay }]}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View style={[styles.sheet, { backgroundColor: p.card }]} accessibilityViewIsModal>
          <Text style={[styles.title, { color: p.muted }]} numberOfLines={1}>
            {billName}
          </Text>
          {ITEMS.map((item) => (
            <MenuItem key={item.action} {...item} label={t(item.labelKey)} onSelect={onSelect} />
          ))}
          <Pressable
            style={[styles.item, styles.cancel]}
            onPress={onClose}
            accessible
            accessibilityRole="button"
          >
            <Text style={[styles.cancelText, { color: p.text }]}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

interface MenuItemProps {
  action: BillMenuAction;
  icon: IoniconName;
  label: string;
  onSelect: (action: BillMenuAction) => void;
}

/** One row of the ⋯ menu; the delete row is tinted as destructive. */
function MenuItem({ action, icon, label, onSelect }: MenuItemProps): React.JSX.Element {
  const p = useRecurringPalette();
  const handlePress = useCallback((): void => onSelect(action), [onSelect, action]);
  const color = action === 'delete' ? p.overdueText : p.text;
  return (
    <Pressable
      style={({ pressed }) => [styles.item, pressed && { backgroundColor: p.secondaryBg }]}
      onPress={handlePress}
      accessible
      accessibilityRole="menuitem"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.itemText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    borderTopLeftRadius: ms(24),
    borderTopRightRadius: ms(24),
    paddingTop: ms(16),
    paddingBottom: ms(24),
    paddingHorizontal: ms(12),
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  title: { fontSize: mf(13), ...font.medium, paddingHorizontal: ms(12), marginBottom: ms(4) },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(14),
    minHeight: ms(52),
    paddingHorizontal: ms(12),
    borderRadius: ms(12),
  },
  itemText: { fontSize: mf(16), ...font.medium },
  cancel: { justifyContent: 'center', marginTop: ms(4) },
  cancelText: { fontSize: mf(16), ...font.semibold },
});
