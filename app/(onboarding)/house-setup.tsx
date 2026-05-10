import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Animated } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@stores/authStore';
import { COLORS } from '@stores/housematesStore';
import { supabase } from '@lib/supabase';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

const ONBOARDING_INTENT_KEY = 'onboarding_intent';

type Tab = 'create' | 'join';

export default function HouseSetupScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('create');
  const [houseName, setHouseName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [assignedColor, setAssignedColor] = useState<string | null>(null);
  const joinAttemptsRef = useRef(0);
  const joinLockedUntilRef = useRef<Date | null>(null);
  const user = useAuthStore((s) => s.user);
  const setHouseId = useAuthStore((s) => s.setHouseId);
  const reloadMembership = useAuthStore((s) => s.reloadMembership);
  const signOut = useAuthStore((s) => s.signOut);

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const onBackPress = useCallback(() => { signOut(); }, [signOut]);
  const onSelectCreate = useCallback(() => { setTab('create'); setError(''); }, [setTab, setError]);
  const onSelectJoin = useCallback(() => { setTab('join'); setError(''); }, [setTab, setError]);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_INTENT_KEY).then((intent) => {
      if (intent === 'join') {
        setTab('join');
        AsyncStorage.removeItem(ONBOARDING_INTENT_KEY).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const handleCreate = useCallback(async () => {
    if (!houseName.trim()) { setError(t('house_setup.enter_house_name')); return; }
    if (!user) return;
    setIsLoading(true);
    setError('');
    try {
      const code = generateCode();
      const { data: house, error: houseErr } = await supabase
        .from('houses')
        .insert({ name: houseName.trim(), invite_code: code, created_by: user.id })
        .select()
        .single();
      if (houseErr) throw new Error(t('house_setup.failed_create'));

      const { error: memberErr } = await supabase
        .from('house_members')
        .insert({ house_id: house.id, user_id: user.id, role: 'owner' });
      if (memberErr) throw new Error(t('house_setup.failed_create'));

      setHouseId(house.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('house_setup.failed_create'));
      setIsLoading(false);
    }
  }, [houseName, user, setHouseId, t]);

  const handleJoin = useCallback(async () => {
    if (joinLockedUntilRef.current && new Date() < joinLockedUntilRef.current) {
      const secondsLeft = Math.ceil((joinLockedUntilRef.current.getTime() - Date.now()) / 1000);
      setError(`Too many attempts. Please wait ${secondsLeft}s before trying again.`);
      return;
    }
    if (!inviteCode.trim()) { setError(t('house_setup.enter_invite_code')); return; }
    if (!user) return;
    setIsLoading(true);
    setError('');
    try {
      const { data: house, error: houseErr } = await supabase
        .from('houses')
        .select('id')
        .eq('invite_code', inviteCode.trim().toUpperCase())
        .maybeSingle();
      if (houseErr) throw new Error(t('house_setup.failed_join'));
      if (!house) {
        joinAttemptsRef.current += 1;
        if (joinAttemptsRef.current >= 3) {
          const lockSeconds = Math.min(10 * Math.pow(2, joinAttemptsRef.current - 3), 300);
          joinLockedUntilRef.current = new Date(Date.now() + lockSeconds * 1000);
        }
        throw new Error(t('house_setup.code_not_found'));
      }
      joinAttemptsRef.current = 0;
      joinLockedUntilRef.current = null;

      const { error: memberErr } = await supabase
        .from('house_members')
        .insert({ house_id: house.id, user_id: user.id });
      // 23505 = duplicate key: user is already a member — treat as success
      if (memberErr && memberErr.code !== '23505') throw new Error(t('house_setup.failed_join'));

      // Reload membership so role & permissions reflect the new house
      await reloadMembership();

      // Enforce unique color per house: if another member shares this user's color, auto-assign a free one
      const { data: otherMembers } = await supabase
        .from('house_members')
        .select('user_id')
        .eq('house_id', house.id)
        .neq('user_id', user.id);

      if (otherMembers && otherMembers.length > 0) {
        const [{ data: otherProfiles }, { data: myProfile }] = await Promise.all([
          supabase.from('profiles').select('avatar_color').in('id', otherMembers.map((m) => m.user_id)),
          supabase.from('profiles').select('avatar_color').eq('id', user.id).maybeSingle(),
        ]);
        const takenColors = new Set(otherProfiles?.map((p) => p.avatar_color) ?? []);
        if (myProfile && takenColors.has(myProfile.avatar_color)) {
          const freeColor = COLORS.find((c) => !takenColors.has(c));
          if (freeColor) {
            await supabase.from('profiles').update({ avatar_color: freeColor }).eq('id', user.id);
            setAssignedColor(freeColor);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('house_setup.failed_join'));
      setIsLoading(false);
    }
  }, [inviteCode, user, reloadMembership, t]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.logoRow}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>N</Text>
            </View>
          </View>

          <Pressable
            style={styles.backBtn}
            onPress={onBackPress}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Back to login"
          >
            <Text style={styles.backBtnText}>← {t('house_setup.back_to_login')}</Text>
          </Pressable>

          <View style={styles.titleBlock}>
            <Text style={styles.title}>{t('house_setup.title')}</Text>
            <Text style={styles.subtitle}>
              {t('house_setup.subtitle')}
            </Text>
          </View>

          {/* Tab strip */}
          <View style={styles.tabs}>
            <Pressable
              style={[styles.tab, tab === 'create' && styles.tabActive]}
              onPress={onSelectCreate}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Create house"
              accessibilityState={{ selected: tab === 'create' }}
            >
              <Text style={[styles.tabLabel, tab === 'create' && styles.tabLabelActive]}>
                {t('house_setup.create_house')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, tab === 'join' && styles.tabActive]}
              onPress={onSelectJoin}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Join house"
              accessibilityState={{ selected: tab === 'join' }}
            >
              <Text style={[styles.tabLabel, tab === 'join' && styles.tabLabelActive]}>
                {t('house_setup.join_house')}
              </Text>
            </Pressable>
          </View>

          {tab === 'create' ? (
            <View style={styles.form}>
              <TextInput
                label={t('house_setup.house_name_placeholder')}
                value={houseName}
                onChangeText={(v) => { setHouseName(v); setError(''); }}
                mode="outlined"
                style={styles.input}
                autoFocus
                returnKeyType="go"
                onSubmitEditing={handleCreate}
                error={!!error}
              />
              {!!error && <Text style={styles.error}>{error}</Text>}
              <Button
                mode="contained"
                onPress={handleCreate}
                loading={isLoading}
                disabled={isLoading}
                style={styles.button}
                contentStyle={styles.buttonContent}
                labelStyle={styles.buttonLabel}
                buttonColor={C.primary}
              >
                {t('house_setup.create_house')}
              </Button>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.hint}>
                {t('house_setup.invite_code_hint')}
              </Text>
              <TextInput
                label={t('house_setup.invite_code')}
                value={inviteCode}
                onChangeText={(v) => { setInviteCode(v.toUpperCase()); setError(''); }}
                mode="outlined"
                style={[styles.input, styles.codeInput]}
                autoCapitalize="characters"
                autoFocus
                returnKeyType="go"
                onSubmitEditing={handleJoin}
                error={!!error}
              />
              {!!error && <Text style={styles.error}>{error}</Text>}
              {assignedColor && (
                <View style={styles.colorNotice}>
                  <View style={[styles.colorNoticeDot, { backgroundColor: assignedColor }]} />
                  <Text style={styles.colorNoticeText}>
                    Your color was updated to avoid a clash with your new housemates. Change it anytime in Profile.
                  </Text>
                </View>
              )}
              <Button
                mode="contained"
                onPress={handleJoin}
                loading={isLoading}
                disabled={isLoading}
                style={styles.button}
                contentStyle={styles.buttonContent}
                labelStyle={styles.buttonLabel}
                buttonColor={C.primary}
              >
                {t('house_setup.join_house')}
              </Button>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.surface },
    flex: { flex: 1 },
    content: {
      paddingHorizontal: sizes.lg,
      paddingBottom: sizes.xl,
      gap: sizes.md,
    },
    logoRow: { alignItems: 'center', marginTop: sizes.xl },
    logo: {
      width: 64,
      height: 64,
      borderRadius: sizes.borderRadiusLg,
      borderCurve: 'continuous',
      backgroundColor: C.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    } as never,
    logoText: {
      fontSize: 32,
      ...font.extrabold,
      color: '#fff',
    },
    backBtn: {
      paddingVertical: sizes.sm,
      alignSelf: 'flex-start',
    },
    backBtnText: {
      fontSize: 14,
      ...font.medium,
      color: C.textSecondary,
    },
    titleBlock: { gap: 6, marginBottom: sizes.xs },
    title: {
      fontSize: 28,
      ...font.extrabold,
      color: C.textPrimary,
      letterSpacing: -0.5,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 15,
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
    },
    tabs: {
      flexDirection: 'row',
      gap: sizes.sm,
      backgroundColor: C.background,
      borderRadius: sizes.borderRadiusFull,
      padding: 4,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: sizes.borderRadiusFull,
      alignItems: 'center',
    },
    tabActive: {
      backgroundColor: C.primary,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    tabLabel: {
      fontSize: 14,
      ...font.semibold,
      color: C.textSecondary,
    },
    tabLabelActive: {
      color: '#fff',
    },
    form: { gap: sizes.sm, marginTop: sizes.xs },
    hint: {
      fontSize: sizes.fontSm,
      ...font.regular,
      color: C.textSecondary,
    },
    input: { backgroundColor: C.surface },
    codeInput: { letterSpacing: 4, fontSize: sizes.fontXl },
    error: {
      fontSize: sizes.fontSm,
      ...font.regular,
      color: C.danger,
    },
    colorNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sizes.sm,
      backgroundColor: C.primary + '12',
      borderRadius: 10,
      padding: sizes.sm,
    },
    colorNoticeDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      flexShrink: 0,
    },
    colorNoticeText: {
      flex: 1,
      fontSize: 13,
      ...font.regular,
      color: C.textSecondary,
      lineHeight: 18,
    },
    button: {
      marginTop: sizes.sm,
      borderRadius: 14,
    },
    buttonContent: {
      height: 52,
    },
    buttonLabel: {
      fontSize: 16,
      ...font.semibold,
      letterSpacing: 0.2,
    },
  });
}
