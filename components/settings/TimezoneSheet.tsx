import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, Modal, FlatList } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SheetHeader } from '@components/bills/recurring/SheetHeader';
import { UnderlineInput } from '@components/bills/form/UnderlineInput';
import { useThemedColors, darkColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHandFont } from '@hooks/useHandFont';
import { mf, ms } from '@utils/responsive';
import { TIMEZONES } from './timezones';

type Zone = (typeof TIMEZONES)[number];

interface TimezoneSheetProps {
  visible: boolean;
  onClose: () => void;
  current: string;
  saving: boolean;
  onSelect: (id: string) => void;
}

/** Bottom sheet to pick the house timezone, with a search on a line. */
export function TimezoneSheet({
  visible,
  onClose,
  current,
  saving,
  onSelect,
}: TimezoneSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const hand = useHandFont();
  const [query, setQuery] = useState('');
  const overlay = c === darkColors ? 'rgba(0,0,0,0.6)' : 'rgba(34,32,29,0.42)';

  const zones = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TIMEZONES;
    return TIMEZONES.filter(
      (tz) =>
        tz.label.toLowerCase().includes(q) ||
        tz.region.toLowerCase().includes(q) ||
        tz.id.toLowerCase().replace(/_/g, ' ').includes(q)
    );
  }, [query]);

  const handleClose = useCallback((): void => {
    setQuery('');
    onClose();
  }, [onClose]);

  const renderZone = useCallback(
    ({ item }: { item: Zone }): React.JSX.Element => {
      const on = item.id === current;
      return (
        <Pressable
          onPress={() => {
            if (!saving) onSelect(item.id);
          }}
          style={({ pressed }) => [
            styles.zone,
            { borderBottomColor: c.border },
            pressed && styles.pressed,
          ]}
          accessible
          accessibilityRole="radio"
          accessibilityState={{ checked: on }}
          accessibilityLabel={`${item.label}, ${item.region}`}
        >
          <View style={styles.zoneText}>
            <Text style={[styles.zoneName, { color: on ? c.primary : c.textPrimary }]}>
              {item.label}
            </Text>
            <Text style={[styles.zoneRegion, { color: c.textSecondary }]}>{item.region}</Text>
          </View>
          {on && <Ionicons name="checkmark" size={22} color={c.primary} />}
        </Pressable>
      );
    },
    [c, current, saving, onSelect]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.overlay, { backgroundColor: overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View style={[styles.sheet, { backgroundColor: c.background }]} accessibilityViewIsModal>
          <SheetHeader
            eyebrow={t('settings.timezone')}
            title={t('settings.timezone_title')}
            onClose={handleClose}
          />
          <View style={styles.top}>
            <Text style={[styles.desc, { color: c.textSecondary }]}>
              {t('settings.timezone_desc')}
            </Text>
            <UnderlineInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('settings.timezone_search')}
              accessibilityLabel={t('settings.timezone_search')}
              accessibilityHint={t('settings.timezone_search_hint')}
            />
            <Text style={[styles.count, hand, { color: c.textSecondary }]}>
              {t('settings.timezone_matches', { count: zones.length, total: TIMEZONES.length })}
            </Text>
          </View>
          <FlatList
            data={zones}
            keyExtractor={(z) => z.id}
            renderItem={renderZone}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: c.textSecondary }]}>
                {t('settings.timezone_none')}
              </Text>
            }
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
    height: '85%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  top: { paddingHorizontal: ms(20), paddingTop: ms(8), gap: ms(6) },
  desc: { fontSize: mf(14), ...font.regular, lineHeight: mf(20) },
  count: { fontSize: mf(18) },
  list: { paddingHorizontal: ms(20), paddingBottom: ms(32) },
  zone: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(10),
    borderBottomWidth: 1.5,
    paddingVertical: ms(8),
  },
  zoneText: { flex: 1 },
  zoneName: { fontSize: mf(15.5), ...font.semibold },
  zoneRegion: { fontSize: mf(13), ...font.regular, marginTop: ms(1) },
  empty: { fontSize: mf(14), ...font.regular, textAlign: 'center', paddingVertical: ms(24) },
  pressed: { opacity: 0.6 },
});
