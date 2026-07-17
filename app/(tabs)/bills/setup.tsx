import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Animated,
  Alert,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useHousematesStore, type Housemate } from '@stores/housematesStore';
import { useAuthStore } from '@stores/authStore';
import { useBillsStore } from '@stores/billsStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useMemberName } from '@hooks/useMemberName';
import { formatFull } from '@constants/currencies';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

const makeStyles = (C: ColorTokens) =>
  StyleSheet.create({
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
    emptyText: {
      fontSize: 14,
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },

    infoBox: {
      backgroundColor: C.primary + '0f',
      borderRadius: 12,
      padding: sizes.md,
      borderWidth: 1,
      borderColor: C.primary + '25',
    },
    infoText: { fontSize: 13, ...font.regular, color: C.textSecondary, lineHeight: 19 },

    formerList: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.sm },
    formerChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sizes.xs,
      backgroundColor: C.surface,
      borderRadius: sizes.borderRadiusFull,
      paddingVertical: 6,
      paddingHorizontal: sizes.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
    },
    formerDot: { width: 8, height: 8, borderRadius: 4 },
    formerName: { fontSize: 13, ...font.semibold, color: C.textSecondary },

    leftoverHint: {
      fontSize: 13,
      ...font.regular,
      color: C.textSecondary,
      lineHeight: 19,
      marginBottom: -sizes.xs,
    },
    leftoverRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sizes.md,
      paddingHorizontal: sizes.md,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    settleBtn: {
      backgroundColor: C.primary,
      borderRadius: sizes.borderRadiusFull,
      paddingVertical: 8,
      paddingHorizontal: sizes.md,
      minHeight: 44,
      justifyContent: 'center',
    },
    settleBtnBusy: { opacity: 0.6 },
    settleBtnText: { color: '#fff', ...font.semibold, fontSize: 14 },

    removeBtn: {
      paddingVertical: 8,
      paddingHorizontal: sizes.md,
      minHeight: 44,
      justifyContent: 'center',
      borderRadius: sizes.borderRadiusFull,
    },
    removeBtnPressed: { opacity: 0.6 },
    removeBtnText: { color: C.negative, ...font.semibold, fontSize: 14 },

    modalBackdrop: {
      flex: 1,
      backgroundColor: '#00000088',
      justifyContent: 'center',
      alignItems: 'center',
      padding: sizes.lg,
    },
    modalCard: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: C.surface,
      borderRadius: 20,
      padding: sizes.lg,
      gap: sizes.sm,
    },
    modalTitle: { fontSize: 18, ...font.bold, color: C.textPrimary },
    modalBody: { fontSize: 14, ...font.regular, color: C.textSecondary, lineHeight: 20 },
    modalDangerBtn: {
      backgroundColor: C.negative,
      borderRadius: sizes.borderRadiusFull,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: sizes.sm,
    },
    modalDangerText: { color: '#fff', ...font.semibold, fontSize: 15 },
    modalCancelBtn: {
      paddingVertical: 12,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalCancelText: { color: C.textSecondary, ...font.semibold, fontSize: 15 },
  });

