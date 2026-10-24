import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, Pattern, Path, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { lightColors, useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { mf, ms } from '@utils/responsive';

// A laminated house-member card: light in both themes.
const P = lightColors;
const CARD = '#FFFDF7';

interface IdCardProps {
  name: string;
  email: string;
  houseName: string;
  avatarUrl?: string | null;
  avatarColor: string;
  coverUrl?: string | null;
  uploading: boolean;
  uploadingCover: boolean;
  onAvatarPress: () => void;
  onCoverPress: () => void;
}

/**
 * The profile as a member card on a lanyard: the cover photo across the top,
 * a passport-style photo, the name in Fraunces and the house in handwriting.
 */
export function IdCard({
  name,
  email,
  houseName,
  avatarUrl,
  avatarColor,
  coverUrl,
  uploading,
  uploadingCover,
  onAvatarPress,
  onCoverPress,
}: IdCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const heading = useHeadingFont('semibold');
  const hand = useHandFont();
  const initial = (name || '?').trim().charAt(0).toUpperCase();

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.cover}
        onPress={onCoverPress}
        disabled={uploadingCover}
        accessibilityRole="button"
        accessibilityLabel={t('profile.change_cover_photo')}
      >
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            accessibilityLabel={t('profile.cover_photo')}
          />
        ) : (
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <Pattern id="idcard-guilloche" width={22} height={12} patternUnits="userSpaceOnUse">
                <Path
                  d="M0 6 Q5.5 0 11 6 T22 6"
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth={1}
                  fill="none"
                />
              </Pattern>
            </Defs>
            <Rect width="100%" height="100%" fill={P.primary} />
            <Rect width="100%" height="100%" fill="url(#idcard-guilloche)" />
          </Svg>
        )}
        {uploadingCover && (
          <View style={styles.busy}>
            <ActivityIndicator color="#FFFFFF" size="small" />
          </View>
        )}
        {/* The punched slot the lanyard goes through. */}
        <View style={[styles.slot, { backgroundColor: c.background }]} />
        <View style={styles.coverBadge}>
          <Ionicons name="image-outline" size={13} color={P.paperInk} />
        </View>
      </Pressable>

      <View style={styles.body}>
        <Pressable
          style={styles.photoWrap}
          onPress={onAvatarPress}
          disabled={uploading}
          accessibilityRole="button"
          accessibilityLabel={t('profile.change_profile_photo')}
        >
          <View style={[styles.photo, { backgroundColor: avatarUrl ? '#E9E4DA' : avatarColor }]}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.photoImg}
                contentFit="cover"
                accessibilityLabel={t('profile.profile_photo')}
              />
            ) : (
              <Text style={[styles.initial, heading]}>{initial}</Text>
            )}
            {uploading && (
              <View style={styles.busy}>
                <ActivityIndicator color="#FFFFFF" size="small" />
              </View>
            )}
          </View>
          <View style={styles.photoBadge}>
            <Ionicons name="camera" size={13} color={P.paperInk} />
          </View>
        </Pressable>

        <View style={styles.copy}>
          <Text style={[styles.member, hand]} numberOfLines={1}>
            {t('profile.member_of', { house: houseName })}
          </Text>
          <Text style={[styles.name, heading]} numberOfLines={2}>
            {name}
          </Text>
          {!!email && (
            <Text style={styles.email} numberOfLines={1}>
              {email}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const PHOTO = ms(92);

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD,
    borderRadius: ms(18),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(4) },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  cover: { height: ms(96), alignSelf: 'stretch', alignItems: 'center', overflow: 'hidden' },
  slot: {
    position: 'absolute',
    top: ms(12),
    width: ms(46),
    height: ms(9),
    borderRadius: ms(5),
  },
  coverBadge: {
    position: 'absolute',
    end: ms(10),
    bottom: ms(10),
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,253,247,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  busy: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ms(14),
    paddingHorizontal: ms(16),
    paddingBottom: ms(16),
  },
  photoWrap: { marginTop: -ms(36) },
  photo: {
    width: PHOTO,
    height: PHOTO * 1.15,
    borderRadius: ms(8),
    borderWidth: 4,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImg: { width: '100%', height: '100%' },
  initial: { fontSize: mf(40), lineHeight: mf(50), color: '#FFFFFF' },
  photoBadge: {
    position: 'absolute',
    end: -ms(6),
    bottom: -ms(4),
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: CARD,
    borderWidth: 1.5,
    borderColor: 'rgba(107,98,80,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0, paddingTop: ms(10), paddingBottom: ms(2) },
  member: { fontSize: mf(18), lineHeight: mf(21), color: P.paperMuted },
  name: { fontSize: mf(26), lineHeight: mf(32), color: P.paperInk, letterSpacing: -0.4 },
  email: { fontSize: mf(13), ...font.regular, color: P.paperMuted },
});
