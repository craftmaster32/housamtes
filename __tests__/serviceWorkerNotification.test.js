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
