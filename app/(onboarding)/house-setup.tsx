import { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { supabase } from '@lib/supabase';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

type Tab = 'create' | 'join';

export default function HouseSetupScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('create');
  const [houseName, setHouseName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const user = useAuthStore((s) => s.user);
  const setHouseId = useAuthStore((s) => s.setHouseId);
  const reloadMembership = useAuthStore((s) => s.reloadMembership);
  const signOut = useAuthStore((s) => s.signOut);

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
      if (houseErr) throw houseErr;

      const { error: memberErr } = await supabase
        .from('house_members')
        .insert({ house_id: house.id, user_id: user.id, role: 'owner' });
      if (memberErr) throw memberErr;

      setHouseId(house.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('house_setup.failed_create'));
      setIsLoading(false);
    }
  }, [houseName, user, setHouseId, t]);

  const handleJoin = useCallback(async () => {
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
      if (!house) throw new Error(t('house_setup.code_not_found'));

      const { error: memberErr } = await supabase
        .from('house_members')
        .insert({ house_id: house.id, user_id: user.id });
      // 23505 = duplicate key: user is already a member — treat as success
      if (memberErr && memberErr.code !== '23505') throw memberErr;

      // Reload membership so role & permissions reflect the new house
      await reloadMembership();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('house_setup.failed_join'));
      setIsLoading(false);
    }
  }, [inviteCode, user, reloadMembership, t]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.logoRow}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>N</Text>
          </View>
        </View>

        <Pressable
          style={styles.backBtn}
          onPress={() => signOut()}
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
            onPress={() => { setTab('create'); setError(''); }}
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
            onPress={() => { setTab('join'); setError(''); }}
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
              buttonColor={colors.primary}
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
            <Button
              mode="contained"
              onPress={handleJoin}
              loading={isLoading}
              disabled={isLoading}
              style={styles.button}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
              buttonColor={colors.primary}
            >
              {t('house_setup.join_house')}
            </Button>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
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
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 4px 16px rgba(88,86,214,0.28)',
  } as never,
  logoText: {
    fontSize: 32,
    ...font.extrabold,
    color: colors.white,
  },
  backBtn: {
    paddingVertical: sizes.sm,
    alignSelf: 'flex-start',
  },
  backBtnText: {
    fontSize: 14,
    ...font.medium,
    color: colors.textSecondary,
  },
  titleBlock: { gap: 6, marginBottom: sizes.xs },
  title: {
    fontSize: 28,
    ...font.extrabold,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    ...font.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  tabs: {
    flexDirection: 'row',
    gap: sizes.sm,
    backgroundColor: colors.background,
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
    backgroundColor: colors.primary,
    boxShadow: '0 2px 8px rgba(88,86,214,0.20)',
  } as never,
  tabLabel: {
    fontSize: 14,
    ...font.semibold,
    color: colors.textSecondary,
  },
  tabLabelActive: {
    color: colors.white,
  },
  form: { gap: sizes.sm, marginTop: sizes.xs },
  hint: {
    fontSize: sizes.fontSm,
    ...font.regular,
    color: colors.textSecondary,
  },
  input: { backgroundColor: colors.white },
  codeInput: { letterSpacing: 4, fontSize: sizes.fontXl },
  error: {
    fontSize: sizes.fontSm,
    ...font.regular,
    color: colors.danger,
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
