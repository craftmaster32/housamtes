import { useMemo } from 'react';
import { View, StyleSheet, Pressable, Modal } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors, darkColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { MACHINE_META } from '@components/machines/meta';
import {
  useDashboardCardsStore,
  ALL_DASHBOARD_CARDS,
  type DashboardCardKey,
} from '@stores/dashboardCardsStore';
import { mf, ms } from '@utils/responsive';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export const CARD_ICON: Record<DashboardCardKey, IoniconName> = {
  groceries: 'cart-outline',
  chores: 'sparkles-outline',
  votes: 'people-outline',
  parking: 'car-outline',
  washer: MACHINE_META.washer.icon,
  dryer: MACHINE_META.dryer.icon,
  dishwasher: MACHINE_META.dishwasher.icon,
};

export const CARD_LABEL_KEY: Record<DashboardCardKey, string> = {
  groceries: 'dashboard.grocery_list',
  chores: 'dashboard.tasks_label',
  votes: 'dashboard.votes_label',
  parking: 'dashboard.parking_label',
  washer: MACHINE_META.washer.labelKey,
  dryer: MACHINE_META.dryer.labelKey,
  dishwasher: MACHINE_META.dishwasher.labelKey,
};

interface DashboardCardsSheetProps {
  visible: boolean;
  onClose: () => void;
}

/** Bottom sheet for choosing which rows show on the home screen, and which sits on top. */
export function DashboardCardsSheet({
  visible,
  onClose,
}: DashboardCardsSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const isDark = c.background === darkColors.background;
  const s = useMemo(() => makeStyles(c, isDark), [c, isDark]);
  const headingFont = useHeadingFont();
  const enabled = useDashboardCardsStore((st) => st.enabled);
  const pinned = useDashboardCardsStore((st) => st.pinned);
  const setEnabled = useDashboardCardsStore((st) => st.setEnabled);
  const setPinned = useDashboardCardsStore((st) => st.setPinned);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={s.handle} />
          <Text style={[s.title, headingFont]} accessibilityRole="header">
            {t('dashboard.manage_cards')}
          </Text>
          <Text style={s.sub}>{t('dashboard.manage_cards_sub')}</Text>
          <View style={s.grid}>
            {ALL_DASHBOARD_CARDS.map((key) => {
              const on = enabled.includes(key);
              const isPinned = pinned === key;
              return (
                <Pressable
                  key={key}
                  style={[s.tile, on ? s.tileOn : s.tileOff]}
                  onPress={() => setEnabled(key, !on)}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={t(CARD_LABEL_KEY[key])}
                >
                  <View style={s.tileHead}>
                    <Ionicons
                      name={CARD_ICON[key]}
                      size={20}
                      color={on ? c.primary : c.textTertiary}
                    />
                    <Ionicons
                      name={on ? 'checkmark-circle' : 'add-circle-outline'}
                      size={22}
                      color={on ? c.primary : c.textTertiary}
                    />
                  </View>
                  <Text style={s.tileLabel}>{t(CARD_LABEL_KEY[key])}</Text>
                  {on && (
                    <Pressable
                      style={[s.pinBtn, isPinned && s.pinBtnOn]}
                      onPress={() => setPinned(isPinned ? null : key)}
                      accessibilityRole="button"
                      accessibilityLabel={t('dashboard.pin_left')}
                      accessibilityState={{ selected: isPinned }}
                    >
                      <Ionicons
                        name={isPinned ? 'pin' : 'pin-outline'}
                        size={13}
                        color={isPinned ? c.surface : c.textSecondary}
                      />
                      <Text style={[s.pinText, isPinned && s.pinTextOn]}>
                        {isPinned ? t('dashboard.pinned') : t('dashboard.pin_left')}
                      </Text>
                    </Pressable>
                  )}
                </Pressable>
              );
            })}
          </View>
          <Pressable
            style={s.doneBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.done')}
          >
            <Text style={s.doneText}>{t('common.done')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(c: ColorTokens, isDark: boolean): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: ms(28),
      borderTopRightRadius: ms(28),
      paddingHorizontal: ms(20),
      paddingTop: ms(10),
      paddingBottom: ms(36),
    },
    handle: {
      width: ms(40),
      height: ms(5),
      borderRadius: ms(3),
      backgroundColor: c.border,
      alignSelf: 'center',
      marginBottom: ms(12),
    },
    title: { fontSize: mf(24), color: c.textPrimary, letterSpacing: -0.3 },
    sub: {
      fontSize: mf(15),
      ...font.regular,
      color: c.textSecondary,
      marginTop: ms(4),
      marginBottom: ms(16),
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: ms(10),
    },
    tile: {
      width: '48%',
      minHeight: ms(100),
      borderRadius: ms(18),
      padding: ms(14),
      justifyContent: 'space-between',
      gap: ms(8),
    },
    tileOn: { backgroundColor: c.primaryTint, borderWidth: 2, borderColor: c.primary },
    tileOff: {
      backgroundColor: isDark ? c.surfaceSecondary : c.background,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    tileHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    tileLabel: { fontSize: mf(15), ...font.semibold, color: c.textPrimary },
    pinBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(4),
      alignSelf: 'flex-start',
      minHeight: ms(30),
      paddingHorizontal: ms(10),
      borderRadius: ms(15),
      borderWidth: 1,
      borderColor: c.border,
    },
    pinBtnOn: { backgroundColor: c.textPrimary, borderColor: c.textPrimary },
    pinText: { fontSize: mf(12), ...font.semibold, color: c.textSecondary },
    pinTextOn: { color: c.surface },
    doneBtn: {
      marginTop: ms(20),
      height: ms(56),
      borderRadius: ms(28),
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneText: { fontSize: mf(17), ...font.semibold, color: '#FFFFFF' },
  });
}
