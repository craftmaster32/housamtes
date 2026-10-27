import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import type { TFunction } from 'i18next';
import type { ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useAuthStore } from '@stores/authStore';
import { Highlight } from './TourHighlight';

// The tour's "Profile & Settings" page: the top of Home with your picture
// spotlit, and the little menu that drops from it — the same pop-up as the app.
const DIM = 0.5;

// Same greeting as the top of Home.
function greetingKey(): string {
  const h = new Date().getHours();
  return h < 12 ? 'greeting_morning' : h < 18 ? 'greeting_afternoon' : 'greeting_evening';
}

interface ScreenProps {
  C: ColorTokens;
  t: TFunction;
}

export function TourProfileScreen({ C, t }: ScreenProps): React.JSX.Element {
  const heading = useHeadingFont('semibold');
  const profile = useAuthStore((s) => s.profile);
  const email = useAuthStore((s) => s.user?.email ?? '');
  const name = profile?.name ?? t('common.you');
  const avatar = (
    <View style={[styles.avatar, { backgroundColor: profile?.avatarColor ?? C.primary }]}>
      <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
  const rows: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string; danger?: boolean }> = [
    { icon: 'person-outline', label: t('nav.profile') },
    { icon: 'settings-outline', label: t('nav.settings') },
    { icon: 'log-out-outline', label: t('profile.sign_out'), danger: true },
  ];
  return (
    <View style={styles.body} pointerEvents="none">
      {/* The top of Home: your picture (spotlit), the house, the bell. */}
      <View style={styles.top}>
        <Highlight C={C} radius={22} circle>
          {avatar}
        </Highlight>
        <View style={[styles.houseLine, { backgroundColor: C.border }]} />
        <View style={[styles.bell, { backgroundColor: C.surface }]}>
          <Ionicons name="notifications-outline" size={21} color={C.textPrimary} />
        </View>
      </View>
      <Text style={[styles.greeting, heading, { color: C.textPrimary }]}>
        {`${t(`dashboard.${greetingKey()}`)}, ${name.split(' ')[0]}`}
      </Text>

      {/* The menu that drops from your picture. */}
      <View style={[styles.panel, { backgroundColor: C.surface }]}>
        <View style={[styles.header, { borderBottomColor: C.border }]}>
          <View
            style={[styles.smallAvatar, { backgroundColor: profile?.avatarColor ?? C.primary }]}
          >
            <Text style={styles.smallAvatarText}>{name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.name, { color: C.textPrimary }]} numberOfLines={1}>
              {name}
            </Text>
            {!!email && (
              <Text style={[styles.email, { color: C.textSecondary }]} numberOfLines={1}>
                {email}
              </Text>
            )}
          </View>
        </View>
        {rows.map((r) => (
          <View key={r.label} style={[styles.row, r.danger && styles.dim]}>
            <Ionicons
              name={r.icon}
              size={18}
              color={r.danger ? C.negative : C.textSecondary}
              style={styles.rowIcon}
            />
            <Text style={[styles.rowLabel, { color: r.danger ? C.negative : C.textPrimary }]}>
              {r.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: sizes.lg, paddingTop: sizes.sm, gap: sizes.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 17, ...font.bold, color: '#FFFFFF' },
  houseLine: { flex: 1, height: 10, borderRadius: 5, opacity: DIM },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: DIM,
  },
  greeting: { fontSize: 30, lineHeight: 38, letterSpacing: -0.5, opacity: DIM },
  // The drop-down menu, as in ProfilePopup.
  panel: {
    alignSelf: 'flex-start',
    width: 230,
    borderRadius: 16,
    paddingVertical: sizes.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sizes.sm,
    paddingHorizontal: sizes.md,
    paddingVertical: sizes.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: sizes.xs,
  },
  smallAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallAvatarText: { fontSize: 15, ...font.bold, color: '#FFFFFF' },
  headerText: { flex: 1 },
  name: { fontSize: sizes.fontSm, ...font.semibold },
  email: { fontSize: sizes.fontXs, ...font.regular, marginTop: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sizes.sm,
    paddingHorizontal: sizes.md,
    minHeight: sizes.touchTarget,
  },
  rowIcon: { width: 20, textAlign: 'center' },
  rowLabel: { flex: 1, fontSize: sizes.fontSm, ...font.medium },
  dim: { opacity: DIM },
});
