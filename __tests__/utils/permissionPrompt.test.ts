import AsyncStorage from '@react-native-async-storage/async-storage';
import { hasSeenNotifPrompt, markNotifPromptSeen } from '@utils/permissionPrompt';

const NOTIF_PROMPT_KEY = 'nestiq_notif_permission_prompt';

describe('one-time notification permission prompt flag', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('has not been seen on a fresh device', async () => {
    expect(await hasSeenNotifPrompt()).toBe(false);
  });

  it('is marked seen after the user answers the card', async () => {
    await markNotifPromptSeen();
    expect(await AsyncStorage.getItem(NOTIF_PROMPT_KEY)).toBe('done');
    expect(await hasSeenNotifPrompt()).toBe(true);
  });

  it('stays seen on later launches so people are not nagged', async () => {
    await markNotifPromptSeen();
    expect(await hasSeenNotifPrompt()).toBe(true);
    expect(await hasSeenNotifPrompt()).toBe(true);
  });
});
