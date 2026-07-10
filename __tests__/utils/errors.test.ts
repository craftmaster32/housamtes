import { getErrorMessage } from '@utils/errors';

describe('getErrorMessage', () => {
  it('returns the message from an Error instance', () => {
    expect(getErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
  });

  it('returns the fallback for a thrown string', () => {
    expect(getErrorMessage('boom', 'fallback')).toBe('fallback');
  });

  it('returns the fallback for null and undefined', () => {
    expect(getErrorMessage(null, 'fallback')).toBe('fallback');
    expect(getErrorMessage(undefined, 'fallback')).toBe('fallback');
  });

  it('returns the message from Error subclasses', () => {
    expect(getErrorMessage(new TypeError('bad type'), 'fallback')).toBe('bad type');
  });
});
