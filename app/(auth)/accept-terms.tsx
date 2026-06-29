import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Animated } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation, Trans } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@stores/authStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

export default function AcceptTermsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const acceptUpdatedTerms = useAuthStore((s) => s.acceptUpdatedTerms);
  const signOut = useAuthStore((s) => s.signOut);
  const isLoading = useAuthStore((s) => s.isLoading);
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const handleAccept = useCallback(async (): Promise<void> => {
    if (!agreed) {
      setError(t('auth.accept_terms_checkbox_required'));
      return;
    }
    try {
      setError('');
      await acceptUpdatedTerms();
    } catch {
      setError(t('auth.something_went_wrong'));
    }
  }, [agreed, acceptUpdatedTerms, t]);

  const handleSignOut = useCallback(async (): Promise<void> => {
    await signOut();
  }, [signOut]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.iconWrap}>
            <View style={styles.iconCircle}>
              <Ionicons name="document-text-outline" size={32} color={C.primary} />
            </View>
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>{t('auth.terms_updated_title')}</Text>
            <Text style={styles.subtitle}>{t('auth.terms_updated_body')}</Text>
          </View>

          <View style={styles.changeCard}>
            <Text style={styles.changeHeading}>{t('auth.terms_what_changed')}</Text>
            <View style={styles.changeList}>
              <View style={styles.changeRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={C.primary}
                  style={styles.changeIcon}
                />
                <Text style={styles.changeText}>{t('auth.terms_change_australia')}</Text>
              </View>
              <View style={styles.changeRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={C.primary}
                  style={styles.changeIcon}
                />
                <Text style={styles.changeText}>{t('auth.terms_change_israel')}</Text>
              </View>
              <View style={styles.changeRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={C.primary}
                  style={styles.changeIcon}
                />
                <Text style={styles.changeText}>{t('auth.terms_change_us_states')}</Text>
              </View>
              <View style={styles.changeRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={C.primary}
                  style={styles.changeIcon}
                />
                <Text style={styles.changeText}>{t('auth.terms_change_consumer_law')}</Text>
              </View>
              <View style={styles.changeRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={C.primary}
                  style={styles.changeIcon}
                />
                <Text style={styles.changeText}>{t('auth.terms_change_jurisdiction')}</Text>
              </View>
            </View>
          </View>

          <View style={styles.termsRow}>
            <Pressable
              onPress={() => {
                setAgreed((v) => !v);
                setError('');
              }}
              hitSlop={11}
              accessible
              accessibilityRole="checkbox"
              accessibilityLabel={t('auth.accept_terms_agree_label')}
              accessibilityState={{ checked: agreed }}
            >
              <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                {agreed && <Ionicons name="checkmark" size={14} color={'#fff'} />}
              </View>
            </Pressable>
            <Text style={styles.termsText}>
              <Trans
                i18nKey="auth.accept_terms_agree_full"
                components={{
                  tos: (
                    <Text
                      style={styles.termsLink}
                      onPress={() => router.push('/(auth)/terms')}
                      accessibilityRole="link"
                    >
                      {''}
                    </Text>
                  ),
                  privacy: (
                    <Text
                      style={styles.termsLink}
                      onPress={() => router.push('/(auth)/privacy-policy')}
                      accessibilityRole="link"
                    >
                      {''}
                    </Text>
                  ),
                }}
              />
            </Text>
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Button
            mode="contained"
            onPress={handleAccept}
            loading={isLoading}
            disabled={isLoading || !agreed}
            style={styles.button}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
            buttonColor={C.primary}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('auth.accept_and_continue')}
          >
            {t('auth.accept_and_continue')}
          </Button>

          <Pressable
            onPress={handleSignOut}
            style={styles.signOutBtn}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('auth.sign_out_instead')}
          >
            <Text style={styles.signOutText}>{t('auth.sign_out_instead')}</Text>
          </Pressable>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.surface },
    flex: { flex: 1 },
    content: {
      paddingHorizontal: sizes.lg,
      paddingTop: sizes.xl,
      paddingBottom: sizes.xxl,
      gap: sizes.md,
    },
    iconWrap: { alignItems: 'center', marginBottom: sizes.xs },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: C.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    header: { gap: 8, alignItems: 'center' },
    title: {
      fontSize: 26,
      ...font.extrabold,
      color: C.textPrimary,
      letterSpacing: -0.5,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 14,
      ...font.regular,
      color: C.textSecondary,
      lineHeight: 22,
      textAlign: 'center',
    },
    changeCard: {
      backgroundColor: C.background,
      borderRadius: 14,
      padding: sizes.md,
      gap: sizes.sm,
    },
    changeHeading: {
      fontSize: 14,
      ...font.semibold,
      color: C.textPrimary,
      marginBottom: 2,
    },
    changeList: { gap: 10 },
    changeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    changeIcon: { marginTop: 2, flexShrink: 0 },
    changeText: {
      flex: 1,
      fontSize: 13,
      ...font.regular,
      color: C.textSecondary,
      lineHeight: 20,
    },
    changeBold: { ...font.semibold, color: C.textPrimary },
    termsRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: sizes.sm,
      marginTop: sizes.xs,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: C.border,
      backgroundColor: C.surface,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
      marginTop: 1,
    },
    checkboxChecked: {
      backgroundColor: C.primary,
      borderColor: C.primary,
    },
    termsText: {
      flex: 1,
      fontSize: 13,
      ...font.regular,
      color: C.textSecondary,
      lineHeight: 20,
    },
    termsLink: {
      color: C.primary,
      ...font.semibold,
    },
    error: {
      ...font.regular,
      color: C.danger,
      fontSize: sizes.fontSm,
    },
    button: { borderRadius: 14, marginTop: sizes.xs },
    buttonContent: { height: 52 },
    buttonLabel: { fontSize: 16, ...font.semibold, letterSpacing: 0.2 },
    signOutBtn: {
      alignItems: 'center',
      paddingVertical: sizes.sm,
    },
    signOutText: {
      fontSize: 14,
      ...font.medium,
      color: C.textSecondary,
    },
  });
}
