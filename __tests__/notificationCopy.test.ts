import {
  instantPushCopy,
  normalizeLang,
  applianceDoneCopy,
} from '@/supabase/functions/_shared/notificationCopy';

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

describe('instantPushCopy — event_added range', () => {
  it('shows start date and time only when no end data is provided', () => {
    const copy = instantPushCopy('event_added', 'en', {
      actorName: 'Alice',
      eventTitle: 'Movie Night',
      date: '2026-09-05',
      time: '20:00',
      endDate: '',
      endTime: '',
    });
    expect(copy).not.toBeNull();
    expect(copy!.body).toContain('20:00');
    expect(copy!.body).not.toContain('→');
  });

  it('shows start → end time when same-day end time is given', () => {
    const copy = instantPushCopy('event_added', 'en', {
      actorName: 'Alice',
      eventTitle: 'Movie Night',
      date: '2026-09-05',
      time: '20:00',
      endDate: '2026-09-05',
      endTime: '22:00',
    });
    expect(copy!.body).toContain('20:00 → 22:00');
  });

  it('shows multi-day range when endDate differs from date', () => {
    const copy = instantPushCopy('event_added', 'en', {
      actorName: 'Alice',
      eventTitle: 'Trip',
      date: '2026-09-05',
      time: '',
      endDate: '2026-09-07',
      endTime: '',
    });
    expect(copy!.body).toContain('→');
    expect(copy!.body).toContain('Sep');
  });

  it('localizes the event_added range in Hebrew', () => {
    const copy = instantPushCopy('event_added', 'he', {
      actorName: 'דנה',
      eventTitle: 'מסיבה',
      date: '2026-09-05',
      time: '19:00',
      endDate: '2026-09-05',
      endTime: '23:00',
    });
    expect(copy!.title).toContain('אירוע');
    expect(copy!.body).toContain('19:00 → 23:00');
  });
});

describe('appliance copy — Spanish articles agree with the noun', () => {
  it('uses "El" for the masculine lavavajillas', () => {
    const copy = applianceDoneCopy('es', { appliance: 'dishwasher' });
    expect(copy.body.startsWith('El lavavajillas')).toBe(true);
  });

  it('uses "La" for the feminine lavadora / secadora', () => {
    expect(applianceDoneCopy('es', { appliance: 'washer' }).body.startsWith('La lavadora')).toBe(
      true
    );
    expect(applianceDoneCopy('es', { appliance: 'dryer' }).body.startsWith('La secadora')).toBe(
      true
    );
  });

  it('agrees on the instant start/free copy too', () => {
    const started = instantPushCopy('appliance_started', 'es', {
      appliance: 'dishwasher',
      name: 'Alex',
      minutes: 90,
    });
    expect(started!.body).toContain('el lavavajillas');
    const free = instantPushCopy('appliance_free', 'es', { appliance: 'dishwasher' });
    expect(free!.body).toContain('El lavavajillas');
    expect(free!.body).toContain('¡a por él!');
  });
});
