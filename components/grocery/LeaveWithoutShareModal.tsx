import { View, Modal, Pressable, StyleSheet, I18nManager } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';

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
  const C = useThemedColors();
  const styles = makeStyles(C);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onLeave}
    >
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <View style={styles.iconWrap}>
            <Ionicons name="document-text-outline" size={32} color="rgb(133,77,14)" />
          </View>
          <Text style={styles.title}>{t('grocery.share_before_leaving')}</Text>
          <Text style={styles.body}>
            {t('grocery.draft_unsaved_body', { count: draftCount })}
          </Text>

          <Pressable
            style={styles.primaryBtn}
            onPress={onStayAndShare}
            accessibilityRole="button"
            accessibilityLabel={t('grocery.go_back_and_share')}
          >
            <Ionicons name={I18nManager.isRTL ? 'arrow-forward' : 'arrow-back'} size={16} color="#fff" />
            <Text style={styles.primaryBtnText}>{t('grocery.stay_and_share')}</Text>
          </Pressable>

          <Pressable
            style={styles.leaveBtn}
            onPress={onLeave}
            accessibilityRole="button"
            accessibilityLabel={t('grocery.leave_without_sharing_hint')}
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
      flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center', alignItems: 'center', padding: 24,
    },
    box: {
      width: '100%', backgroundColor: C.surface, borderRadius: 20, padding: 24, gap: 14,
      shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15, shadowRadius: 24, elevation: 10,
    },
    iconWrap: {
      width: 60, height: 60, borderRadius: 30, alignSelf: 'center',
      backgroundColor: 'rgba(224,178,77,0.15)', justifyContent: 'center', alignItems: 'center',
    },
    title: { fontSize: 20, ...font.bold, color: C.textPrimary, textAlign: 'center', letterSpacing: -0.4 },
    body: { fontSize: 14, ...font.regular, color: C.textSecondary, textAlign: 'center', lineHeight: 21 },
    bodyBold: { ...font.semibold, color: C.textPrimary },
    primaryBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      minHeight: 50, borderRadius: 12, backgroundColor: C.primary,
    },
    primaryBtnText: { fontSize: 15, ...font.semibold, color: '#fff' },
    leaveBtn: { alignItems: 'center', paddingVertical: 10, minHeight: 44 },
    leaveBtnText: { fontSize: 14, ...font.regular, color: C.textSecondary },
  });
}
