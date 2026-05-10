import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Platform, Animated } from 'react-native';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useHousematesStore } from '@stores/housematesStore';
import { useAuthStore } from '@stores/authStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

const makeStyles = (C: ColorTokens) => StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    scroll: { padding: sizes.lg, paddingBottom: 60, gap: sizes.md },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    loadingText: { color: C.textSecondary, ...font.regular },

    heading: { fontSize: 26, ...font.extrabold, color: C.textPrimary, letterSpacing: -0.5 },
    houseName: { fontSize: 15, ...font.regular, color: C.textSecondary, marginTop: -sizes.xs },

    inviteCard: {
      backgroundColor: C.primary,
      borderRadius: 20,
      padding: sizes.lg,
      alignItems: 'center',
      gap: sizes.sm,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    inviteLabel: {
      fontSize: 11,
      ...font.semibold,
      color: '#fff' + 'aa',
      letterSpacing: 1.5,
    },
    inviteCode: {
      fontSize: 36,
      ...font.extrabold,
      color: '#fff',
      letterSpacing: 8,
    },
    inviteHint: {
      fontSize: 13,
      ...font.regular,
      color: '#fff' + 'bb',
      textAlign: 'center',
      lineHeight: 18,
    },
    copyBtn: {
      backgroundColor: '#fff' + '25',
      paddingVertical: 10,
      paddingHorizontal: sizes.lg,
      borderRadius: sizes.borderRadiusFull,
      marginTop: sizes.xs,
    },
    copyBtnDone: { backgroundColor: '#fff' + '40' },
    copyBtnText: { color: '#fff', ...font.semibold, fontSize: 15 },

    sectionLabel: {
      fontSize: 12,
      ...font.semibold,
      color: C.textSecondary,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: -sizes.xs,
    },

    membersList: {
      backgroundColor: C.surface,
      borderRadius: 16,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sizes.md,
      paddingHorizontal: sizes.md,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    avatarImg: { width: 44, height: 44 },
    avatarText: { color: '#fff', fontSize: 17, ...font.bold },
    memberInfo: { flex: 1 },
    memberName: { fontSize: 16, ...font.semibold, color: C.textPrimary },
    memberYou: { fontSize: 13, ...font.regular, color: C.textSecondary, marginTop: 1 },

    emptyCard: {
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: sizes.lg,
      alignItems: 'center',
      gap: sizes.sm,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    emptyTitle: { fontSize: 16, ...font.bold, color: C.textPrimary },
    emptyText: { fontSize: 14, ...font.regular, color: C.textSecondary, textAlign: 'center', lineHeight: 20 },

    infoBox: {
      backgroundColor: C.primary + '0f',
      borderRadius: 12,
      padding: sizes.md,
      borderWidth: 1,
      borderColor: C.primary + '25',
    },
    infoText: { fontSize: 13, ...font.regular, color: C.textSecondary, lineHeight: 19 },
});

export default function HousematesScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const housemates = useHousematesStore((s) => s.housemates);
  const houseName = useHousematesStore((s) => s.houseName);
  const inviteCode = useHousematesStore((s) => s.inviteCode);
  const isLoading = useHousematesStore((s) => s.isLoading);
  const profile = useAuthStore((s) => s.profile);
  const myId = profile?.id ?? '';

  const [copied, setCopied] = useState(false);

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const handleCopy = useCallback(() => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(inviteCode).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [inviteCode]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.centered}>
          <Text style={styles.loadingText}>{t('housemates.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        <ScrollView contentContainerStyle={styles.scroll}>

          <Text style={styles.heading}>{t('housemates.title')}</Text>
          {!!houseName && <Text style={styles.houseName}>{houseName}</Text>}

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

          <Text style={styles.sectionLabel}>{t('housemates.members_section')} ({housemates.length})</Text>

          {housemates.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{t('housemates.just_you')}</Text>
              <Text style={styles.emptyText}>{t('housemates.just_you_hint')}</Text>
            </View>
          ) : (
            <View style={styles.membersList}>
              {housemates.map((h) => {
                const isMe = h.id === myId;
                const initial = (h.name || '?')[0].toUpperCase();
                return (
                  <View key={h.id} style={styles.memberRow}>
                    <View style={[styles.avatar, { backgroundColor: h.avatarUrl ? 'transparent' : (h.color ?? C.primary) }]}>
                      {h.avatarUrl
                        ? <Image source={{ uri: h.avatarUrl }} style={styles.avatarImg} contentFit="cover" />
                        : <Text style={styles.avatarText}>{initial}</Text>
                      }
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

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              {t('housemates.join_instructions')}
            </Text>
          </View>

        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}