export default function HousematesScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const housemates = useHousematesStore((s) => s.housemates);
  const formerMembers = useHousematesStore((s) => s.formerMembers);
  const houseName = useHousematesStore((s) => s.houseName);
  const inviteCode = useHousematesStore((s) => s.inviteCode);
  const isLoading = useHousematesStore((s) => s.isLoading);
  const profile = useAuthStore((s) => s.profile);
  const role = useAuthStore((s) => s.role);
  const houseId = useAuthStore((s) => s.houseId);
  const myId = profile?.id ?? '';
  const isManager = role === 'owner' || role === 'admin';
  // Only the house owner (creator) may remove others — this matches the
  // database policy, so showing it to a plain admin would just fail server-side.
  const isOwner = role === 'owner';

  const bills = useBillsStore((s) => s.bills);
  const billsLoading = useBillsStore((s) => s.isLoading);
  const loadBills = useBillsStore((s) => s.load);
  const settleBill = useBillsStore((s) => s.settleBill);
  const removeMember = useHousematesStore((s) => s.removeMember);
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const memberName = useMemberName();

  const [copied, setCopied] = useState(false);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<Housemate | null>(null);
  const [removing, setRemoving] = useState(false);

  const handleConfirmRemove = useCallback(async (): Promise<void> => {
    if (!houseId || !memberToRemove) return;
    setRemoving(true);
    try {
      await removeMember(houseId, memberToRemove.id, memberToRemove.name, memberToRemove.color);
      setMemberToRemove(null);
    } catch {
      Alert.alert(t('common.error'), t('members.remove_failed'));
    } finally {
      setRemoving(false);
    }
  }, [houseId, memberToRemove, removeMember, t]);

  // Managers need the bill list to clear anything left behind by a departed
  // member. Load it if another screen hasn't already.
  useEffect(() => {
    if (isManager && houseId && bills.length === 0) {
      loadBills(houseId);
    }
  }, [isManager, houseId, bills.length, loadBills]);

  // Unsettled bills that still involve someone who has left or been erased —
  // either as the payer or inside the split. These are what the manager can
  // settle to compensate for the person vanishing.
  const leftoverBills = useMemo(() => {
    if (!isManager) return [];
    const currentIds = new Set(housemates.map((h) => h.id));
    const isGone = (id: string | null): boolean => !id || !currentIds.has(id);
    return bills.filter(
      (b) => !b.settled && (isGone(b.paidBy) || b.splitBetween.some((id) => isGone(id)))
    );
  }, [isManager, bills, housemates]);

  const handleSettle = useCallback(
    async (billId: string): Promise<void> => {
      if (!houseId) return;
      setSettlingId(billId);
      try {
        await settleBill(billId, myId, profile?.name ?? '', houseId);
      } catch {
        Alert.alert(t('common.error'), t('members.settle_failed'));
      } finally {
        setSettlingId(null);
      }
    },
    [houseId, myId, profile?.name, settleBill, t]
  );

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
            <Text style={styles.inviteHint}>{t('housemates.invite_body')}</Text>
            <Pressable
              style={[styles.copyBtn, copied && styles.copyBtnDone]}
              onPress={handleCopy}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('housemates.copy_code')}
            >
              <Text style={styles.copyBtnText}>
                {copied ? t('housemates.copied') : t('housemates.copy_code')}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.sectionLabel}>
            {t('housemates.members_section')} ({housemates.length})
          </Text>

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
                    <View
                      style={[
                        styles.avatar,
                        { backgroundColor: h.avatarUrl ? 'transparent' : (h.color ?? C.primary) },
                      ]}
                    >
                      {h.avatarUrl ? (
                        <Image
                          source={{ uri: h.avatarUrl }}
                          style={styles.avatarImg}
                          contentFit="cover"
                          accessibilityLabel={t('members.avatar_of', { name: h.name })}
                        />
                      ) : (
                        <Text style={styles.avatarText}>{initial}</Text>
                      )}
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{h.name}</Text>
                      {isMe && <Text style={styles.memberYou}>{t('housemates.thats_you')}</Text>}
                    </View>
                    {isOwner && !isMe && (
                      <Pressable
                        style={({ pressed }) => [
                          styles.removeBtn,
                          pressed && styles.removeBtnPressed,
                        ]}
                        onPress={() => setMemberToRemove(h)}
                        accessible
                        accessibilityRole="button"
                        accessibilityLabel={t('members.remove_member', { name: h.name })}
                      >
                        <Text style={styles.removeBtnText}>{t('members.remove')}</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {isManager && (formerMembers.length > 0 || leftoverBills.length > 0) && (
            <>
              <Text style={styles.sectionLabel}>{t('members.left_section')}</Text>

              {formerMembers.length > 0 && (
                <View style={styles.formerList}>
                  {formerMembers.map((f) => (
                    <View key={f.id} style={styles.formerChip}>
                      <View style={[styles.formerDot, { backgroundColor: f.color }]} />
                      <Text style={styles.formerName}>
                        {t('members.name_left', { name: f.name })}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {leftoverBills.length > 0 ? (
                <>
                  <Text style={styles.leftoverHint}>{t('members.settle_hint')}</Text>
                  <View style={styles.membersList}>
                    {leftoverBills.map((b) => (
                      <View key={b.id} style={styles.leftoverRow}>
                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName} numberOfLines={1}>
                            {b.title}
                          </Text>
                          <Text style={styles.memberYou} numberOfLines={1}>
                            {t('members.leftover_bill_meta', {
                              name: memberName(b.paidBy),
                              amount: formatFull(b.amount, currencyCode),
                            })}
                          </Text>
                        </View>
                        <Pressable
                          style={[styles.settleBtn, settlingId === b.id && styles.settleBtnBusy]}
                          onPress={() => handleSettle(b.id)}
                          disabled={settlingId === b.id}
                          accessible
                          accessibilityRole="button"
                          accessibilityLabel={t('members.settle')}
                          accessibilityState={{
                            disabled: settlingId === b.id,
                            busy: settlingId === b.id,
                          }}
                        >
                          <Text style={styles.settleBtnText}>
                            {settlingId === b.id ? t('members.settling') : t('members.settle')}
                          </Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </>
              ) : billsLoading ? (
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>{t('members.checking_bills')}</Text>
                </View>
              ) : (
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>{t('members.nothing_to_settle')}</Text>
                </View>
              )}
            </>
          )}

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>{t('housemates.join_instructions')}</Text>
          </View>
        </ScrollView>

        {/* Remove-member confirmation */}
        <Modal
          visible={memberToRemove !== null}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!removing) setMemberToRemove(null);
          }}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              if (!removing) setMemberToRemove(null);
            }}
          >
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Text style={styles.modalTitle}>
                {t('members.remove_title', { name: memberToRemove?.name ?? '' })}
              </Text>
              <Text style={styles.modalBody}>{t('members.remove_body')}</Text>
              <Pressable
                style={[styles.modalDangerBtn, removing && styles.settleBtnBusy]}
                onPress={handleConfirmRemove}
                disabled={removing}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('members.yes_remove')}
                accessibilityState={{ disabled: removing, busy: removing }}
              >
                <Text style={styles.modalDangerText}>
                  {removing ? t('members.removing') : t('members.yes_remove')}
                </Text>
              </Pressable>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setMemberToRemove(null)}
                disabled={removing}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
                accessibilityState={{ disabled: removing }}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </Animated.View>
    </SafeAreaView>
  );
}
