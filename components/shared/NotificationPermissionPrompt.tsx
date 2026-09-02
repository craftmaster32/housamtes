import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { registerPushToken, getNativeNotificationStatus } from '@lib/notifications';
import { enableWebPush, getWebPushStatus } from '@lib/webPush';
import { Alert } from '@lib/alert';
import { hasSeenNotifPrompt, markNotifPromptSeen } from '@utils/permissionPrompt';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { mf, ms } from '@utils/responsive';

interface NotificationPermissionPromptProps {
  // While true, the card stays hidden — used to let the welcome tour finish
  // first so brand-new users don't see two overlays stacked on top of each other.
  blocked?: boolean;
}

// A one-time, friendly card that asks the user to turn on notifications right
// after they sign up — so they don't have to dig into Settings to get reminders.
// The button provides the tap a browser requires before it will show its own
// permission popup. Shows only when notifications aren't already on and we
// haven't asked on this device before.
export function NotificationPermissionPrompt({
  blocked = false,
}: NotificationPermissionPromptProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const userId = useAuthStore((s) => s.user?.id);
  const houseId = useAuthStore((s) => s.houseId);

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const headingFont = useHeadingFont('bold');

  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (blocked || !userId || !houseId) return;
    let active = true;

    const decide = async (): Promise<void> => {
      if (await hasSeenNotifPrompt()) return;

      // Only surface the card when the OS/browser will actually let us ask.
      const canAsk =
        Platform.OS === 'web'
          ? getWebPushStatus() === 'default'
          : (await getNativeNotificationStatus()) === 'undetermined';

      if (!canAsk) {
        // Already granted, hard-blocked, or unsupported — nothing a card can do.
        await markNotifPromptSeen();
        return;
      }
      if (active) setVisible(true);
    };

    decide();
    return (): void => {
      active = false;
    };
  }, [blocked, userId, houseId]);

  const handleEnable = useCallback(async (): Promise<void> => {
    if (!userId || !houseId || busy) return;
    setBusy(true);
    try {
      if (Platform.OS === 'web') {
        const result = await enableWebPush(userId, houseId);
        if (result === 'denied') {
          Alert.alert(
            t('settings.notifications_blocked_title'),
            t('settings.notifications_blocked_body')
          );
        }
      } else {
        // Requests the OS permission and registers the device token.
        await registerPushToken(userId, houseId);
      }
    } catch {
      // Non-fatal — the user can still enable notifications from Settings.
    } finally {
      await markNotifPromptSeen();
      setBusy(false);
      setVisible(false);
    }
  }, [userId, houseId, busy, t]);

  const handleLater = useCallback(async (): Promise<void> => {
    await markNotifPromptSeen();
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleLater}>
      <View style={styles.backdrop} />
      <View style={styles.centerer} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="notifications" size={ms(30)} color={C.primary} />
          </View>
          <Text style={[styles.title, headingFont]}>{t('permissionPrompt.title')}</Text>
          <Text style={styles.body}>{t('permissionPrompt.body')}</Text>

          <Pressable
            onPress={handleEnable}
            disabled={busy}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && styles.primaryBtnPressed,
              busy && styles.btnDisabled,
            ]}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('permissionPrompt.enable')}
            accessibilityState={{ disabled: busy }}
          >
            <Text style={styles.primaryBtnText}>{t('permissionPrompt.enable')}</Text>
          </Pressable>

          <Pressable
            onPress={handleLater}
            disabled={busy}
            style={styles.laterBtn}
            hitSlop={8}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('permissionPrompt.later')}
          >
            <Text style={styles.laterBtnText}>{t('permissionPrompt.later')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(C: ColorTokens): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
    centerer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: ms(24) },
    card: {
      width: '100%',
      maxWidth: ms(360),
      borderRadius: ms(20),
      padding: sizes.xl,
      backgroundColor: C.surface,
      alignItems: 'center',
      gap: sizes.sm,
    },
    iconCircle: {
      width: ms(64),
      height: ms(64),
      borderRadius: ms(32),
      backgroundColor: C.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: sizes.xs,
    },
    title: {
      fontSize: mf(20),
      ...font.extrabold,
      color: C.textPrimary,
      textAlign: 'center',
      letterSpacing: -0.4,
    },
    body: {
      fontSize: mf(15),
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: mf(21),
      marginBottom: sizes.sm,
    },
    primaryBtn: {
      width: '100%',
      minHeight: ms(48),
      borderRadius: sizes.borderRadiusFull,
      backgroundColor: C.primary,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: sizes.lg,
    },
    primaryBtnPressed: { opacity: 0.85 },
    btnDisabled: { opacity: 0.6 },
    primaryBtnText: { fontSize: mf(16), ...font.semibold, color: '#fff' },
    laterBtn: {
      minHeight: ms(44),
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: ms(2),
    },
    laterBtnText: { fontSize: mf(15), ...font.medium, color: C.textSecondary },
  });
}
