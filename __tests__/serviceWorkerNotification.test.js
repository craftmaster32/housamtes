const { buildNotificationOptions } = require('../public/sw');

describe('service worker buildNotificationOptions', () => {
  it('sets the heads-up options that keep Android notifications from arriving silently', () => {
    const options = buildNotificationOptions({ title: 'Hi', body: 'A new bill was added' });

    expect(options.requireInteraction).toBe(true);
    expect(options.renotify).toBe(true);
    expect(options.silent).toBe(false);
    expect(Array.isArray(options.vibrate)).toBe(true);
    expect(options.vibrate.length).toBeGreaterThan(0);
    expect(options.tag).toBeTruthy();
  });

  it('carries the payload body, data and default icon/badge through', () => {
    const data = { screen: 'bills', type: 'bill_added' };
    const options = buildNotificationOptions({ title: 'Hi', body: 'Rent is due', data });

    expect(options.body).toBe('Rent is due');
    expect(options.data).toBe(data);
    expect(options.icon).toBe('/favicon.png');
    expect(options.badge).toBe('/favicon.png');
  });

  it('derives the tag from the notification type so same-type pushes re-alert', () => {
    const options = buildNotificationOptions({ body: '', data: { type: 'chat_message' } });
    expect(options.tag).toBe('chat_message');
  });

  it('falls back to a stable app-wide tag when the payload has no type', () => {
    const options = buildNotificationOptions({ body: '' });
    expect(options.tag).toBe('housemates');
  });

  it('tolerates a payload with no body without throwing', () => {
    const options = buildNotificationOptions({});
    expect(options.body).toBe('');
    expect(options.data).toEqual({});
  });
});

describe('service worker push event null-payload guard', () => {
  let pushHandler;
  let showNotification;

  beforeAll(() => {
    showNotification = jest.fn().mockResolvedValue(undefined);
    const listeners = {};

    global.self = {
      addEventListener: (event, handler) => {
        listeners[event] = handler;
      },
      registration: { showNotification },
    };

    // Re-load sw.js in isolation so it registers its listeners against the mock self.
    jest.isolateModules(() => {
      require('../public/sw');
    });

    delete global.self;
    pushHandler = listeners.push;
  });

  afterEach(() => {
    showNotification.mockClear();
  });

  it('invokes the production push listener without throwing when event.data.json() returns null', async () => {
    // json() returning null is valid JSON; the ?? {} guard in sw.js normalises it
    // before accessing .title / .body / .data.
    const fakeEvent = {
      data: { json: () => null },
      waitUntil: jest.fn(),
    };

    pushHandler(fakeEvent);

    expect(fakeEvent.waitUntil).toHaveBeenCalled();
    await fakeEvent.waitUntil.mock.calls[0][0];
    expect(showNotification).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ silent: false, requireInteraction: true })
    );
  });
});
