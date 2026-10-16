/**
 * ParkingBlockedBanner — someone's reserved slot has started but another car
 * is still in the spot. The parked person is asked to move, the holder is told
 * who is still there, and everyone else sees what's going on.
 */

import { render, screen } from '@testing-library/react-native';
import { ParkingBlockedBanner } from '@components/parking/ParkingBlockedBanner';
import type { ParkingReservation } from '@stores/parkingStore';

jest.mock('@expo/vector-icons', () => ({ Ionicons: (): null => null }));
jest.mock('@lib/supabase', () => ({ supabase: {} }));
jest.mock('react-i18next', () => ({
  useTranslation: (): { t: (key: string, params?: Record<string, string>) => string } => ({
    t: (key: string, params?: Record<string, string>): string =>
      params ? `${key} ${JSON.stringify(params)}` : key,
  }),
}));

const slot: ParkingReservation = {
  id: 'r1',
  requestedBy: 'ido',
  date: '2026-10-16',
  startTime: '11:00',
  endTime: '15:55',
  note: '',
  status: 'approved',
  createdAt: '',
  votes: [],
};
const names: Record<string, string> = { ido: 'Ido Givaty', lior: 'Lior Halivner', dan: 'Dan' };
const resolveName = (id: string): string => names[id] ?? id;

describe('ParkingBlockedBanner', () => {
  it('asks the parked person to move, naming the slot holder', () => {
    render(
      <ParkingBlockedBanner
        reservation={slot}
        occupantId="lior"
        myId="lior"
        resolveName={resolveName}
      />
    );
    expect(screen.getByText('parking.blocked_move_title')).toBeTruthy();
    expect(screen.getByText(/parking\.blocked_move_body.*"name":"Ido"/)).toBeTruthy();
  });

  it('tells the slot holder who is still parked', () => {
    render(
      <ParkingBlockedBanner
        reservation={slot}
        occupantId="lior"
        myId="ido"
        resolveName={resolveName}
      />
    );
    expect(screen.getByText('parking.blocked_yours_title')).toBeTruthy();
    expect(screen.getByText(/parking\.blocked_yours_body.*"name":"Lior"/)).toBeTruthy();
  });

  it('explains the situation to other housemates', () => {
    render(
      <ParkingBlockedBanner
        reservation={slot}
        occupantId="lior"
        myId="dan"
        resolveName={resolveName}
      />
    );
    expect(screen.getByText('parking.blocked_other_title')).toBeTruthy();
    expect(
      screen.getByText(/parking\.blocked_other_body.*"holder":"Ido".*"occupant":"Lior"/)
    ).toBeTruthy();
  });
});
