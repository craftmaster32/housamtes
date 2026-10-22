import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { PaperTag } from '@components/bills/recurring/PaperTag';
import { CartArt } from '@components/grocery/art/CartArt';
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

// Light blue "live" tile while a housemate is out shopping. Paper-like, so the
// same colours in both themes.
const LIVE_BG = '#DDE8F7';
const LIVE_INK = '#14243D';
const LIVE_MUTED = '#3C5478';

/**
 * The shop tile next to Saved Lists: "Heading to the shop?" with a drawn cart and
 * an "I'm going" tag, your own trip in progress, or who's out shopping now.
 */
export function ShoppingRunCard({
  activeRun,
  myId,
  onOpenShop,
  onEndRun,
  onQuickBuy,
}: ShoppingRunCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const heading = useHeadingFont('semibold');
  const hand = useHandFont();

  if (activeRun && activeRun.shopperId !== myId) {
    return (
      <View style={[styles.tile, styles.live]} accessible accessibilityRole="summary">
        <View style={styles.liveLabel}>
          <View style={styles.pulse} />
          <Text style={[styles.label, { color: LIVE_MUTED }]}>
            {elapsedLabel(activeRun.startedAt, t)}
          </Text>
        </View>
        <Text style={[styles.big, heading, { color: LIVE_INK }]}>
          {t('grocery.at_store', { name: activeRun.shopperName })}
        </Text>
        <Text style={[styles.hint, hand, { color: LIVE_MUTED }]}>{t('grocery.at_store_hint')}</Text>
      </View>
    );
  }

  const isMine = !!activeRun;
  return (
    <View style={[styles.tile, { backgroundColor: c.surface }]}>
      <Text style={[styles.label, { color: c.textSecondary }]}>
        {isMine ? t('grocery.you_at_store') : t('grocery.shop_card_title')}
      </Text>
      {isMine ? (
        <Text style={[styles.meta, hand, { color: c.textSecondary }]}>
          {elapsedLabel(activeRun.startedAt, t)}
        </Text>
      ) : (
        <View style={styles.art} pointerEvents="none">
          <CartArt size={ms(64)} ink={c.textPrimary} paper={c.surface} />
        </View>
      )}
      <View style={styles.spacer} />
      <View style={styles.tagRow}>
        <PaperTag
          label={isMine ? t('grocery.shop.continue') : t('grocery.shop_card_cta')}
          urgent
          onPress={onOpenShop}
        />
      </View>
      <Pressable
        onPress={isMine ? onEndRun : onQuickBuy}
        style={({ pressed }) => [styles.link, pressed && styles.pressed]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={isMine ? t('grocery.done_shopping') : t('grocery.shop.quick_buy')}
      >
        <Text style={[styles.linkText, { color: isMine ? c.negative : c.primary }]}>
          {isMine ? t('grocery.done_shopping') : t('grocery.shop.quick_buy')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1.35,
    minHeight: ms(150),
    borderRadius: ms(22),
    paddingTop: ms(13),
    paddingHorizontal: ms(14),
    paddingBottom: ms(4),
    overflow: 'hidden',
  },
  live: { backgroundColor: LIVE_BG, paddingBottom: ms(14) },
  liveLabel: { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
  pulse: {
    width: ms(8),
    height: ms(8),
    borderRadius: ms(4),
    backgroundColor: '#2F8550',
    borderWidth: 3,
    borderColor: 'rgba(47,133,80,0.25)',
  },
  label: { fontSize: mf(13), ...font.bold },
  big: { fontSize: mf(20), lineHeight: mf(25), marginTop: ms(6) },
  hint: { fontSize: mf(17), lineHeight: mf(19), marginTop: ms(4) },
  meta: { fontSize: mf(19), marginTop: ms(2) },
  art: { alignSelf: 'flex-end', marginTop: ms(2) },
  spacer: { flex: 1 },
  tagRow: { flexDirection: 'row' },
  link: { minHeight: 36, justifyContent: 'center' },
  linkText: { fontSize: mf(13.5), ...font.semibold },
  pressed: { opacity: 0.6 },
});
