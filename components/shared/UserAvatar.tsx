import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useHousematesStore } from '@stores/housematesStore';
import { colors } from '@constants/colors';
import { font } from '@constants/typography';

function nameToColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors.avatar[Math.abs(h) % colors.avatar.length];
}

export interface UserAvatarProps {
  userId: string;
  size?: number;
}

export function UserAvatar({ userId, size = 24 }: UserAvatarProps): React.JSX.Element {
  const { t } = useTranslation();
  const housemate   = useHousematesStore((s) => s.housemates.find((h) => h.id === userId));
  const avatarUrl   = housemate?.avatarUrl ?? null;
  const displayName = housemate?.name ?? '?';
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarUrl ? 'transparent' : nameToColor(displayName) }]}>
      {avatarUrl
        ? <Image source={{ uri: avatarUrl }} style={{ width: size, height: size }} contentFit="cover" accessibilityLabel={t('profile.profile_photo')} />
        : <Text style={[styles.initialText, { fontSize: Math.round(size * 0.44) }]}>{displayName[0].toUpperCase()}</Text>
      }
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  initialText: { color: '#fff', ...font.bold },
});
