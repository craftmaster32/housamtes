import type { EventRecurrence } from './events';

// Plain-English (and Spanish / Hebrew) repeat parser. Turns a phrase like
// "every Monday at 10 pm" into the calendar form's fields (recurrence, next
// matching date, start time) so the user can describe a repeat in their own
// words and have the form auto-fill.

export interface ParsedRepeat {
  recurrence?: EventRecurrence;
  recurrenceInterval?: number; // "every N units" — e.g. 2 with weekly = biweekly
  date?: string; // YYYY-MM-DD — the next occurrence of a named weekday
  startTime?: string; // HH:MM (24-hour)
  // True when we understood at least one part of the phrase. When false the
  // caller should tell the user we couldn't make sense of the text.
  matched: boolean;
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// Sunday = 0 … Saturday = 6, matching Date.getDay(). English + Spanish + Hebrew
// weekday names (longer aliases first so e.g. "thursday" wins over "thu").
const WEEKDAYS: Array<{ re: RegExp; dow: number }> = [
  { re: /sundays?|\bsun\b|domingos?|\bdom\b|ראשון/, dow: 0 },
  { re: /mondays?|\bmon\b|lunes|\blun\b|שני/, dow: 1 },
  { re: /tuesdays?|\btues?\b|martes|\bmar\b|שלישי/, dow: 2 },
  { re: /wednesdays?|\bweds?\b|mi[eé]rcoles|\bmi[eé]\b|רביעי/, dow: 3 },
  { re: /thursdays?|\bthurs?\b|\bthu\b|jueves|\bjue\b|חמישי/, dow: 4 },
  { re: /fridays?|\bfri\b|viernes|\bvie\b|שישי/, dow: 5 },
  { re: /saturdays?|\bsat\b|s[aá]bados?|\bs[aá]b\b|שבת/, dow: 6 },
];

// "every" / "each" / "cada" / "כל" — the lead-in to a cadence phrase.
const EVERY = '(?:every|each|cada|כל)';

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  un: 1,
  una: 1,
  other: 2, // "every other week" == every 2 weeks
  otra: 2,
  otro: 2,
  two: 2,
  dos: 2,
  three: 3,
  tres: 3,
  four: 4,
  cuatro: 4,
  five: 5,
  cinco: 5,
  six: 6,
  seis: 6,
  seven: 7,
  siete: 7,
  eight: 8,
  ocho: 8,
  nine: 9,
  nueve: 9,
  ten: 10,
  diez: 10,
};

// Per-unit noun fragments in each language (singular + plural variants).
const UNIT_NOUNS: Record<'day' | 'week' | 'month' | 'year', string> = {
  day: '(?:days?|d[ií]as?|ימים|יום)',
  week: '(?:weeks?|semanas?|שבועות|שבוע)',
  month: '(?:months?|mes(?:es)?|חודשים|חודש)',
  year: '(?:years?|a[nñ]os?|שנים|שנה)',
};

// The next date whose weekday is `dow`, on or after `ref` (today counts).
function nextWeekdayOnOrAfter(ref: Date, dow: number): string {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const diff = (dow - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return toYMD(d);
}

function parseTime(text: string): string | undefined {
  // 1) "10 pm", "10:30pm", "9 a.m." — an am/pm suffix makes the hour a time.
  const ampm = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/);
  if (ampm) {
    let hour = parseInt(ampm[1], 10);
    const minute = ampm[2] ? parseInt(ampm[2], 10) : 0;
    const isPM = ampm[3].startsWith('p');
    if (hour >= 1 && hour <= 12 && minute <= 59) {
      if (hour === 12) hour = 0;
      if (isPM) hour += 12;
      return `${pad2(hour)}:${pad2(minute)}`;
    }
  }

  // 2) 24-hour "22:00" / "9:30" (no am/pm) — works in any language.
  const h24 = text.match(/\b(\d{1,2}):(\d{2})\b/);
  if (h24) {
    const hour = parseInt(h24[1], 10);
    const minute = parseInt(h24[2], 10);
    if (hour <= 23 && minute <= 59) return `${pad2(hour)}:${pad2(minute)}`;
  }

  // 3) Bare hour introduced by "at" / "a las" / "בשעה" — so "2 weeks" isn't a
  // time. Guarded against swallowing a following unit noun.
  const atHour = text.match(
    /(?:\bat|a\s+las|בשעה)\s+(\d{1,2})\b(?!\s*(?::|weeks?|days?|months?|years?|semanas?|d[ií]as?|mes(?:es)?|a[nñ]os?))/
  );
  if (atHour) {
    const hour = parseInt(atHour[1], 10);
    if (hour <= 23) return `${pad2(hour)}:00`;
  }

  return undefined;
}

