import { useCallback, useState } from 'react';
import { View, StyleSheet, Pressable, type LayoutChangeEvent } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { UserAvatar } from '@components/shared/UserAvatar';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { mf, ms } from '@utils/responsive';

interface HouseKeyTagProps {
  houseName: string;
  memberIds: string[];
  inviteCode: string | null;
  onOpenHousemates: () => void;
  onShareCode: () => void;
}

const NOTCH = ms(28); // how far the pointed end reaches in
const MAX_FACES = 5;

// A cream key tag: pointed end with a metal ring, the house name and faces.
// The invite code is a blue ticket stub taped onto its far end.
export function HouseKeyTag({
  houseName,
  memberIds,
  inviteCode,
  onOpenHousemates,
  onShareCode,
}: HouseKeyTagProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const heading = useHeadingFont('semibold');
  const hand = useHandFont();
  const rtl = isRTL(useLanguageStore((s) => s.language));
  const [size, setSize] = useState({ w: 0, h: 0 });

  const handleLayout = useCallback((e: LayoutChangeEvent): void => {
    const { width, height } = e.nativeEvent.layout;
    setSize((s) => (s.w === width && s.h === height ? s : { w: width, h: height }));
  }, []);

  const { w, h } = size;
  const r = ms(16);
  // Drawn left-to-right; mirrored for right-to-left so the ring leads.
  const tagPath =
    w > 0
      ? `M${NOTCH} 0 H${w - r} Q${w} 0 ${w} ${r} V${h - r} Q${w} ${h} ${w - r} ${h} H${NOTCH} ` +
        `L0 ${h * 0.7} V${h * 0.3} Z`
      : '';
  const faces = memberIds.slice(0, MAX_FACES);

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onOpenHousemates}
        onLayout={handleLayout}
        style={({ pressed }) => [styles.tag, pressed && styles.pressed]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${t('settings.house_name')}: ${houseName || '—'}. ${t(
          'settings.housemates'
        )}, ${t('common.person', { count: memberIds.length })}`}
      >
        {w > 0 && (
          <Svg
            width={w}
            height={h}
            style={[StyleSheet.absoluteFill, rtl && styles.mirror]}
            pointerEvents="none"
          >
            <Path d={tagPath} fill={c.paper} />
          </Svg>
        )}
        <View
          style={[styles.ring, rtl ? styles.ringRtl : styles.ringLtr, { borderColor: '#A39D92' }]}
        >
          <View style={[styles.hole, { backgroundColor: c.background }]} />
        </View>
        <Text style={[styles.caption, { color: c.paperMuted }]}>{t('settings.house_name')}</Text>
        <Text style={[styles.name, heading, { color: c.paperInk }]} numberOfLines={1}>
          {houseName || '—'}
        </Text>
        <View style={styles.mates}>
          <View style={styles.faces}>
            {faces.map((id, i) => (
              <View
                key={id}
                style={[styles.face, { borderColor: c.paper }, i > 0 && styles.faceOverlap]}
              >
                <UserAvatar userId={id} size={ms(26)} />
              </View>
            ))}
          </View>
          <Text style={[styles.count, hand, { color: c.primary }]}>
            {t('common.person', { count: memberIds.length })} {rtl ? '‹' : '›'}
          </Text>
        </View>
      </Pressable>

      {!!inviteCode && (
        <Pressable
          onPress={onShareCode}
          style={({ pressed }) => [
            styles.ticket,
            rtl ? styles.ticketRtl : styles.ticketLtr,
            { backgroundColor: c.note },
            pressed && styles.pressed,
          ]}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`${t('settings.invite_code')}: ${inviteCode}`}
          accessibilityHint={t('settings.invite_code_sub')}
        >
          <View style={[styles.perforation, rtl ? styles.perfRtl : styles.perfLtr]}>
            {Array.from({ length: 7 }, (_, i) => (
              <View key={i} style={[styles.perfHole, { backgroundColor: c.background }]} />
            ))}
          </View>
          <Text style={[styles.ticketCaption, { color: c.noteInk }]}>
            {t('settings.invite_code')}
          </Text>
          <Text style={[styles.code, heading, { color: c.noteInk }]} numberOfLines={1}>
            {inviteCode}
          </Text>
          <Text style={[styles.ticketHint, hand, { color: c.noteInk }]} numberOfLines={2}>
            {t('settings.invite_code_sub')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: ms(14), paddingTop: ms(4) },
  tag: {
    minHeight: ms(104),
    paddingVertical: ms(16),
    paddingStart: ms(56),
    paddingEnd: ms(120),
    transform: [{ rotate: '-1deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(5) },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  mirror: { transform: [{ scaleX: -1 }] },
  ring: {
    position: 'absolute',
    top: '50%',
    marginTop: -ms(11),
    width: ms(22),
    height: ms(22),
    borderRadius: ms(11),
    borderWidth: ms(3),
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLtr: { left: ms(18) },
  ringRtl: { right: ms(18) },
  hole: { width: ms(10), height: ms(10), borderRadius: ms(5) },
  caption: { fontSize: mf(12.5), ...font.semibold },
  name: { fontSize: mf(21), lineHeight: mf(28), marginTop: ms(2), letterSpacing: -0.3 },
  mates: { flexDirection: 'row', alignItems: 'center', gap: ms(12), marginTop: ms(8) },
  faces: { flexDirection: 'row' },
  face: { borderWidth: 2, borderRadius: ms(15) },
  faceOverlap: { marginStart: -ms(8) },
  count: { fontSize: mf(20) },
  ticket: {
    position: 'absolute',
    top: ms(20),
    width: ms(104),
    paddingVertical: ms(9),
    paddingStart: ms(14),
    paddingEnd: ms(6),
    borderRadius: ms(4),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(3) },
    shadowOpacity: 0.12,
    shadowRadius: 5,
  },
  ticketLtr: { right: -ms(4), transform: [{ rotate: '2.5deg' }] },
  ticketRtl: { left: -ms(4), transform: [{ rotate: '-2.5deg' }] },
  // Punched holes down the torn edge, in the page colour.
  perforation: {
    position: 'absolute',
    top: ms(4),
    bottom: ms(4),
    justifyContent: 'space-between',
  },
  perfLtr: { left: -ms(3) },
  perfRtl: { right: -ms(3) },
  perfHole: { width: ms(6), height: ms(6), borderRadius: ms(3) },
  ticketCaption: { fontSize: mf(11.5), ...font.semibold, opacity: 0.8 },
  code: { fontSize: mf(16), letterSpacing: 0.8, marginVertical: ms(3), writingDirection: 'ltr' },
  ticketHint: { fontSize: mf(15), textAlign: 'center', lineHeight: mf(17) },
  pressed: { opacity: 0.75 },
});
