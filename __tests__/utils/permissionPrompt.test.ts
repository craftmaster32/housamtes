import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  hasSeenNotifPrompt,
  markNotifPromptSeen,
  decideNotifPrompt,
} from '@utils/permissionPrompt';

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

describe('notification prompt decision', () => {
  it('shows the card when the browser/OS can still be asked', () => {
    expect(decideNotifPrompt('default')).toBe('show');
    expect(decideNotifPrompt('undetermined')).toBe('show');
  });

  it('hides and remembers on a real, stable answer', () => {
    expect(decideNotifPrompt('granted')).toBe('hide-and-remember');
    expect(decideNotifPrompt('denied')).toBe('hide-and-remember');
  });

  it('hides WITHOUT remembering when notifications are unavailable in this context', () => {
    // e.g. an iOS website in a Safari tab, before it is added to the Home Screen —
    // we must still be able to offer the prompt once it can actually be asked.
    expect(decideNotifPrompt('unavailable')).toBe('hide');
    expect(decideNotifPrompt('unsupported')).toBe('hide');
  });
});
