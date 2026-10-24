import { useState, useCallback, useMemo, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { Alert } from '@lib/alert';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { withFeatureGuard } from '@components/shared/withFeatureGuard';
import { useHousematesStore, type Housemate } from '@stores/housematesStore';
import { useAuthStore } from '@stores/authStore';
import { useBillsStore } from '@stores/billsStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useMemberName } from '@hooks/useMemberName';
import { formatFull } from '@constants/currencies';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { BackLink } from '@components/shared/BackLink';
import { LoadingSpinner } from '@components/shared/LoadingSpinner';
import { Mate } from '@components/shared/Mate';
import { BuzzerPanel } from '@components/bills/BuzzerPanel';
import { InviteTicket } from '@components/bills/InviteTicket';
import { SettingsDialog, DialogButton } from '@components/settings/SettingsDialog';
import { asWord } from '@utils/asWord';
import { mf, ms } from '@utils/responsive';

function HousematesScreen(): React.JSX.Element {
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
    const formerIds = new Set(formerMembers.map((f) => f.id));
    // "Gone" = no payer at all (erased account, reference blanked) or a known
    // departed member. Deriving from formerMembers rather than "absent from the
    // current list" avoids flagging a live member whose profile failed to load.
    const isGone = (id: string | null): boolean => !id || formerIds.has(id);
    return bills.filter(
      (b) => !b.settled && (isGone(b.paidBy) || b.splitBetween.some((id) => isGone(id)))
    );
  }, [isManager, bills, formerMembers]);

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
  const headingFont = useHeadingFont('semibold');
  const hand = useHandFont();

  const handleCopy = useCallback(() => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(inviteCode).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [inviteCode]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <BackLink label={t('common.back')} />
        <Text style={[styles.title, headingFont]}>{t('housemates.title')}</Text>
        {!!houseName && <Text style={[styles.house, hand]}>{houseName}</Text>}

        {isLoading ? (
          <View style={styles.loading}>
            <LoadingSpinner accessibilityLabel={t('housemates.loading')} />
          </View>
        ) : (
          <>
            <InviteTicket code={inviteCode} copied={copied} onCopy={handleCopy} />

            <Text style={[styles.section, headingFont]}>
              {asWord(t('housemates.members_section'))} ({housemates.length})
            </Text>
            {housemates.length === 0 ? (
              <View style={styles.empty}>
                <Mate size={ms(80)} />
                <Text style={[styles.emptyTitle, hand]}>{t('housemates.just_you')}</Text>
                <Text style={styles.small}>{t('housemates.just_you_hint')}</Text>
              </View>
            ) : (
              <BuzzerPanel
                housemates={housemates}
                myId={myId}
                canRemove={isOwner}
                onRemove={setMemberToRemove}
              />
            )}

            {isManager && (formerMembers.length > 0 || leftoverBills.length > 0) && (
              <>
                <Text style={[styles.section, headingFont]}>{t('members.left_section')}</Text>
                {formerMembers.length > 0 && (
                  <View style={styles.former}>
                    {formerMembers.map((f) => (
                      <Text key={f.id} style={[styles.formerName, hand, { color: f.color }]}>
                        {t('members.name_left', { name: f.name })}
                      </Text>
                    ))}
                  </View>
                )}
                {leftoverBills.length > 0 ? (
                  <>
                    <Text style={styles.small}>{t('members.settle_hint')}</Text>
                    <View style={styles.card}>
                      {leftoverBills.map((b, i) => (
                        <View
                          key={b.id}
                          style={[styles.billRow, i < leftoverBills.length - 1 && styles.ruled]}
                        >
                          <View style={styles.billInfo}>
                            <Text style={styles.billTitle} numberOfLines={1}>
                              {b.title}
                            </Text>
                            <Text style={styles.small} numberOfLines={1}>
                              {t('members.leftover_bill_meta', {
                                name: memberName(b.paidBy),
                                amount: formatFull(b.amount, currencyCode),
                              })}
                            </Text>
                          </View>
                          <Pressable
                            style={[styles.link, settlingId !== null && styles.dim]}
                            onPress={() => handleSettle(b.id)}
                            disabled={settlingId !== null}
                            accessibilityRole="button"
                            accessibilityLabel={t('members.settle')}
                            accessibilityState={{
                              disabled: settlingId !== null,
                              busy: settlingId === b.id,
                            }}
                          >
                            <Text style={styles.linkText}>
                              {settlingId === b.id ? t('members.settling') : t('members.settle')}
                            </Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  </>
                ) : (
                  <Text style={styles.small}>
                    {billsLoading ? t('members.checking_bills') : t('members.nothing_to_settle')}
                  </Text>
                )}
              </>
            )}

            <Text style={[styles.small, styles.footer]}>{t('housemates.join_instructions')}</Text>
          </>
        )}
      </ScrollView>

      <SettingsDialog
        visible={memberToRemove !== null}
        onClose={() => {
          if (!removing) setMemberToRemove(null);
        }}
        title={t('members.remove_title', { name: memberToRemove?.name ?? '' })}
        body={t('members.remove_body')}
      >
        <DialogButton
          kind="danger"
          label={removing ? t('members.removing') : t('members.yes_remove')}
          onPress={handleConfirmRemove}
          disabled={removing}
        />
        <DialogButton
          kind="link"
          label={t('common.cancel')}
          onPress={() => setMemberToRemove(null)}
          disabled={removing}
        />
      </SettingsDialog>
    </SafeAreaView>
  );
}

export default withFeatureGuard('bills', HousematesScreen);

const makeStyles = (C: ColorTokens): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    scroll: { paddingHorizontal: ms(20), paddingTop: ms(8), paddingBottom: ms(60) },
    title: {
      fontSize: mf(36),
      lineHeight: mf(46),
      paddingBottom: ms(2),
      letterSpacing: -0.5,
      marginTop: ms(4),
      color: C.textPrimary,
    },
    house: { fontSize: mf(21), lineHeight: mf(25), color: C.textSecondary, marginBottom: ms(16) },
    loading: { paddingVertical: ms(60), alignItems: 'center' },
    section: {
      fontSize: mf(22),
      lineHeight: mf(29),
      marginTop: ms(26),
      marginBottom: ms(12),
      color: C.textPrimary,
    },
    empty: { alignItems: 'center', gap: ms(8), paddingVertical: ms(10) },
    emptyTitle: { fontSize: mf(22), lineHeight: mf(26), color: C.textPrimary },
    small: { fontSize: mf(13), lineHeight: mf(19), ...font.regular, color: C.textSecondary },
    former: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(14), marginBottom: ms(10) },
    formerName: { fontSize: mf(20), textDecorationLine: 'line-through' },
    card: {
      backgroundColor: C.surface,
      borderRadius: ms(18),
      paddingHorizontal: ms(16),
      marginTop: ms(10),
    },
    billRow: { flexDirection: 'row', alignItems: 'center', gap: ms(10), minHeight: 60 },
    ruled: { borderBottomWidth: 1, borderBottomColor: C.border },
    billInfo: { flex: 1, minWidth: 0 },
    billTitle: { fontSize: mf(15), ...font.semibold, color: C.textPrimary },
    link: { minHeight: 44, justifyContent: 'center', paddingStart: ms(8) },
    linkText: { fontSize: mf(14.5), ...font.semibold, color: C.primary },
    dim: { opacity: 0.5 },
    footer: { textAlign: 'center', marginTop: ms(26) },
  });
