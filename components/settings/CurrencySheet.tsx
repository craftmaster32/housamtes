import { useCallback } from 'react';
import { View, StyleSheet, Pressable, Modal, FlatList } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SheetHeader } from '@components/bills/recurring/SheetHeader';
import { useThemedColors, darkColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { CURRENCIES, type CurrencyOption } from '@stores/settingsStore';
import { mf, ms } from '@utils/responsive';

interface CurrencySheetProps {
  visible: boolean;
  onClose: () => void;
  current: string;
  onSelect: (symbol: string) => void;
}

/** Bottom sheet listing the currencies, each written on a line. */
export function CurrencySheet({
  visible,
  onClose,
  current,
  onSelect,
}: CurrencySheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const heading = useHeadingFont('semibold');
  const overlay = c === darkColors ? 'rgba(0,0,0,0.6)' : 'rgba(34,32,29,0.42)';

  const renderCurrency = useCallback(
    ({ item }: { item: CurrencyOption }): React.JSX.Element => {
      const on = item.symbol === current;
      const name = item.label.split('(')[0].trim();
      return (
        <Pressable
          onPress={() => onSelect(item.symbol)}
          style={({ pressed }) => [
            styles.row,
            { borderBottomColor: c.border },
            pressed && styles.pressed,
          ]}
          accessible
          accessibilityRole="radio"
          accessibilityState={{ checked: on }}
          accessibilityLabel={name}
        >
          <Text style={[styles.glyph, heading, { color: on ? c.primary : c.textSecondary }]}>
            {item.symbol}
          </Text>
          <Text style={[styles.name, { color: on ? c.primary : c.textPrimary }]}>{name}</Text>
          {on && <Ionicons name="checkmark" size={22} color={c.primary} />}
        </Pressable>
      );
    },
    [c, current, heading, onSelect]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View style={[styles.sheet, { backgroundColor: c.background }]} accessibilityViewIsModal>
          <SheetHeader
            eyebrow={t('settings.menu_currency')}
            title={t('settings.currency_pick')}
            onClose={onClose}
          />
          <FlatList
            data={CURRENCIES}
            keyExtractor={(cur) => cur.symbol}
            renderItem={renderCurrency}
            contentContainerStyle={styles.list}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: ms(26),
    borderTopRightRadius: ms(26),
    maxHeight: '85%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  list: { paddingHorizontal: ms(20), paddingTop: ms(8), paddingBottom: ms(32) },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(12),
    borderBottomWidth: 1.5,
  },
  glyph: { width: ms(34), textAlign: 'center', fontSize: mf(20), writingDirection: 'ltr' },
  name: { flex: 1, fontSize: mf(15.5), ...font.semibold },
  pressed: { opacity: 0.6 },
});
