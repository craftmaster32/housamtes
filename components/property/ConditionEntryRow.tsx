import React, { useCallback } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useHousematesStore } from '@stores/housematesStore';
import {
  useConditionStore,
  type ConditionEntry,
  type ConditionLevel,
} from '@stores/conditionStore';
import { resolveName } from '@utils/housemates';
import { formatDateDDMMYYYY } from '@utils/dates';
import { conditionLabel, entryTypeLabel } from '@utils/propertyLabels';
import { lightColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHandFont } from '@hooks/useHandFont';
import { PenCircle } from '@components/shared/PenCircle';
import { mf, ms } from '@utils/responsive';

const P = lightColors;

export function levelColor(level: ConditionLevel): string {
  return level === 'good' ? P.positive : level === 'fair' ? P.warning : P.negative;
}

interface ConditionEntryRowProps {
  entry: ConditionEntry;
}

/** One line of the inspection sheet: the verdict circled in its colour, then the notes. */
function ConditionEntryRowComponent({ entry }: ConditionEntryRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const hand = useHandFont();
  const remove = useConditionStore((s) => s.remove);
  const housemates = useHousematesStore((s) => s.housemates);
  const color = levelColor(entry.condition);

  const handleRemove = useCallback((): void => {
    void remove(entry.id);
  }, [entry.id, remove]);

  return (
    <View style={styles.row}>
      <View style={styles.top}>
        <View style={styles.verdict}>
          <PenCircle color={color} style={styles.ring} strokeWidth={2} />
          <Text style={[styles.verdictText, { color }]}>{conditionLabel(t, entry.condition)}</Text>
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {entryTypeLabel(t, entry.type)} · {formatDateDDMMYYYY(entry.date)} ·{' '}
          {t('condition.recorded_by', { name: resolveName(entry.recordedBy, housemates) })}
        </Text>
        <Pressable
          onPress={handleRemove}
          style={styles.remove}
          accessibilityRole="button"
          accessibilityLabel={t('condition.remove_entry')}
        >
          <Ionicons name="close" size={17} color={P.paperMuted} />
        </Pressable>
      </View>
      {entry.description ? <Text style={[styles.notes, hand]}>{entry.description}</Text> : null}
      {entry.photos && entry.photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photos}>
          {entry.photos.map((src, i) => (
            <View key={i} style={styles.print}>
              <Image
                source={{ uri: src }}
                style={styles.thumb}
                contentFit="cover"
                accessibilityLabel={t('condition.photo_label', { n: i + 1 })}
              />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export const ConditionEntryRow = React.memo(ConditionEntryRowComponent);

const styles = StyleSheet.create({
  row: { paddingVertical: ms(8), borderTopWidth: 1, borderTopColor: 'rgba(107,98,80,0.16)' },
  top: { flexDirection: 'row', alignItems: 'center', gap: ms(8) },
  verdict: { paddingHorizontal: ms(8), paddingVertical: ms(5) },
  ring: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    transform: [{ rotate: '-4deg' }],
  },
  verdictText: { fontSize: mf(13.5), ...font.bold },
  meta: { flex: 1, minWidth: 0, fontSize: mf(12), ...font.medium, color: P.paperMuted },
  remove: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  notes: { fontSize: mf(18), lineHeight: mf(22), color: P.paperInk, marginTop: ms(2) },
  photos: { marginTop: ms(8) },
  print: {
    backgroundColor: '#FFFFFF',
    padding: ms(3),
    paddingBottom: ms(8),
    marginEnd: ms(10),
    borderRadius: ms(2),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  thumb: { width: ms(64), height: ms(64) },
});
