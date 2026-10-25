import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { PageSheet } from '@components/shared/PageSheet';
import { SheetButton } from '@components/shared/SheetButton';
import { TextLink } from '@components/auth/TextLink';
import { mf, ms } from '@utils/responsive';

interface JoinConfirmSheetProps {
  visible: boolean;
  code: string;
  house: { name: string; memberCount: number } | null;
  isLoading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** "Is this your house?" — the house found by the code, as a cream key tag. */
export function JoinConfirmSheet({
  visible,
  code,
  house,
  isLoading,
  onConfirm,
  onClose,
}: JoinConfirmSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const heading = useHeadingFont('semibold');
  const hand = useHandFont();
  return (
    <PageSheet
      visible={visible}
      eyebrow={t('house_setup.join_house')}
      title={t('house_setup.confirm_join_title')}
      onClose={onClose}
    >
      <Text style={[styles.subtitle, { color: c.textSecondary }]}>
        {t('house_setup.confirm_join_subtitle', { code })}
      </Text>

      {house && (
        <View style={[styles.tag, { backgroundColor: c.paper }]}>
          <View style={[styles.hole, { backgroundColor: c.background }]} />
          <View style={styles.tagText}>
            <Text style={[styles.houseName, heading, { color: c.paperInk }]} numberOfLines={2}>
              {house.name}
            </Text>
            <Text style={[styles.members, hand, { color: c.primary }]}>
              {t('house_setup.member_count', { count: house.memberCount })}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.actions}>
        <SheetButton
          label={t('house_setup.confirm_join')}
          onPress={onConfirm}
          loading={isLoading}
          disabled={isLoading}
        />
        <TextLink muted label={t('house_setup.wrong_house')} onPress={onClose} />
      </View>
    </PageSheet>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: mf(15), ...font.regular, lineHeight: mf(22) },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(14),
    borderRadius: ms(16),
    paddingVertical: ms(18),
    paddingHorizontal: ms(18),
    marginTop: ms(16),
    transform: [{ rotate: '-1deg' }],
  },
  hole: {
    width: ms(16),
    height: ms(16),
    borderRadius: ms(8),
    borderWidth: 2.5,
    borderColor: '#A39D92',
  },
  tagText: { flex: 1, gap: ms(2) },
  houseName: { fontSize: mf(22), lineHeight: mf(28) },
  members: { fontSize: mf(19) },
  actions: { gap: ms(6), marginTop: ms(22) },
});
