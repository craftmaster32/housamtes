import { View, Modal, Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';

import { mf, ms } from '@utils/responsive';
interface LeaveWithoutShareModalProps {
  visible: boolean;
  draftCount: number;
  onLeave: () => void;
  onStayAndShare: () => void;
}

export function LeaveWithoutShareModal({
  visible,
  draftCount,
  onLeave,
  onStayAndShare,
}: LeaveWithoutShareModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const rtl = isRTL(language);
  const C = useThemedColors();
  const styles = makeStyles(C);
  const headingFont = useHeadingFont('semibold');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onStayAndShare}>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <Text style={[styles.title, headingFont]}>{t('grocery.share_before_leaving')}</Text>
          <Text style={styles.body}>{t('grocery.draft_unsaved_body', { count: draftCount })}</Text>

          <Pressable
            style={styles.primaryBtn}
            onPress={onStayAndShare}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('grocery.go_back_and_share')}
          >
            <Ionicons name={rtl ? 'arrow-forward' : 'arrow-back'} size={16} color="#fff" />
            <Text style={styles.primaryBtnText}>{t('grocery.stay_and_share')}</Text>
          </Pressable>

          <Pressable
            style={styles.leaveBtn}
            onPress={onLeave}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('grocery.leave_for_now')}
            accessibilityHint={t('grocery.leave_without_sharing_hint')}
          >
            <Text style={styles.leaveBtnText}>{t('grocery.leave_for_now')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(34,32,29,0.42)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: ms(24),
    },
    box: {
      width: '100%',
      maxWidth: 380,
      backgroundColor: C.background,
      borderRadius: ms(26),
      padding: ms(24),
      gap: ms(12),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: ms(8) },
      shadowOpacity: 0.15,
      shadowRadius: 24,
      elevation: 10,
    },
    title: { fontSize: mf(26), lineHeight: mf(33), color: C.textPrimary, letterSpacing: -0.4 },
    body: {
      fontSize: mf(14),
      ...font.regular,
      color: C.textSecondary,
      lineHeight: mf(21),
    },
    bodyBold: { ...font.semibold, color: C.textPrimary },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: ms(8),
      minHeight: ms(52),
      borderRadius: ms(17),
      backgroundColor: C.primary,
      marginTop: ms(4),
    },
    primaryBtnText: { fontSize: mf(15), ...font.bold, color: '#fff' },
    leaveBtn: { alignItems: 'center', paddingVertical: ms(12), minHeight: ms(44) },
    leaveBtnText: { fontSize: mf(14), ...font.semibold, color: C.danger },
  });
}
