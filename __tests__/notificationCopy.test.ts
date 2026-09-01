import { instantPushCopy, normalizeLang } from '../supabase/functions/_shared/notificationCopy';

// These lock in the promise that every housemate reads instant push
// notifications in their OWN app language — not the sender's. The copy is built
// server-side per recipient, keyed by the device language on their push token.

describe('normalizeLang', () => {
  it('maps supported languages and locale variants', () => {
    expect(normalizeLang('he')).toBe('he');
    expect(normalizeLang('es-ES')).toBe('es');
    expect(normalizeLang('en-GB')).toBe('en');
  });

  it('falls back to English for anything unknown or missing', () => {
    expect(normalizeLang(null)).toBe('en');
    expect(normalizeLang(undefined)).toBe('en');
    expect(normalizeLang('fr')).toBe('en');
  });
});

describe('instantPushCopy — same event, three languages', () => {
  const params = { billTitle: 'Rent', money: '₪900.00' };

  it('renders Hebrew for a Hebrew recipient', () => {
    const copy = instantPushCopy('bill_added', 'he', params);
    expect(copy).not.toBeNull();
    expect(copy!.title).toContain('הוצאה');
    expect(copy!.body).toContain('Rent');
    expect(copy!.body).toContain('₪900.00');
  });

  it('renders Spanish for a Spanish recipient', () => {
    const copy = instantPushCopy('bill_added', 'es', params);
    expect(copy!.title).toContain('gasto');
    expect(copy!.body).toContain('dividir');
  });

  it('renders English for an English recipient', () => {
    const copy = instantPushCopy('bill_added', 'en', params);
    expect(copy!.title).toBe('💸 New expense dropped');
    expect(copy!.body).toContain('Time to split');
  });
});

describe('instantPushCopy — coverage across event types', () => {
  it('localizes a completed chore', () => {
    const he = instantPushCopy('chore_done', 'he', { name: 'דנה', choreName: 'כלים' });
    expect(he!.body).toContain('דנה');
    expect(he!.body).toContain('כלים');
  });

  it('localizes a parking dibs request with time and note', () => {
    const es = instantPushCopy('parking_dibs', 'es', {
      name: 'Ana',
      date: '2026-09-01',
      time: '18:00',
      note: 'visita',
    });
    expect(es!.body).toContain('Ana');
    expect(es!.body).toContain('a las 18:00');
    expect(es!.body).toContain('visita');
  });

  it('uses a localized fallback name when the actor name is missing', () => {
    const he = instantPushCopy('task_assigned', 'he', { actorName: '', taskTitle: 'לשלם' });
    expect(he!.body).toContain('שותף');
    const es = instantPushCopy('task_assigned', 'es', { actorName: '', taskTitle: 'pagar' });
    expect(es!.body).toContain('compañero');
  });

  it('handles singular vs plural grocery counts per language', () => {
    expect(instantPushCopy('grocery_draft', 'es', { count: 1 })!.body).toContain('1 artículo');
    expect(instantPushCopy('grocery_draft', 'es', { count: 3 })!.body).toContain('3 artículos');
  });
});

describe('instantPushCopy — pass-through keys', () => {
  it('returns null for keys with no fixed copy (e.g. chat messages)', () => {
    expect(instantPushCopy('chat_message', 'he', {})).toBeNull();
    expect(instantPushCopy('totally_unknown_key', 'en', {})).toBeNull();
  });
});
