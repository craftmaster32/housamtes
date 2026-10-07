import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { BILL_ICONS } from '@stores/recurringBillsStore';
import type { IoniconName } from '@/types/icons';
import { mf, ms } from '@utils/responsive';
import { useRecurringPalette } from './palette';

// icon name → i18n key, so the picker labels localize with the rest of the app.
const BILL_ICON_LABEL_KEYS: Record<string, string> = {
  'business-outline': 'bills.icon_tax',
  'flash-outline': 'bills.icon_electric',
  'water-outline': 'bills.icon_water',
  'flame-outline': 'bills.icon_gas',
  'wifi-outline': 'bills.icon_internet',
  business: 'bills.icon_building',
  'home-outline': 'bills.icon_rent',
  'receipt-outline': 'bills.icon_other',
  'thermometer-outline': 'bills.icon_heating',
  'trash-outline': 'bills.icon_waste',
};

interface BillIconPickerProps {
  value: IoniconName;
  onChange: (icon: IoniconName) => void;
}

/** Grid of bill icons with localized labels; one can be selected. */
export function BillIconPicker({ value, onChange }: BillIconPickerProps): React.JSX.Element {
  const { t } = useTranslation();
  const p = useRecurringPalette();
  return (
    <View style={styles.iconRow} accessibilityRole="radiogroup">
      {BILL_ICONS.map((ic) => {
        const selected = value === ic;
        const label = BILL_ICON_LABEL_KEYS[ic] ? t(BILL_ICON_LABEL_KEYS[ic]) : ic;
        return (
          <Pressable
            key={ic}
            style={[
              styles.iconChip,
              { backgroundColor: selected ? p.secondaryBg : p.neutralPillBg },
              selected && { borderColor: p.primary },
            ]}
            onPress={() => onChange(ic)}
            accessible
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
          >
            <Ionicons name={ic} size={20} color={selected ? p.primary : p.muted} />
            <Text style={[styles.iconLabel, { color: selected ? p.primary : p.muted }]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(8) },
  iconChip: {
    width: ms(60),
    height: ms(60),
    borderRadius: ms(12),
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(2),
  },
  iconLabel: { fontSize: mf(10), textAlign: 'center' },
});
