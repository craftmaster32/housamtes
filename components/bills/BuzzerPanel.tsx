import { View, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { Housemate } from '@stores/housematesStore';
import { lightColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHandFont } from '@hooks/useHandFont';
import { mf, ms } from '@utils/responsive';

// A brushed-steel door panel: the same in both themes, like the real thing.
const STEEL = '#D5D8DC';
const STEEL_EDGE = '#9EA3AA';
const SLOT = '#FFFDF2';
const P = lightColors;

interface BuzzerPanelProps {
  housemates: Housemate[];
  myId: string;
  canRemove: boolean;
  onRemove: (h: Housemate) => void;
}

/** The house's door buzzer: one name slip per housemate next to their bell. */
export function BuzzerPanel({
  housemates,
  myId,
  canRemove,
  onRemove,
}: BuzzerPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const hand = useHandFont();
  return (
    <View style={styles.panel}>
      {[styles.tl, styles.tr, styles.bl, styles.br].map((pos, i) => (
        <View key={i} style={[styles.screw, pos]} pointerEvents="none">
          <View style={styles.screwSlot} />
        </View>
      ))}
      {housemates.map((h) => {
        const isMe = h.id === myId;
        return (
          <View key={h.id} style={styles.row}>
            <View style={styles.bellRing}>
              <View
                style={[
                  styles.bell,
                  { backgroundColor: h.avatarUrl ? STEEL : (h.color ?? P.primary) },
                ]}
              >
                {h.avatarUrl ? (
                  <Image
                    source={{ uri: h.avatarUrl }}
                    style={styles.bellImg}
                    contentFit="cover"
                    accessibilityLabel={t('members.avatar_of', { name: h.name })}
                  />
                ) : (
                  <Text style={styles.initial}>{(h.name || '?')[0].toUpperCase()}</Text>
                )}
              </View>
            </View>
            <View style={styles.slot}>
              <Text style={[styles.name, hand]} numberOfLines={1}>
                {h.name}
              </Text>
              {isMe && <Text style={styles.you}>{t('housemates.thats_you')}</Text>}
              {canRemove && !isMe && (
                <Pressable
                  style={styles.remove}
                  onPress={() => onRemove(h)}
                  accessibilityRole="button"
                  accessibilityLabel={t('members.remove_member', { name: h.name })}
                >
                  <Text style={styles.removeText}>{t('members.remove')}</Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const BELL = ms(42);

const styles = StyleSheet.create({
  panel: {
    backgroundColor: STEEL,
    borderRadius: ms(14),
    borderWidth: 2,
    borderColor: STEEL_EDGE,
    paddingVertical: ms(18),
    paddingHorizontal: ms(22),
    gap: ms(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(3) },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  screw: {
    position: 'absolute',
    width: ms(10),
    height: ms(10),
    borderRadius: ms(5),
    backgroundColor: '#B4B8BE',
    borderWidth: 1,
    borderColor: STEEL_EDGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screwSlot: {
    width: ms(6),
    height: 1.5,
    backgroundColor: '#7E838A',
    transform: [{ rotate: '35deg' }],
  },
  tl: { top: ms(7), left: ms(7) },
  tr: { top: ms(7), right: ms(7) },
  bl: { bottom: ms(7), left: ms(7) },
  br: { bottom: ms(7), right: ms(7) },
  row: { flexDirection: 'row', alignItems: 'center', gap: ms(12) },
  bellRing: {
    width: BELL + ms(8),
    height: BELL + ms(8),
    borderRadius: (BELL + ms(8)) / 2,
    backgroundColor: '#BFC3C8',
    borderWidth: 1.5,
    borderColor: STEEL_EDGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bell: {
    width: BELL,
    height: BELL,
    borderRadius: BELL / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellImg: { width: BELL, height: BELL },
  initial: { fontSize: mf(17), ...font.bold, color: '#FFFFFF' },
  slot: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    backgroundColor: SLOT,
    borderRadius: ms(4),
    borderWidth: 2,
    borderColor: STEEL_EDGE,
    paddingHorizontal: ms(12),
    minHeight: ms(48),
  },
  name: { flexShrink: 1, fontSize: mf(23), lineHeight: mf(28), color: P.paperInk },
  you: { flex: 1, fontSize: mf(12), ...font.medium, color: P.paperMuted },
  remove: { marginStart: 'auto', minHeight: 44, justifyContent: 'center', paddingStart: ms(6) },
  removeText: { fontSize: mf(13.5), ...font.semibold, color: P.negative },
});
