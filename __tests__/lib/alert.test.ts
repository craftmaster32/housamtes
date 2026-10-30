import { Alert, finishAlert, getAlertSnapshot, subscribeAlert } from '@lib/alert';

function clearAll(): void {
  for (let r = getAlertSnapshot(); r; r = getAlertSnapshot()) finishAlert(r.id);
}

describe('in-app alerts', () => {
  afterEach(clearAll);

  it('shows the message with its buttons and code', () => {
    const onPress = jest.fn();
    Alert.alert('Invite code', 'Share this code', [{ text: 'Close', onPress }], {
      code: 'TESTHQUS',
    });
    const shown = getAlertSnapshot();
    expect(shown?.title).toBe('Invite code');
    expect(shown?.message).toBe('Share this code');
    expect(shown?.code).toBe('TESTHQUS');
    expect(shown?.buttons).toHaveLength(1);
  });

  it('leaves the buttons empty so the host can say OK in the app language', () => {
    Alert.alert('Saved');
    expect(getAlertSnapshot()?.buttons).toEqual([]);
  });

  it('shows alerts one after another instead of dropping any', () => {
    Alert.alert('First');
    Alert.alert('Second');
    const first = getAlertSnapshot();
    expect(first?.title).toBe('First');
    finishAlert(first!.id);
    expect(getAlertSnapshot()?.title).toBe('Second');
  });

  it('tells the host when something changes', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeAlert(listener);
    Alert.alert('Hello');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    Alert.alert('Again');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
