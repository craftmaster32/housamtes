import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { mf, ms } from '@utils/responsive';

interface PhotosHeaderProps {
  isSelectMode: boolean;
  allSelected: boolean;
  /** Hide "Select" when there's nothing to pick. */
  canSelect: boolean;
  onStartSelect: () => void;
  onToggleAll: () => void;
  onCancelSelect: () => void;
  onCamera: () => void;
  onLibrary: () => void;
}

/**
 * "Photos" title with the gallery controls beside it: Select · camera · library,
 * or — while picking — Select all · Cancel, like a phone's photo app.
 */
export function PhotosHeader({
  isSelectMode,
  allSelected,
  canSelect,
  onStartSelect,
  onToggleAll,
  onCancelSelect,
  onCamera,
  onLibrary,
}: PhotosHeaderProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const headingFont = useHeadingFont('semibold');

  return (
    <View style={styles.header}>
      <Text style={[styles.title, headingFont, { color: c.textPrimary }]}>{t('photos.title')}</Text>
      {isSelectMode ? (
        <View style={styles.actions}>
          <Pressable
            onPress={onToggleAll}
            style={({ pressed }) => [styles.word, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={[styles.wordText, { color: c.primary }]}>
              {allSelected ? t('photos.deselect_all') : t('photos.select_all')}
            </Text>
          </Pressable>
          <Pressable
            onPress={onCancelSelect}
            style={({ pressed }) => [
              styles.pill,
              { backgroundColor: c.surface },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
          >
            <Text style={[styles.pillText, { color: c.textPrimary }]}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.actions}>
          {canSelect && (
            <Pressable
              onPress={onStartSelect}
              style={({ pressed }) => [
                styles.pill,
                { backgroundColor: c.surface },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              <Text style={[styles.pillText, { color: c.primary }]}>{t('photos.select')}</Text>
            </Pressable>
          )}
          <Pressable
            onPress={onCamera}
            style={({ pressed }) => [
              styles.round,
              { backgroundColor: c.surface },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('photos.take_photo')}
          >
            <Ionicons name="camera-outline" size={22} color={c.primary} />
          </Pressable>
          <Pressable
            onPress={onLibrary}
            style={({ pressed }) => [
              styles.round,
              { backgroundColor: c.surface },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('photos.choose_from_library')}
          >
            <Ionicons name="images-outline" size={22} color={c.primary} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: {
    flexShrink: 1,
    fontSize: mf(36),
    lineHeight: mf(46),
    paddingBottom: ms(2),
    letterSpacing: -0.5,
    marginTop: ms(4),
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: ms(8) },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pill: {
    height: 44,
    paddingHorizontal: ms(16),
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillText: { fontSize: mf(15), ...font.semibold },
  word: { minHeight: 44, justifyContent: 'center', paddingHorizontal: ms(6) },
  wordText: { fontSize: mf(15), ...font.semibold },
  pressed: { opacity: 0.7 },
});
