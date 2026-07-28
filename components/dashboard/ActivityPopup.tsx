import { useCallback } from 'react';
import { View, Text, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useMemberName } from '@hooks/useMemberName';
import { useHouseActivity, type ActivityEntry, type ActivityTone } from '@hooks/useHouseActivity';

interface ActivityPopupProps {
  visible: boolean;
  onClose: () => void;
}

function timeAgo(iso: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return t('common.just_now');
  if (mins < 60) return t('common.minutes_ago', { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('common.hours_ago', { n: hrs });
  return new Date(iso).toLocaleDateString();
}

export function ActivityPopup({ visible, onClose }: ActivityPopupProps): React.JSX.Element {
  const c = useThemedColors();
  const { t } = useTranslation();
  const memberName = useMemberName();
  const insets = useSafeAreaInsets();
  const entries = useHouseActivity();

  const toneColor: Record<ActivityTone, string> = {
    primary: c.primary,
    success: c.positive,
    warning: c.warning,
    purple: '#9B7BFF',
  };

  const handlePress = useCallback(
    (route: Href): void => {
      onClose();
      router.push(route);
    },
    [onClose]
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
      >
        <Pressable
          style={[
            styles.panel,
            { top: insets.top + 54, backgroundColor: c.surface, borderColor: c.border },
          ]}
          onPress={() => {}}
          accessible={false}
        >
          <Text style={[styles.title, { color: c.textPrimary }]}>{t('activity.title')}</Text>

          {entries.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={22} color={c.textTertiary} />
              <Text style={[styles.emptyText, { color: c.textSecondary }]}>
                {t('activity.empty')}
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {entries.map((e: ActivityEntry) => {
                const color = toneColor[e.tone];
                const actor = memberName(e.actorId).split(' ')[0];
                return (
                  <Pressable
                    key={e.id}
                    style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
                    onPress={() => handlePress(e.route)}
                    accessibilityRole="button"
                  >
                    <View style={[styles.iconWrap, { backgroundColor: color + '1F' }]}>
                      <Ionicons name={e.icon} size={16} color={color} />
                    </View>
                    <View style={styles.rowBody}>
                      <Text style={[styles.rowText, { color: c.textPrimary }]} numberOfLines={2}>
                        <Text style={font.bold}>{actor}</Text> {t(e.actionKey)}
                      </Text>
                      {!!e.detail && (
                        <Text
                          style={[styles.rowDetail, { color: c.textSecondary }]}
                          numberOfLines={1}
                        >
                          {e.detail}
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.time, { color: c.textTertiary }]}>
                      {timeAgo(e.createdAt, t)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  panel: {
    position: 'absolute',
    right: 14,
    left: 14,
    maxWidth: 400,
    alignSelf: 'flex-end',
    maxHeight: '70%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 12,
  },
  title: { fontSize: 16, ...font.extrabold, marginBottom: 8, letterSpacing: -0.3 },
  list: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowText: { fontSize: 13.5, ...font.regular, lineHeight: 18 },
  rowDetail: { fontSize: 12, ...font.regular, marginTop: 1 },
  time: { fontSize: 11, ...font.medium, flexShrink: 0 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 26 },
  emptyText: { fontSize: 13, ...font.medium },
});
