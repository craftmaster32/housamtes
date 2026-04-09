import { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useHousematesStore } from '@stores/housematesStore';
import { useAuthStore } from '@stores/authStore';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

export default function HousematesScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const housemates = useHousematesStore((s) => s.housemates);
  const houseName = useHousematesStore((s) => s.houseName);
  const inviteCode = useHousematesStore((s) => s.inviteCode);
  const isLoading = useHousematesStore((s) => s.isLoading);
  const profile = useAuthStore((s) => s.profile);
  const myName = profile?.name ?? '';

  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(inviteCode).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [inviteCode]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.loadingText}>{t('housemates.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        <Text style={styles.heading}>{t('housemates.title')}</Text>
        {!!houseName && <Text style={styles.houseName}>{houseName}</Text>}

        {/* Invite section */}
        <View style={styles.inviteCard}>
          <Text style={styles.inviteLabel}>{t('housemates.invite_section')}</Text>
          <Text style={styles.inviteCode}>{inviteCode || '------'}</Text>
          <Text style={styles.inviteHint}>
            {t('housemates.invite_body')}
          </Text>
          <Pressable
            style={[styles.copyBtn, copied && styles.copyBtnDone]}
            onPress={handleCopy}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('housemates.copy_code')}
          >
            <Text style={styles.copyBtnText}>{copied ? t('housemates.copied') : t('housemates.copy_code')}</Text>
          </Pressable>
        </View>

        {/* Current members */}
        <Text style={styles.sectionLabel}>{t('housemates.members_section')} ({housemates.length})</Text>

        {housemates.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{t('housemates.just_you')}</Text>
            <Text style={styles.emptyText}>{t('housemates.just_you_hint')}</Text>
          </View>
        ) : (
          <View style={styles.membersList}>
            {housemates.map((h) => {
              const isMe = h.name === myName;
              const initial = (h.name || '?')[0].toUpperCase();
              return (
                <View key={h.id} style={styles.memberRow}>
                  <View style={[styles.avatar, { backgroundColor: h.color ?? colors.primary }]}>
                    <Text style={styles.avatarText}>{initial}</Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{h.name}</Text>
                    {isMe && <Text style={styles.memberYou}>{t('housemates.thats_you')}</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Info box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            {t('housemates.join_instructions')}
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: sizes.lg, paddingBottom: 60, gap: sizes.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: colors.textSecondary, ...font.regular },

  heading: { fontSize: 26, ...font.extrabold, color: colors.textPrimary, letterSpacing: -0.5 },
  houseName: { fontSize: 15, ...font.regular, color: colors.textSecondary, marginTop: -sizes.xs },

  inviteCard: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: sizes.lg,
    alignItems: 'center',
    gap: sizes.sm,
    boxShadow: '0 4px 16px rgba(88,86,214,0.28)',
  } as never,
  inviteLabel: {
    fontSize: 11,
    ...font.semibold,
    color: colors.white + 'aa',
    letterSpacing: 1.5,
  },
  inviteCode: {
    fontSize: 36,
    ...font.extrabold,
    color: colors.white,
    letterSpacing: 8,
  },
  inviteHint: {
    fontSize: 13,
    ...font.regular,
    color: colors.white + 'bb',
    textAlign: 'center',
    lineHeight: 18,
  },
  copyBtn: {
    backgroundColor: colors.white + '25',
    paddingVertical: 10,
    paddingHorizontal: sizes.lg,
    borderRadius: sizes.borderRadiusFull,
    marginTop: sizes.xs,
  },
  copyBtnDone: { backgroundColor: colors.white + '40' },
  copyBtnText: { color: colors.white, ...font.semibold, fontSize: 15 },

  sectionLabel: {
    fontSize: 12,
    ...font.semibold,
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: -sizes.xs,
  },

  membersList: {
    backgroundColor: colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  } as never,
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sizes.md,
    paddingHorizontal: sizes.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: colors.white, fontSize: 17, ...font.bold },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 16, ...font.semibold, color: colors.textPrimary },
  memberYou: { fontSize: 13, ...font.regular, color: colors.textSecondary, marginTop: 1 },

  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: sizes.lg,
    alignItems: 'center',
    gap: sizes.sm,
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  } as never,
  emptyTitle: { fontSize: 16, ...font.bold, color: colors.textPrimary },
  emptyText: { fontSize: 14, ...font.regular, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  infoBox: {
    backgroundColor: colors.primary + '0f',
    borderRadius: 12,
    padding: sizes.md,
    borderWidth: 1,
    borderColor: colors.primary + '25',
  },
  infoText: { fontSize: 13, ...font.regular, color: colors.textSecondary, lineHeight: 19 },
});
