import { useEffect, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator, Share } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { supabase } from '@lib/supabase';
import { captureError } from '@lib/errorTracking';
import { useAuthStore } from '@stores/authStore';
import { Alert } from '@lib/alert';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/parking-toggle`;

export default function NfcParkingScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const userId = useAuthStore((s) => s.user?.id);
  const language = useLanguageStore((s) => s.language);
  const isRTLMode = isRTL(language);
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const headingFont = useHeadingFont('bold');

  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        // The token column is no longer directly readable (housemates must not
        // see each other's token) — fetch our own via the SECURITY DEFINER RPC.
        const { data, error } = await supabase.rpc('get_my_nfc_parking_token');
        if (cancelled) return;
        if (!error && data) {
          setToken(data as string);
        }
      } catch (err) {
        if (!cancelled) captureError(err, { context: 'nfc-token-load', userId });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return (): void => {
      cancelled = true;
    };
  }, [userId]);

  const handleShareToken = useCallback(async (): Promise<void> => {
    if (!token) return;
    await Share.share({ message: token });
  }, [token]);

  const handleShareUrl = useCallback(async (): Promise<void> => {
    await Share.share({ message: FUNCTION_URL });
  }, []);

  const handleRegenerate = useCallback((): void => {
    Alert.alert(t('nfc_parking.reset_title'), t('nfc_parking.reset_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.reset'),
        style: 'destructive',
        onPress: async (): Promise<void> => {
          if (!userId) return;
          setIsLoading(true);
          try {
            const { data, error } = await supabase.rpc('reset_nfc_parking_token', {
              p_user_id: userId,
            });
            if (error || !data) {
              Alert.alert(t('common.error'), t('nfc_parking.reset_error'));
              return;
            }
            setToken(data as string);
          } catch {
            Alert.alert(t('common.error'), t('nfc_parking.reset_error'));
          } finally {
            setIsLoading(false);
          }
        },
      },
    ]);
  }, [userId, t]);

  const handleBack = useCallback((): void => {
    router.back();
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          style={styles.backBtn}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('nfc_parking.go_back')}
        >
          <Ionicons
            name={isRTLMode ? 'chevron-forward' : 'chevron-back'}
            size={24}
            color={C.primary}
          />
        </Pressable>
        <Text style={[styles.title, headingFont]}>{t('nfc_parking.title')}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.iconRow}>
            <Ionicons name="radio-outline" size={26} color={C.primary} />
            <Text style={styles.cardTitle}>{t('nfc_parking.how_it_works')}</Text>
          </View>
          <Text style={styles.cardBody}>{t('nfc_parking.how_it_works_body')}</Text>
        </View>

        <Text style={styles.sectionLabel}>{t('nfc_parking.step1_title')}</Text>
        <Text style={styles.hint}>{t('nfc_parking.step1_hint')}</Text>
        <View style={styles.card}>
          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={C.primary} />
            </View>
          ) : token ? (
            <>
              <Text style={styles.tokenText} selectable>
                {token}
              </Text>
              <View style={styles.tokenActions}>
                <Pressable
                  style={styles.copyBtn}
                  onPress={handleShareToken}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t('nfc_parking.share_token')}
                  accessibilityHint={t('nfc_parking.share_token_hint')}
                >
                  <Ionicons name="share-outline" size={16} color={C.primary} />
                  <Text style={styles.copyBtnText}>{t('nfc_parking.share_copy')}</Text>
                </Pressable>
                <Pressable
                  style={styles.resetBtn}
                  onPress={handleRegenerate}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t('nfc_parking.reset_token')}
                  accessibilityHint={t('nfc_parking.reset_token_hint')}
                >
                  <Text style={styles.resetBtnText}>{t('common.reset')}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Text style={styles.errorText}>{t('nfc_parking.load_error')}</Text>
          )}
        </View>

        <Text style={styles.sectionLabel}>{t('nfc_parking.step2_title')}</Text>
        <Text style={styles.hint}>{t('nfc_parking.step2_hint')}</Text>
        <View style={styles.card}>
          <Text style={styles.tokenText} selectable>
            {FUNCTION_URL}
          </Text>
          <Pressable
            style={styles.copyBtn}
            onPress={handleShareUrl}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('nfc_parking.share_url')}
          >
            <Ionicons name="share-outline" size={16} color={C.primary} />
            <Text style={styles.copyBtnText}>{t('nfc_parking.share_copy')}</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>{t('nfc_parking.step3_title')}</Text>
        <View style={styles.card}>
          {(
            [
              t('nfc_parking.step3_1'),
              t('nfc_parking.step3_2'),
              t('nfc_parking.step3_3'),
              t('nfc_parking.step3_4'),
              t('nfc_parking.step3_5'),
              t('nfc_parking.step3_6'),
              t('nfc_parking.step3_7'),
              t('nfc_parking.step3_8'),
              t('nfc_parking.step3_9'),
            ] as string[]
          ).map((step, i) => (
            <View key={i} style={[styles.stepRow, i > 0 && styles.stepBorder]}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>{t('nfc_parking.nfc_tag_title')}</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="pricetag-outline" size={20} color={C.primary} style={styles.icon} />
            <Text style={styles.cardBody}>{t('nfc_parking.nfc_tag_body')}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: sizes.md,
      paddingVertical: sizes.sm,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    backBtn: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
    title: { fontSize: 17, ...font.bold, color: C.textPrimary },
    content: { padding: sizes.lg, gap: sizes.sm, paddingBottom: 40 },
    sectionLabel: {
      fontSize: 12,
      color: C.textSecondary,
      ...font.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: sizes.sm,
      marginBottom: sizes.xs,
    },
    hint: { fontSize: 13, color: C.textSecondary, ...font.regular, marginBottom: 4 },
    card: {
      backgroundColor: C.surface,
      borderRadius: 16,
      overflow: 'hidden',
      padding: sizes.md,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
      gap: sizes.sm,
    },
    iconRow: { flexDirection: 'row', alignItems: 'center', gap: sizes.sm },
    cardTitle: { fontSize: 16, ...font.bold, color: C.textPrimary },
    cardBody: { fontSize: 14, color: C.textSecondary, ...font.regular, lineHeight: 21 },
    loadingRow: { alignItems: 'center', paddingVertical: sizes.md },
    tokenText: {
      fontSize: 13,
      ...font.regular,
      color: C.textPrimary,
      fontFamily: 'monospace',
      backgroundColor: C.background,
      borderRadius: 8,
      padding: sizes.sm,
      lineHeight: 20,
    },
    tokenActions: { flexDirection: 'row', gap: sizes.sm },
    copyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      minHeight: 44,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: C.primary,
      backgroundColor: 'transparent',
    },
    copyBtnText: { fontSize: 14, ...font.semibold, color: C.primary },
    resetBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      minHeight: 44,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: C.border,
      justifyContent: 'center',
    },
    resetBtnText: { fontSize: 14, ...font.semibold, color: C.textSecondary },
    errorText: { fontSize: 14, color: C.negative, ...font.regular, textAlign: 'center' },
    stepRow: {
      flexDirection: 'row',
      gap: sizes.sm,
      paddingVertical: sizes.sm,
      alignItems: 'flex-start',
    },
    stepBorder: { borderTopWidth: 1, borderTopColor: C.border },
    stepNum: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: C.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      marginTop: 1,
    },
    stepNumText: { fontSize: 12, ...font.bold, color: C.primary },
    stepText: { flex: 1, fontSize: 14, color: C.textSecondary, ...font.regular, lineHeight: 21 },
    row: { flexDirection: 'row', gap: sizes.sm, alignItems: 'flex-start' },
    icon: { fontSize: 22, marginTop: 2 },
  });
}