// A boundary that also works after Hebrew letters — plain \b keys off ASCII \w,
// so it never fires between a Hebrew letter and the end of the string.
const NOT_LETTER = '(?![a-zא-ת])';

// "every N <unit>" where the count is optional: "every week" → 1,
// "every 3 weeks" → 3, "cada dos semanas" → 2, "every other week" → 2.
function unitPattern(unit: 'day' | 'week' | 'month' | 'year'): string {
  return `${EVERY}\\s+(?:(\\d+|[a-zא-ת]+)\\s+)?${UNIT_NOUNS[unit]}${NOT_LETTER}`;
}

// Any of the unit nouns, preceded by "every" and an explicit count token —
// i.e. the user clearly asked for "every N <unit>" (e.g. "every 2 weeks").
const ANY_UNIT = Object.values(UNIT_NOUNS).join('|');
const EXPLICIT_COUNT_RE = new RegExp(
  `${EVERY}\\s+(\\d+|[a-zא-ת]+)\\s+(?:${ANY_UNIT})${NOT_LETTER}`
);

// Pull the interval out of a "every N <unit>" phrase; defaults to 1 when only a
// bare unit is named.
function intervalFor(text: string, unit: 'day' | 'week' | 'month' | 'year'): number {
  const m = text.match(new RegExp(unitPattern(unit)));
  const token = m?.[1];
  if (!token) return 1;
  const n = /^\d+$/.test(token) ? parseInt(token, 10) : NUMBER_WORDS[token];
  return n && n >= 1 ? n : 1;
}

function parseRecurrence(
  text: string,
  hasWeekday: boolean
): { recurrence: EventRecurrence; interval: number } | undefined {
  // Fixed 2-week shorthands.
  if (/bi-?weekly|fortnight(ly)?|quincenal|שבועיים/.test(text)) {
    return { recurrence: 'weekly', interval: 2 };
  }
  // "every Monday" / "cada lunes" / "כל יום שני" → weekly on that day. Checked
  // before the unit branches: in Hebrew a weekday name contains "יום" (day), so
  // this keeps it from being misread as a daily repeat. Skipped only when the
  // text spells out an explicit "every N <unit>" (e.g. "every 2 weeks on Monday"),
  // which is a deliberate interval; a time like "10 pm" does not count.
  if (hasWeekday && new RegExp(EVERY).test(text) && !EXPLICIT_COUNT_RE.test(text)) {
    return { recurrence: 'weekly', interval: 1 };
  }
  // Order matters: check the longer units before the shorter, and "every N
  // weeks" before a bare "weekly", since the count phrases share the unit noun.
  if (new RegExp(`${unitPattern('year')}|yearly|annually|annual|anual|שנתי`).test(text)) {
    return { recurrence: 'yearly', interval: intervalFor(text, 'year') };
  }
  if (new RegExp(`${unitPattern('month')}|monthly|mensual|חודשי`).test(text)) {
    return { recurrence: 'monthly', interval: intervalFor(text, 'month') };
  }
  if (new RegExp(`${unitPattern('week')}|weekly|semanal|שבועי`).test(text)) {
    return { recurrence: 'weekly', interval: intervalFor(text, 'week') };
  }
  if (new RegExp(`${unitPattern('day')}|daily|diari[oa]|יומי`).test(text)) {
    return { recurrence: 'daily', interval: intervalFor(text, 'day') };
  }
  return undefined;
}

/**
 * Parse a free-text repeat description into calendar-form fields.
 *
 * Understands weekly / biweekly (every 2 weeks) / monthly / yearly cadences, a
 * named weekday (resolved to its next date on or after `reference`), and a time
 * of day. Recognises English, Spanish, and Hebrew keywords. Returns
 * `matched: false` when nothing was recognised.
 */
export function parseRepeatText(input: string, reference: Date = new Date()): ParsedRepeat {
  const text = input.toLowerCase().trim();
  if (!text) return { matched: false };

  const weekday = WEEKDAYS.find((w) => w.re.test(text));
  const parsed = parseRecurrence(text, !!weekday);
  const startTime = parseTime(text);
  const date = weekday ? nextWeekdayOnOrAfter(reference, weekday.dow) : undefined;

  return {
    recurrence: parsed?.recurrence,
    recurrenceInterval: parsed ? parsed.interval : undefined,
    date,
    startTime,
    matched: !!parsed || !!date || !!startTime,
  };
}
