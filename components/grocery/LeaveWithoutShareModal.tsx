import { View, Modal, Pressable, StyleSheet } from 'react-native';
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
          <Text style={styles.title}>Share before leaving?</Text>
          <Text style={styles.body}>
            You have{' '}
            <Text style={styles.bodyBold}>{draftCount} item{draftCount === 1 ? '' : 's'}</Text>
            {' '}in your draft that your housemates cannot see yet.
            {'\n\n'}
            If you leave now, your draft will be{' '}
            <Text style={styles.bodyBold}>deleted in 24 hours</Text>
            {' '}unless you come back and share it.
          </Text>

          <Pressable
            style={styles.primaryBtn}
            onPress={onStayAndShare}
            accessibilityRole="button"
            accessibilityLabel="Go back and share"
          >
            <Ionicons name="arrow-back" size={16} color="#fff" />
            <Text style={styles.primaryBtnText}>Stay and share</Text>
          </Pressable>

          <Pressable
            style={styles.leaveBtn}
            onPress={onLeave}
            accessibilityRole="button"
            accessibilityLabel="Leave without sharing — draft saved for 24 hours"
          >
            <Text style={styles.leaveBtnText}>{'Leave for now — I\'ll share later'}</Text>
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
