import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { lightColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHandFont } from '@hooks/useHandFont';
import { Filmstrip } from '@components/photos/Filmstrip';
import type { Photo } from '@stores/photoStore';
import { mf, ms } from '@utils/responsive';

type ActionIcon = 'download-outline' | 'trash-outline' | 'flag-outline';

interface ToolProps {
  icon: ActionIcon;
  label: string;
  a11yLabel: string;
  color: string;
  busy?: boolean;
  onPress: () => void;
}

function Tool({
  icon,
  label,
  a11yLabel,
  color,
  busy = false,
  onPress,
}: ToolProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [styles.tool, pressed && styles.toolPressed]}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ busy, disabled: busy }}
    >
      {busy ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Ionicons name={icon} size={24} color={color} />
      )}
      <Text style={[styles.toolText, { color }]}>{label}</Text>
    </Pressable>
  );
}

interface ViewerBottomBarProps {
  photos: Photo[];
  current: number;
  caption: string | null;
  isMine: boolean;
  isDownloading: boolean;
  bottomInset: number;
  labelFor: (photo: Photo) => string;
  onPick: (index: number) => void;
  onDownload: () => void;
  onDelete: () => void;
  onReport: () => void;
}

/**
 * Under the open photo: its caption handwritten on a strip of tape, the
 * thumbnail strip, then Save · "3 of 12" · Delete (or Report for others' photos).
 */
export function ViewerBottomBar({
  photos,
  current,
  caption,
  isMine,
  isDownloading,
  bottomInset,
  labelFor,
  onPick,
  onDownload,
  onDelete,
  onReport,
}: ViewerBottomBarProps): React.JSX.Element {
  const { t } = useTranslation();
  const hand = useHandFont();
  return (
    <View style={[styles.wrap, { paddingBottom: bottomInset }]} pointerEvents="box-none">
      {!!caption && (
        <View style={styles.tape}>
          <Text style={[styles.caption, hand]} numberOfLines={3}>
            {caption}
          </Text>
        </View>
      )}
      {photos.length > 1 && (
        <Filmstrip photos={photos} current={current} onPick={onPick} labelFor={labelFor} />
      )}
      <View style={styles.tools}>
        <Tool
          icon="download-outline"
          label={t('common.save')}
          a11yLabel={t('photos.download_photo')}
          color="#FFFFFF"
          busy={isDownloading}
          onPress={onDownload}
        />
        <Text style={styles.counter}>
          {photos.length > 1 ? `${current + 1} / ${photos.length}` : ''}
        </Text>
        {isMine ? (
          <Tool
            icon="trash-outline"
            label={t('common.delete')}
            a11yLabel={t('photos.delete_photo')}
            color="#FF8A84"
            onPress={onDelete}
          />
        ) : (
          <Tool
            icon="flag-outline"
            label={t('photos.report_action')}
            a11yLabel={t('photos.report_title')}
            color="rgba(255,255,255,0.85)"
            onPress={onReport}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: ms(36), gap: ms(12) },
  tape: {
    alignSelf: 'center',
    maxWidth: '86%',
    backgroundColor: 'rgba(236,222,170,0.94)',
    paddingHorizontal: ms(16),
    paddingVertical: ms(3),
    transform: [{ rotate: '-1.2deg' }],
  },
  caption: {
    fontSize: mf(21),
    lineHeight: mf(26),
    color: lightColors.paperInk,
    textAlign: 'center',
  },
  tools: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ms(18),
  },
  tool: {
    minWidth: ms(72),
    minHeight: 52,
    borderRadius: ms(14),
    alignItems: 'center',
    justifyContent: 'center',
    gap: ms(3),
  },
  toolPressed: { backgroundColor: 'rgba(255,255,255,0.12)' },
  toolText: { fontSize: mf(12), ...font.semibold },
  counter: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: mf(13),
    ...font.semibold,
    fontVariant: ['tabular-nums'],
  },
});
