import { View } from 'react-native';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { useHousematesStore } from '@stores/housematesStore';
import { colors } from '@constants/colors';
import { font } from '@constants/typography';

function nameToColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors.avatar[Math.abs(h) % colors.avatar.length];
}

interface UserAvatarProps {
  userId: string;
  size?: number;
}

export function UserAvatar({ userId, size = 24 }: UserAvatarProps): React.JSX.Element {
  const housemate   = useHousematesStore((s) => s.housemates.find((h) => h.id === userId));
  const avatarUrl   = housemate?.avatarUrl ?? null;
  const displayName = housemate?.name ?? '?';
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: avatarUrl ? 'transparent' : nameToColor(displayName), justifyContent: 'center', alignItems: 'center', flexShrink: 0 }]}>
      {avatarUrl
        ? <Image source={{ uri: avatarUrl }} style={{ width: size, height: size }} contentFit="cover" />
        : <Text style={[{ color: '#fff', ...font.bold, fontSize: Math.round(size * 0.44) }]}>{displayName[0].toUpperCase()}</Text>
      }
    </View>
  );
}
