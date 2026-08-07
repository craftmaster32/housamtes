import AsyncStorage from '@react-native-async-storage/async-storage';
import { markTourPending, shouldShowTour, markTourSeen } from '@utils/tour';

const TOUR_KEY = 'housemates_new_user_tour';

describe('new-user welcome tour flag', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('does not show the tour by default (existing users)', async () => {
    expect(await shouldShowTour()).toBe(false);
  });

  it('shows the tour after a new account queues it', async () => {
    await markTourPending();
    expect(await AsyncStorage.getItem(TOUR_KEY)).toBe('pending');
    expect(await shouldShowTour()).toBe(true);
  });

  it('stops showing the tour once it has been seen', async () => {
    await markTourPending();
    await markTourSeen();
    expect(await AsyncStorage.getItem(TOUR_KEY)).toBe('done');
    expect(await shouldShowTour()).toBe(false);
  });

  it('never shows again on a second launch after being seen', async () => {
    await markTourPending();
    await markTourSeen();
    expect(await shouldShowTour()).toBe(false);
    // A returning user logging in should still not trigger it.
    expect(await shouldShowTour()).toBe(false);
  });
});
