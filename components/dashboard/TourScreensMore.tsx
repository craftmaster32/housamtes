import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import type { TFunction } from 'i18next';
import { lightColors, type ColorTokens } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { SpotCard } from '@components/parking/SpotCard';
import { DayTiles } from '@components/parking/DayTiles';
import { TasksGlance } from '@components/tasks/TasksGlance';
import { PhotosHeader } from '@components/photos/PhotosHeader';
import { TapeLabel } from '@components/photos/TapeLabel';
import { Highlight } from './TourHighlight';

// The tour's pages for Parking, Tasks and Photos — the real app pieces, shown
// faintly, with the spotlight on the one thing to try.
const DIM = 0.5;
const P = lightColors;
const noop = (): void => {};

interface ScreenProps {
  C: ColorTokens;
  t: TFunction;
}

function Title({ C, title }: { C: ColorTokens; title: string }): React.JSX.Element {
  const heading = useHeadingFont('semibold');
  return (
    <Text style={[styles.title, heading, { color: C.textPrimary, opacity: DIM }]}>{title}</Text>
  );
}

// ── Parking — the painted bay is the spotlight (tap it to park), the week below ──
export function TourParkingScreen({ C, t }: ScreenProps): React.JSX.Element {
  return (
    <View style={styles.body} pointerEvents="none">
      <Title C={C} title={t('parking.title')} />
      <Highlight C={C} radius={24}>
        <SpotCard
          current={null}
          isMine={false}
          occupantName=""
          statusLine={t('parking.free_real_estate')}
          blockedReservation={null}
          myId=""
          nameOf={(): string => ''}
          onPress={noop}
        />
      </Highlight>
      <View style={{ opacity: DIM }}>
        <DayTiles onDayPress={noop} />
      </View>
    </View>
  );
}

// ── Tasks — the "2 of 5 done" tile is the spotlight, the to-do pad below ──────
export function TourTasksScreen({ C, t }: ScreenProps): React.JSX.Element {
  const hand = useHandFont();
  const rows: Array<{ title: string; when: string; done: boolean }> = [
    { title: t('tour.demo_task_bins'), when: t('tour.demo_task_bins_when'), done: false },
    { title: t('tour.demo_task_bathroom'), when: t('tour.demo_task_bathroom_when'), done: false },
    { title: t('tour.demo_task_plants'), when: '', done: true },
  ];
  return (
    <View style={styles.body} pointerEvents="none">
      <Title C={C} title={t('tasks.title')} />
      <Highlight C={C} radius={22}>
        <TasksGlance done={2} total={5} />
      </Highlight>
      <View style={[styles.pad, { opacity: DIM }]}>
        {rows.map((r) => (
          <View key={r.title} style={styles.padRow}>
            <View style={styles.box}>{r.done && <Text style={styles.tick}>✓</Text>}</View>
            <View style={styles.padText}>
              <Text style={[styles.padTitle, r.done && styles.struck]}>{r.title}</Text>
              {!!r.when && <Text style={[styles.padWhen, hand]}>{r.when}</Text>}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Photos — the header (Select · camera · library) is the spotlight ─────────
export function TourPhotosScreen({ C, t }: ScreenProps): React.JSX.Element {
  const prints = ['#C9A27E', '#7FA7C9', '#A3B88C'];
  return (
    <View style={styles.body} pointerEvents="none">
      <Highlight C={C} radius={14}>
        <PhotosHeader
          isSelectMode={false}
          allSelected={false}
          canSelect
          onStartSelect={noop}
          onToggleAll={noop}
          onCancelSelect={noop}
          onCamera={noop}
          onLibrary={noop}
        />
      </Highlight>
      <View style={[styles.album, { opacity: DIM }]}>
        <TapeLabel label={t('photos.today')} />
        <View style={styles.prints}>
          {prints.map((tint, i) => (
            <View key={tint} style={[styles.print, { transform: [{ rotate: TILTS[i] }] }]}>
              <View style={[styles.printImg, { backgroundColor: tint }]} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const TILTS = ['-1.4deg', '0.9deg', '-0.5deg'];

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: sizes.lg, paddingTop: sizes.sm, gap: sizes.lg },
  title: { fontSize: 32, lineHeight: 41, letterSpacing: -0.5 },
  // Tasks pad (stays light in dark, like the real one)
  pad: {
    backgroundColor: P.paper,
    borderTopWidth: 6,
    borderTopColor: P.primary,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  padRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  box: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 4,
    borderColor: P.paperInk,
    transform: [{ rotate: '-2deg' }],
  },
  tick: { position: 'absolute', left: 1, top: -8, fontSize: 20, color: P.primary, ...font.bold },
  padText: { flex: 1 },
  padTitle: { fontSize: 15, ...font.semibold, color: P.paperInk },
  padWhen: { fontSize: 17, lineHeight: 20, color: P.primary },
  struck: { textDecorationLine: 'line-through', opacity: 0.6 },
  // Photos
  album: { gap: 14 },
  prints: { flexDirection: 'row', gap: 12 },
  print: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 6,
    paddingBottom: 16,
    borderRadius: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 3,
  },
  printImg: { aspectRatio: 1 },
});
