import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@stores/authStore';
import { COLORS } from '@stores/housematesStore';
import { supabase } from '@lib/supabase';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

const ONBOARDING_INTENT_KEY = 'onboarding_intent';

function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

type Mode = 'create' | 'join';

interface PendingHouse {
  id: string;
  name: string;
  memberCount: number;
}

export default function HouseSetupScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('create');
  const [houseName, setHouseName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [assignedColor, setAssignedColor] = useState<string | null>(null);
  const [pendingHouse, setPendingHouse] = useState<PendingHouse | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
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
    Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [fadeAnim]);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_INTENT_KEY)
      .then((intent) => {
        if (intent === 'join') {
          setMode('join');
          AsyncStorage.removeItem(ONBOARDING_INTENT_KEY).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const handleCreate = useCallback(async () => {
    if (!houseName.trim()) {
      setError(t('house_setup.enter_house_name'));
      return;
    }
    if (!user) return;
    setIsLoading(true);
    setError('');
    try {
      const code = generateCode();
      const timezone = getDeviceTimezone();
      const { data: house, error: houseErr } = await supabase
        .from('houses')
        .insert({ name: houseName.trim(), invite_code: code, created_by: user.id, timezone })
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

  const handleFindHouse = useCallback(async () => {
    if (joinLockedUntilRef.current && new Date() < joinLockedUntilRef.current) {
      const secondsLeft = Math.ceil((joinLockedUntilRef.current.getTime() - Date.now()) / 1000);
      setError(`Too many attempts. Please wait ${secondsLeft}s before trying again.`);
      return;
    }
    if (!inviteCode.trim()) {
      setError(t('house_setup.enter_invite_code'));
      return;
    }
    if (!user) return;
    setIsLoading(true);
    setError('');
    try {
      const { data: house, error: houseErr } = await supabase
        .from('houses')
        .select('id, name')
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

      const { count } = await supabase
        .from('house_members')
        .select('*', { count: 'exact', head: true })
        .eq('house_id', house.id);

      joinAttemptsRef.current = 0;
      joinLockedUntilRef.current = null;
      setPendingHouse({ id: house.id, name: house.name as string, memberCount: count ?? 0 });
      setShowConfirm(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('house_setup.failed_join'));
    } finally {
      setIsLoading(false);
    }
  }, [inviteCode, user, t]);

  const handleConfirmJoin = useCallback(async () => {
    if (!pendingHouse || !user) return;
    setIsLoading(true);
    setError('');
    try {
      const { error: memberErr } = await supabase
        .from('house_members')
        .insert({ house_id: pendingHouse.id, user_id: user.id });
      if (memberErr && memberErr.code !== '23505') throw new Error(t('house_setup.failed_join'));

      await reloadMembership();

      const { data: otherMembers } = await supabase
        .from('house_members')
        .select('user_id')
        .eq('house_id', pendingHouse.id)
        .neq('user_id', user.id);

      if (otherMembers && otherMembers.length > 0) {
        const [{ data: otherProfiles }, { data: myProfile }] = await Promise.all([
          supabase
            .from('profiles')
            .select('avatar_color')
            .in(
              'id',
              otherMembers.map((m) => m.user_id)
            ),
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

      setShowConfirm(false);
      setHouseId(pendingHouse.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('house_setup.failed_join'));
      setShowConfirm(false);
      setIsLoading(false);
    }
  }, [pendingHouse, user, reloadMembership, setHouseId, t]);

  return (
    <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
      {/* Blue inner header */}
      <SafeAreaView edges={['top']} style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => signOut()}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Back to login"
        >
          <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.85)" />
          <Text style={styles.backText}>{t('house_setup.back_to_login')}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t('house_setup.title')}</Text>
        <Text style={styles.headerSubtitle}>{t('house_setup.subtitle')}</Text>
      </SafeAreaView>

      {/* White card */}
      <KeyboardAvoidingView
        style={styles.cardWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {/* Option cards */}
            <View style={styles.optionGrid}>
              <Pressable
                style={[styles.optionCard, mode === 'create' && styles.optionCardActive]}
                onPress={() => {
                  setMode('create');
                  setError('');
                }}
                accessible
                accessibilityRole="button"
                accessibilityLabel="Create a new house"
                accessibilityState={{ selected: mode === 'create' }}
              >
                <View style={[styles.optionChip, mode === 'create' && styles.optionChipActive]}>
                  <Ionicons
                    name="home-outline"
                    size={24}
                    color={mode === 'create' ? C.primary : C.textSecondary}
                  />
                </View>
                <Text style={[styles.optionTitle, mode === 'create' && styles.optionTitleActive]}>
                  {t('house_setup.create_house')}
                </Text>
                <Text style={styles.optionSub}>{"I'm the first one setting this up"}</Text>
              </Pressable>

              <Pressable
                style={[styles.optionCard, mode === 'join' && styles.optionCardActive]}
                onPress={() => {
                  setMode('join');
                  setError('');
                }}
                accessible
                accessibilityRole="button"
                accessibilityLabel="Join an existing house"
                accessibilityState={{ selected: mode === 'join' }}
              >
                <View style={[styles.optionChip, mode === 'join' && styles.optionChipActive]}>
                  <Ionicons
                    name="key-outline"
                    size={24}
                    color={mode === 'join' ? C.primary : C.textSecondary}
                  />
                </View>
                <Text style={[styles.optionTitle, mode === 'join' && styles.optionTitleActive]}>
                  {t('house_setup.join_house')}
                </Text>
                <Text style={styles.optionSub}>I have an invite code</Text>
              </Pressable>
            </View>

            {/* Form */}
            {mode === 'create' ? (
              <View style={styles.form}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>{t('house_setup.house_name_placeholder')}</Text>
                  <TextInput
                    value={houseName}
                    onChangeText={(v) => {
                      setHouseName(v);
                      setError('');
                    }}
                    mode="outlined"
                    style={styles.input}
                    outlineStyle={styles.inputOutline}
                    autoFocus
                    returnKeyType="go"
                    onSubmitEditing={handleCreate}
                    error={!!error}
                    placeholder="e.g. Our Flat"
                    placeholderTextColor={C.textTertiary}
                    accessibilityLabel="House name"
                    accessibilityHint="Enter a name for your household, e.g. Our Flat"
                  />
                </View>

                {!!error && <Text style={styles.errorText}>{error}</Text>}

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
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>{t('house_setup.invite_code')}</Text>
                  <TextInput
                    value={inviteCode}
                    onChangeText={(v) => {
                      setInviteCode(v.toUpperCase());
                      setError('');
                    }}
                    mode="outlined"
                    style={[styles.input, styles.codeInput]}
                    outlineStyle={styles.inputOutline}
                    autoCapitalize="characters"
                    autoFocus
                    returnKeyType="go"
                    onSubmitEditing={handleFindHouse}
                    error={!!error}
                    placeholder="XXXXXXXX"
                    placeholderTextColor={C.textTertiary}
                    accessibilityLabel="Invite code"
                    accessibilityHint="Enter the 8-character invite code from a housemate"
                  />
                  <Text style={styles.codeHint}>
                    Auto-uppercase · Ask a housemate for their code
                  </Text>
                </View>

                {!!error && <Text style={styles.errorText}>{error}</Text>}

                {assignedColor && (
                  <View style={styles.colorNotice}>
                    <View style={[styles.colorNoticeDot, { backgroundColor: assignedColor }]} />
                    <Text style={styles.colorNoticeText}>
                      Your color was updated to avoid a clash with your new housemates. Change it
                      anytime in Profile.
                    </Text>
                  </View>
                )}

                <Button
                  mode="contained"
                  onPress={handleFindHouse}
                  loading={isLoading}
                  disabled={isLoading || inviteCode.trim().length < 6}
                  style={styles.button}
                  contentStyle={styles.buttonContent}
                  labelStyle={styles.buttonLabel}
                  buttonColor={C.primary}
                >
                  Find house
                </Button>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Join confirmation bottom sheet */}
      <Modal
        visible={showConfirm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConfirm(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setShowConfirm(false)}>
          <Pressable
            style={styles.sheet}
            onPress={() => {
              /* swallow */
            }}
          >
            <View style={styles.sheetHandle} />

            <Text style={styles.sheetTitle}>Join this house?</Text>
            <Text style={styles.sheetSubtitle}>
              {`We found a match for code ${inviteCode.trim().toUpperCase()}`}
            </Text>

            {pendingHouse && (
              <View style={styles.houseCard}>
                <View style={styles.houseChip}>
                  <Ionicons name="home-outline" size={22} color={C.primary} />
                </View>
                <View style={styles.houseInfo}>
                  <Text style={styles.houseName}>{pendingHouse.name}</Text>
                  <View style={styles.memberRow}>
                    <Ionicons name="people-outline" size={13} color={C.textSecondary} />
                    <Text style={styles.memberCount}>
                      {`${pendingHouse.memberCount} ${pendingHouse.memberCount === 1 ? 'member' : 'members'} already inside`}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <Button
              mode="contained"
              onPress={handleConfirmJoin}
              loading={isLoading}
              disabled={isLoading}
              style={[styles.button, styles.confirmButton]}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
              buttonColor="#4FB071"
            >
              Confirm & join
            </Button>

            <Pressable
              onPress={() => setShowConfirm(false)}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelText}>{"That's not my house — try again"}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Animated.View>
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
    root: {
      flex: 1,
      backgroundColor: C.primary,
    },
    header: {
      backgroundColor: C.primary,
      paddingHorizontal: sizes.lg,
      paddingBottom: 28,
      gap: 8,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      alignSelf: 'flex-start',
      paddingVertical: sizes.sm,
      paddingHorizontal: sizes.xs,
      minHeight: sizes.touchTarget,
      marginTop: sizes.xs,
      marginBottom: 4,
    },
    backText: {
      fontSize: 15.5,
      ...font.medium,
      color: 'rgba(255,255,255,0.85)',
    },
    headerTitle: {
      fontSize: 22,
      ...font.extrabold,
      color: '#fff',
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      fontSize: 15,
      ...font.regular,
      color: 'rgba(255,255,255,0.65)',
      lineHeight: 22,
    },
    cardWrapper: {
      flex: 1,
      backgroundColor: C.primary,
    },
    scrollContent: {
      flexGrow: 1,
    },
    card: {
      flex: 1,
      backgroundColor: C.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: sizes.lg,
      paddingTop: 28,
      paddingBottom: 48,
      gap: 24,
      minHeight: 480,
    },
    optionGrid: {
      flexDirection: 'row',
      gap: 14,
    },
    optionCard: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: C.border,
      borderRadius: 16,
      padding: sizes.md,
      alignItems: 'center',
      gap: 8,
    },
    optionCardActive: {
      borderColor: C.primary,
      backgroundColor: '#EAF3FF',
    },
    optionChip: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: C.surfaceSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    optionChipActive: {
      backgroundColor: 'rgba(59,111,191,0.14)',
    },
    optionTitle: {
      fontSize: sizes.fontSm,
      ...font.bold,
      color: C.textSecondary,
      textAlign: 'center',
    },
    optionTitleActive: {
      color: C.textPrimary,
    },
    optionSub: {
      fontSize: 12,
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 16,
    },
    form: {
      gap: 16,
    },
    fieldGroup: {
      gap: 6,
    },
    label: {
      fontSize: sizes.fontSm,
      ...font.semibold,
      color: C.textPrimary,
    },
    input: {
      backgroundColor: C.surface,
      height: 52,
    },
    inputOutline: {
      borderRadius: 12,
      borderColor: C.border,
    },
    codeInput: {
      letterSpacing: 4,
      fontSize: sizes.fontXl,
    },
    codeHint: {
      fontSize: 11,
      ...font.regular,
      color: C.textTertiary,
    },
    errorText: {
      fontSize: sizes.fontXs,
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
      borderRadius: 14,
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.28,
      shadowRadius: 12,
      elevation: 4,
    },
    confirmButton: {
      shadowColor: '#4FB071',
      width: '100%',
    },
    buttonContent: { height: 52 },
    buttonLabel: {
      fontSize: sizes.fontMd,
      ...font.semibold,
      letterSpacing: 0.1,
    },
    // Bottom sheet
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(12,20,35,0.52)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: sizes.lg,
      paddingTop: sizes.md,
      paddingBottom: 48,
      gap: 16,
      alignItems: 'center',
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.border,
      marginBottom: sizes.sm,
    },
    sheetTitle: {
      fontSize: 20,
      ...font.bold,
      color: C.textPrimary,
      textAlign: 'center',
    },
    sheetSubtitle: {
      fontSize: sizes.fontSm,
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
    },
    houseCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: '#EFF5FC',
      borderRadius: 16,
      padding: sizes.md,
      width: '100%',
    },
    houseChip: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: '#D6E6F9',
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
    houseInfo: {
      gap: 4,
    },
    houseName: {
      fontSize: 17,
      ...font.bold,
      color: C.textPrimary,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    memberCount: {
      fontSize: 13,
      ...font.regular,
      color: C.textSecondary,
    },
    cancelBtn: {
      paddingVertical: sizes.sm,
    },
    cancelText: {
      fontSize: 13,
      ...font.regular,
      color: C.textSecondary,
      textDecorationLine: 'underline',
      textAlign: 'center',
    },
  });
}
