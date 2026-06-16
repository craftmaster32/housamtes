import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@lib/supabase';
import { useAuthStore } from '@stores/authStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/parking-toggle`;

export default function NfcParkingScreen(): React.JSX.Element {
  const userId = useAuthStore((s) => s.profile?.id);
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('nfc_parking_token')
          .eq('id', userId)
          .single();
        if (cancelled) return;
        if (!error && data) {
          setToken((data as { nfc_parking_token: string }).nfc_parking_token);
        }
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
    Alert.alert(
      'Reset NFC Token?',
      'Your current NFC tag will stop working. You will need to update your Apple Shortcut with the new token.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async (): Promise<void> => {
            if (!userId) return;
            setIsLoading(true);
            const { data, error } = await supabase.rpc('reset_nfc_parking_token', {
              p_user_id: userId,
            });
            if (error || !data) {
              setIsLoading(false);
              Alert.alert('Error', 'Could not reset the token. Please try again.');
              return;
            }
            setToken(data as string);
            setIsLoading(false);
          },
        },
      ]
    );
  }, [userId]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={C.primary} />
        </Pressable>
        <Text style={styles.title}>NFC Parking Tag</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.iconRow}>
            <Text style={styles.nfcIcon}>📡</Text>
            <Text style={styles.cardTitle}>How it works</Text>
          </View>
          <Text style={styles.cardBody}>
            Stick an NFC tag in your car. Set up an Apple Shortcut that calls this function when you
            tap the tag — it claims the spot when you arrive and releases it when you leave.
            Everything happens in the background with the screen off.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>STEP 1 — YOUR SECRET TOKEN</Text>
        <Text style={styles.hint}>
          This token proves it&apos;s you. Never share it with anyone.
        </Text>
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
                  accessibilityRole="button"
                  accessibilityLabel="Share token"
                >
                  <Ionicons name="share-outline" size={16} color={C.primary} />
                  <Text style={styles.copyBtnText}>Share / Copy</Text>
                </Pressable>
                <Pressable
                  style={styles.resetBtn}
                  onPress={handleRegenerate}
                  accessibilityRole="button"
                  accessibilityLabel="Reset token"
                >
                  <Text style={styles.resetBtnText}>Reset</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Text style={styles.errorText}>Could not load your token. Please try again.</Text>
          )}
        </View>

        <Text style={styles.sectionLabel}>STEP 2 — EDGE FUNCTION URL</Text>
        <Text style={styles.hint}>This is the address your Shortcut will call.</Text>
        <View style={styles.card}>
          <Text style={styles.tokenText} selectable>
            {FUNCTION_URL}
          </Text>
          <Pressable
            style={styles.copyBtn}
            onPress={handleShareUrl}
            accessibilityRole="button"
            accessibilityLabel="Share URL"
          >
            <Ionicons name="share-outline" size={16} color={C.primary} />
            <Text style={styles.copyBtnText}>Share / Copy</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>STEP 3 — SET UP APPLE SHORTCUTS</Text>
        <View style={styles.card}>
          {[
            'Open the Shortcuts app on your iPhone.',
            'Tap Automation → New Automation → NFC.',
            'Tap "Scan" and hold your phone near the tag to register it. Give it a name like "Car Tag".',
            'Add action: Get Contents of URL.',
            `Set the URL to your Function URL (Step 2).`,
            'Set Method to POST.',
            'Tap Add Header → Name: Authorization, Value: Bearer <paste your token>.',
            'Turn off "Ask Before Running" so it runs silently.',
            'Tap Done. Tap the tag to test — the parking spot should toggle!',
          ].map((step, i) => (
            <View key={i} style={[styles.stepRow, i > 0 && styles.stepBorder]}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>NFC TAG</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.icon}>🏷️</Text>
            <Text style={styles.cardBody}>
              Any NTAG213, NTAG215, or NTAG216 tag works. You can buy a pack of 10 for a few dollars
              on Amazon. Stick one on your dashboard or sun visor.
            </Text>
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
    backBtn: { width: 40, alignItems: 'flex-start' },
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
    nfcIcon: { fontSize: 28 },
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
