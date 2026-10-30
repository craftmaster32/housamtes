import { StyleSheet, View } from 'react-native';
import { useThemedColors } from '@constants/colors';
import { BillArt } from '@components/bills/art/BillArt';
import { CarArt } from '@components/dashboard/art/CarArt';
import { DoorArt } from '@components/auth/art/DoorArt';
import { ms } from '@utils/responsive';

export type PictureKind = 'door' | 'bill' | 'car';

interface TapedPictureProps {
  kind: PictureKind;
  /** Degrees; alternate the sign so a row of pictures looks hand-placed. */
  tilt?: number;
}

const CARD = ms(176);

/**
 * A hand-drawn picture on a square of cream paper, held on with a strip of
 * masking tape. The paper stays light in dark mode so the ink always shows.
 */
export function TapedPicture({ kind, tilt = -3 }: TapedPictureProps): React.JSX.Element {
  const c = useThemedColors();
  return (
    <View
      style={[styles.card, { backgroundColor: c.paper, transform: [{ rotate: `${tilt}deg` }] }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.tape} />
      {kind === 'door' && <DoorArt width={ms(108)} ink={c.paperInk} />}
      {kind === 'bill' && <BillArt icon="receipt" size={ms(116)} />}
      {kind === 'car' && <CarArt color={c.primary} width={ms(136)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD,
    height: CARD,
    borderRadius: ms(6),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(8) },
    shadowOpacity: 0.14,
    shadowRadius: ms(14),
    elevation: 5,
  },
  tape: {
    position: 'absolute',
    top: ms(-10),
    width: ms(70),
    height: ms(22),
    backgroundColor: 'rgba(226,214,180,0.85)',
    transform: [{ rotate: '4deg' }],
  },
});
