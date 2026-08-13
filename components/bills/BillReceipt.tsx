import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable, Image, Modal, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { signHousePhotoUrl } from '@stores/photoStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';

interface BillReceiptProps {
  receiptUrl: string;
}

export const BillReceipt: React.FC<BillReceiptProps> = ({ receiptUrl }) => {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  useEffect((): (() => void) => {
    let cancelled = false;
    signHousePhotoUrl(receiptUrl)
      .then((url) => {
        if (cancelled) return;
        if (url) setSignedUrl(url);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return (): void => {
      cancelled = true;
    };
  }, [receiptUrl]);

  const openZoom = useCallback((): void => setZoomed(true), []);
  const closeZoom = useCallback((): void => setZoomed(false), []);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('grocery.shop.receipt')}</Text>
      {failed ? (
        <Text style={styles.failed}>{t('grocery.shop.receipt_unavailable')}</Text>
      ) : signedUrl ? (
        <Pressable
          onPress={openZoom}
          accessibilityRole="imagebutton"
          accessibilityLabel={t('grocery.shop.view_receipt')}
        >
          <Image source={{ uri: signedUrl }} style={styles.thumb} resizeMode="cover" />
          <View style={styles.expandBadge}>
            <Ionicons name="expand-outline" size={16} color="#fff" />
          </View>
        </Pressable>
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={C.primary} />
        </View>
      )}

      <Modal visible={zoomed} transparent animationType="fade" onRequestClose={closeZoom}>
        <SafeAreaView style={styles.zoomBackdrop}>
          <Pressable
            onPress={closeZoom}
            style={styles.zoomClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          {signedUrl && (
            <Image source={{ uri: signedUrl }} style={styles.zoomImage} resizeMode="contain" />
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const makeStyles = (C: ColorTokens) =>
  StyleSheet.create({
    card: {
      backgroundColor: C.surface,
      borderRadius: ms(16),
      padding: sizes.lg,
      gap: sizes.sm,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: ms(2) },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    title: { color: C.textPrimary, fontSize: mf(18), ...font.semibold, marginBottom: sizes.xs },
    thumb: { width: '100%', height: ms(220), borderRadius: ms(12), backgroundColor: C.border },
    expandBadge: {
      position: 'absolute',
      bottom: ms(10),
      right: ms(10),
      width: ms(32),
      height: ms(32),
      borderRadius: ms(16),
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    loading: { height: ms(120), alignItems: 'center', justifyContent: 'center' },
    failed: { color: C.textSecondary, fontSize: mf(14), ...font.regular },
    zoomBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' },
    zoomClose: {
      position: 'absolute',
      top: ms(12),
      right: ms(12),
      zIndex: 2,
      width: ms(44),
      height: ms(44),
      alignItems: 'center',
      justifyContent: 'center',
    },
    zoomImage: { width: '100%', height: '80%' },
  });
