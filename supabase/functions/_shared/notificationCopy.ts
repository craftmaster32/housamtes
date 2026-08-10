// Shared, localized + playful copy for reminder push notifications.
// Kept deliberately light on puns so the meaning stays crystal-clear in every
// language. Imported by the bill / chore / grocery reminder Edge Functions.

export type Lang = 'en' | 'es' | 'he';

export interface PushCopy {
  title: string;
  body: string;
}

/** Normalize whatever is stored on the device row to a supported language. */
export function normalizeLang(value: string | null | undefined): Lang {
  const short = (value ?? 'en').slice(0, 2).toLowerCase();
  return short === 'es' || short === 'he' ? short : 'en';
}

function days(lang: Lang, n: number): string {
  if (lang === 'es') return n === 1 ? '1 día' : `${n} días`;
  if (lang === 'he') return n === 1 ? 'יום אחד' : `${n} ימים`;
  return n === 1 ? '1 day' : `${n} days`;
}

export function billDueCopy(
  lang: Lang,
  p: { title: string; amount: string; currency: string; daysUntil: number }
): PushCopy {
  const money = `${p.currency}${p.amount}`;
  if (lang === 'es') {
    return {
      title: '💸 Una cuenta toca a la puerta',
      body: `${p.title} — ${money}. Vence en ${days(lang, p.daysUntil)}: sáldala antes de que se salga de control.`,
    };
  }
  if (lang === 'he') {
    return {
      title: '💸 חשבון דופק בדלת',
      body: `${p.title} — ${money}. לתשלום בעוד ${days(lang, p.daysUntil)}: סגרו אותו לפני שהוא סוגר אתכם.`,
    };
  }
  return {
    title: "💸 A bill's knocking",
    body: `${p.title} — ${money}. Due in ${days(lang, p.daysUntil)} — settle up before it settles in.`,
  };
}

export function choreDueCopy(lang: Lang, p: { title: string }): PushCopy {
  if (lang === 'es') {
    return {
      title: '🧹 Una tarea te llama',
      body: `"${p.title}" vence hoy — no se hace sola (ya lo intentamos).`,
    };
  }
  if (lang === 'he') {
    return {
      title: '🧹 מטלה קוראת לך',
      body: `"${p.title}" להשלמה היום — היא לא תעשה את עצמה (בדקנו).`,
    };
  }
  return {
    title: '🧹 A chore is calling',
    body: `"${p.title}" is due today — it won't do itself (we checked).`,
  };
}

/** The reminder body is the user's own label, so only the title gets a wink. */
export function groceryReminderTitle(lang: Lang): string {
  if (lang === 'es') return '🛒 No olvides las compras';
  if (lang === 'he') return '🛒 אל תשכחו את הקניות';
  return "🛒 Don't forget the goods";
}

/** "when" phrase for an event reminder: today / tomorrow / in N days. */
function eventWhen(lang: Lang, daysUntil: number): string {
  if (daysUntil <= 0) {
    if (lang === 'es') return 'hoy';
    if (lang === 'he') return 'היום';
    return 'today';
  }
  if (daysUntil === 1) {
    if (lang === 'es') return 'mañana';
    if (lang === 'he') return 'מחר';
    return 'tomorrow';
  }
  if (lang === 'es') return `en ${days(lang, daysUntil)}`;
  if (lang === 'he') return `בעוד ${days(lang, daysUntil)}`;
  return `in ${days(lang, daysUntil)}`;
}

export function eventReminderCopy(
  lang: Lang,
  p: { title: string; startTime?: string; daysUntil: number }
): PushCopy {
  const when = eventWhen(lang, p.daysUntil);
  const at = p.startTime ? ` · ${p.startTime}` : '';
  if (lang === 'es') {
    return {
      title: '📅 Un evento se acerca',
      body: `"${p.title}" es ${when}${at}. Que no te pille por sorpresa.`,
    };
  }
  if (lang === 'he') {
    return {
      title: '📅 אירוע מתקרב',
      body: `"${p.title}" ${when}${at}. שלא יפתיע אתכם.`,
    };
  }
  return {
    title: '📅 An event is coming up',
    body: `"${p.title}" is ${when}${at}. Don't let it sneak up on you.`,
  };
}
