import { useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useThemedColors, darkColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { UserAvatar } from '@components/shared/UserAvatar';
import { mf, ms } from '@utils/responsive';

export interface ShoppingRunInfo {
  shopperId: string;
  shopperName: string;
  startedAt: string;
}

export interface ShoppingRunCardProps {
  activeRun: ShoppingRunInfo | null;
  myId: string;
  onOpenShop: () => void;
  onEndRun: () => void;
  onQuickBuy: () => void;
}

export function elapsedLabel(startedAt: string, t: TFunction): string {
  const mins = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
  if (mins < 1) return t('grocery.just_started');
  if (mins < 60) return t('grocery.mins_at_store', { mins });
  return t('grocery.hours_at_store', { h: Math.floor(mins / 60), m: mins % 60 });
}

/** "Heading to the shop?" prompt, or who's out shopping right now. */
export function ShoppingRunCard({
  activeRun,
  myId,
  onOpenShop,
  onEndRun,
  onQuickBuy,
}: ShoppingRunCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const isDark = C.background === darkColors.background;
  const s = useMemo(() => makeStyles(C, isDark), [C, isDark]);

  if (activeRun && activeRun.shopperId !== myId) {
    return (
      <View style={[s.card, s.cardSoft]}>
        <UserAvatar userId={activeRun.shopperId} size={ms(44)} />
        <View style={s.copy}>
          <Text style={[s.title, s.titleDark]}>
            {t('grocery.at_store', { name: activeRun.shopperName })}
          </Text>
          <Text style={[s.body, s.bodyDark]}>
            {elapsedLabel(activeRun.startedAt, t)} · {t('grocery.at_store_hint')}
          </Text>
        </View>
      </View>
    );
  }

  const isMine = !!activeRun;
  return (
    <View style={s.card}>
      <View style={s.topRow}>
        <View style={s.iconChip}>
          <Ionicons name={isMine ? 'bag-handle' : 'cart-outline'} size={24} color="#FFFFFF" />
        </View>
        <View style={s.copy}>
          <Text style={s.title}>
            {isMine ? t('grocery.you_at_store') : t('grocery.shop_card_title')}
          </Text>
          <Text style={s.body}>
            {activeRun
              ? `${elapsedLabel(activeRun.startedAt, t)} · ${t('grocery.housemates_can_see')}`
              : t('grocery.shop_card_body')}
          </Text>
        </View>
      </View>
      <View style={s.actions}>
        <Pressable
          style={({ pressed }) => [s.btnLight, pressed && s.pressed]}
          onPress={onOpenShop}
          accessibilityRole="button"
          accessibilityLabel={isMine ? t('grocery.shop.continue') : t('grocery.im_going_shopping')}
        >
          <Text style={s.btnLightText}>
            {isMine ? t('grocery.shop.continue') : t('grocery.shop_card_cta')}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [s.btnGhost, pressed && s.pressed]}
          onPress={isMine ? onEndRun : onQuickBuy}
          accessibilityRole="button"
          accessibilityLabel={isMine ? t('grocery.done_shopping') : t('grocery.shop.quick_buy')}
        >
          {!isMine && <Ionicons name="flash-outline" size={16} color="#FFFFFF" />}
          <Text style={s.btnGhostText}>
            {isMine ? t('grocery.done_shopping') : t('grocery.shop.quick_buy')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(C: ColorTokens, isDark: boolean): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
    card: {
      backgroundColor: isDark ? C.primaryDark : C.primary,
      borderRadius: ms(24),
      padding: ms(18),
      gap: ms(14),
      marginBottom: ms(18),
    },
    cardSoft: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.successTint,
    },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: ms(14) },
    iconChip: {
      width: ms(48),
      height: ms(48),
      borderRadius: ms(16),
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: { flex: 1, gap: ms(3) },
    title: { fontSize: mf(17), ...font.bold, color: '#FFFFFF' },
    titleDark: { color: C.textPrimary },
    body: {
      fontSize: mf(13),
      ...font.regular,
      color: 'rgba(255,255,255,0.92)',
      lineHeight: mf(18),
    },
    bodyDark: { color: C.textSecondary },
    actions: { flexDirection: 'row', alignItems: 'center', gap: ms(8) },
    btnLight: {
      flex: 1,
      minHeight: ms(46),
      borderRadius: ms(23),
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: ms(16),
    },
    btnLightText: { fontSize: mf(15), ...font.bold, color: C.primaryDark },
    btnGhost: {
      minHeight: ms(46),
      borderRadius: ms(23),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: ms(6),
      paddingHorizontal: ms(16),
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.45)',
    },
    btnGhostText: { fontSize: mf(14), ...font.semibold, color: '#FFFFFF' },
    pressed: { opacity: 0.8 },
  });
}
