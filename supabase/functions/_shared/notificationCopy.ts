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

// ── Instant "a housemate just did X" notifications ────────────────────────────
// These fire the moment someone acts (added a bill, took the parking spot, …).
// The copy is built here, per recipient, so every housemate reads it in their
// own app language — not in whoever happened to trigger the event.

/** Raw params passed from the app. All values arrive as strings/numbers. */
export interface CopyParams {
  [key: string]: string | number | undefined;
}

const LOCALE: Record<Lang, string> = { en: 'en-GB', es: 'es-ES', he: 'he-IL' };

/** Format a YYYY-MM-DD date into a short, localized label (e.g. "Mon 1 Sep"). */
function shortDate(lang: Lang, date: string): string {
  try {
    const parsed = new Date(`${date}T12:00:00`);
    if (isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString(LOCALE[lang], {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return date;
  }
}

/** "at 18:00" / "a las 18:00" / "בשעה 18:00" — empty when no time is given. */
function atTime(lang: Lang, time?: string): string {
  if (!time) return '';
  if (lang === 'es') return ` a las ${time}`;
  if (lang === 'he') return ` בשעה ${time}`;
  return ` at ${time}`;
}

function str(p: CopyParams, key: string): string {
  const v = p[key];
  return v === undefined || v === null ? '' : String(v);
}

// ── Appliances ────────────────────────────────────────────────────────────────
type ApplianceKind = 'washer' | 'dryer' | 'dishwasher';

const APPLIANCE_LABEL: Record<Lang, Record<ApplianceKind, string>> = {
  en: { washer: 'washing machine', dryer: 'dryer', dishwasher: 'dishwasher' },
  es: { washer: 'lavadora', dryer: 'secadora', dishwasher: 'lavavajillas' },
  he: { washer: 'מכונת הכביסה', dryer: 'המייבש', dishwasher: 'מדיח הכלים' },
};

function applianceLabel(lang: Lang, kind: string): string {
  const table = APPLIANCE_LABEL[lang];
  return table[kind as ApplianceKind] ?? kind;
}

/** "1h 30m" / "45m" — a compact, language-neutral duration from minutes. */
function durationLabel(minutes: number): string {
  const total = Math.max(1, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Cron-sent copy when a machine's cycle finishes — the house is told it's free.
 * The finished machine's name is capitalized to open the sentence naturally.
 */
export function applianceDoneCopy(lang: Lang, p: { appliance: string }): PushCopy {
  const name = applianceLabel(lang, p.appliance);
  const Cap = name.charAt(0).toUpperCase() + name.slice(1);
  if (lang === 'es') {
    return {
      title: '✅ ¡Ciclo terminado!',
      body: `La ${name} ya terminó — recoge tu ropa y déjala libre 🧺`,
    };
  }
  if (lang === 'he') {
    return { title: '✅ המחזור הסתיים!', body: `${Cap} סיים/ה — פנו אותו/ה לשותפים 🧺` };
  }
  return { title: '✅ Cycle finished!', body: `${Cap} is done — grab your load and free it up 🧺` };
}

/**
 * Build the localized title + body for an instant notification.
 * Returns null for keys with no fixed copy (e.g. chat messages, whose text is
 * the user's own words), so the caller falls back to the pass-through title/body.
 */
export function instantPushCopy(key: string, lang: Lang, p: CopyParams): PushCopy | null {
  const es = lang === 'es';
  const he = lang === 'he';

  switch (key) {
    case 'bill_added': {
      const t = str(p, 'billTitle');
      const money = str(p, 'money');
      if (es) return { title: '💸 Nuevo gasto', body: `${t} — ${money}. ¡Hora de dividir! 🤝` };
      if (he) return { title: '💸 הוצאה חדשה נחתה', body: `${t} — ${money}. זמן להתחלק! 🤝` };
      return { title: '💸 New expense dropped', body: `${t} — ${money}. Time to split! 🤝` };
    }

    case 'bill_edited_amount': {
      const t = str(p, 'billTitle');
      const from = str(p, 'oldMoney');
      const to = str(p, 'newMoney');
      const body = `${t}: ${from} → ${to}`;
      if (es) return { title: '✏️ Cuenta actualizada', body };
      if (he) return { title: '✏️ החשבון עודכן', body };
      return { title: '✏️ Bill updated', body };
    }

    case 'bill_edited_date': {
      const t = str(p, 'billTitle');
      const d = shortDate(lang, str(p, 'date'));
      if (es) return { title: '✏️ Cuenta actualizada', body: `${t} — vencimiento movido al ${d}` };
      if (he) return { title: '✏️ החשבון עודכן', body: `${t} — מועד התשלום הועבר ל-${d}` };
      return { title: '✏️ Bill updated', body: `${t} — due date moved to ${d}` };
    }

    case 'bill_settled': {
      const t = str(p, 'billTitle');
      const who = str(p, 'settledByName');
      if (es)
        return { title: '🎉 ¡Cuentas saldadas!', body: `${t} resuelto. ${who} salva el día 🙌` };
      if (he) return { title: '🎉 הדרמה הכספית נפתרה!', body: `${t} סודר. ${who} מציל את היום 🙌` };
      return { title: '🎉 Money drama resolved!', body: `${t} sorted. ${who} saves the day 🙌` };
    }

    case 'bill_deleted': {
      const t = str(p, 'billTitle');
      if (es)
        return {
          title: '🗑️ Cuenta eliminada',
          body: `${t} fue eliminada. Como si nunca hubiera pasado.`,
        };
      if (he) return { title: '🗑️ החשבון נעלם', body: `${t} הוסר. כאילו זה מעולם לא קרה.` };
      return { title: '🗑️ Bill gone poof', body: `${t} was removed. Pretend it never happened.` };
    }

    case 'parking_claimed': {
      const name = str(p, 'name');
      if (es)
        return {
          title: '🚗 ¡Plaza ocupada!',
          body: `${name} pilló la plaza de parking. El que llega primero, aparca 🏎️`,
        };
      if (he) return { title: '🚗 החניה נתפסה!', body: `${name} תפס/ה את החניה. כל הקודם זוכה 🏎️` };
      return {
        title: '🚗 Spot taken!',
        body: `${name} nabbed the parking spot. First come, first parked 🏎️`,
      };
    }

    case 'parking_freed': {
      const name = str(p, 'name');
      if (es)
        return {
          title: '🅿️ ¡Plaza libre — corre!',
          body: name
            ? `${name} liberó la plaza. ¡Rápido, ocúpala! 🏃`
            : 'La plaza está libre — ¡el primero que llegue aparca!',
        };
      if (he)
        return {
          title: '🅿️ החניה פנויה — מהר!',
          body: name
            ? `${name} שחרר/ה את החניה. מהר, תפסו אותה! 🏃`
            : 'החניה פנויה — כל הקודם זוכה!',
        };
      return {
        title: "🅿️ Spot's free — go go go!",
        body: name
          ? `${name} freed the spot. Quick, claim it! 🏃`
          : 'The spot is free — first come, first parked!',
      };
    }

    case 'parking_dibs': {
      const name = str(p, 'name');
      const d = shortDate(lang, str(p, 'date'));
      const when = atTime(lang, str(p, 'time'));
      const note = str(p, 'note');
      if (es) {
        const noteStr = note ? ` — "${note}"` : '';
        return {
          title: '🙏 ¡Pide la plaza!',
          body: `${name} quiere la plaza el ${d}${when}${noteStr}. ¡Vota!`,
        };
      }
      if (he) {
        const noteStr = note ? ` — "${note}"` : '';
        return {
          title: '🙏 קורא/ת דיבס!',
          body: `${name} רוצה את החניה ב-${d}${when}${noteStr}. הצביעו!`,
        };
      }
      const noteStr = note ? ` — "${note}"` : '';
      return {
        title: '🙏 Calling dibs!',
        body: `${name} wants the spot on ${d}${when}${noteStr}. Vote!`,
      };
    }

    case 'parking_approved': {
      const d = shortDate(lang, str(p, 'date'));
      const when = atTime(lang, str(p, 'time'));
      if (es)
        return {
          title: '✅ ¡Tienes la plaza!',
          body: `Parking confirmado para el ${d}${when}. De nada 🤝`,
        };
      if (he)
        return { title: '✅ קיבלת את החניה!', body: `החניה אושרה ל-${d}${when}. אין בעד מה 🤝` };
      return {
        title: '✅ You got the spot!',
        body: `Parking confirmed for ${d}${when}. You're welcome 🤝`,
      };
    }

    case 'parking_rejected': {
      const d = shortDate(lang, str(p, 'date'));
      if (es)
        return {
          title: '❌ Solicitud rechazada',
          body: `Tu solicitud de parking para el ${d} fue rechazada.`,
        };
      if (he) return { title: '❌ הבקשה נדחתה', body: `בקשת החניה שלך ל-${d} נדחתה בהצבעה.` };
      return { title: '❌ Request denied', body: `Your parking request for ${d} was voted down.` };
    }

    case 'parking_voted': {
      const name = str(p, 'name');
      const d = shortDate(lang, str(p, 'date'));
      if (es)
        return {
          title: '🗳️ ¡Un compañero votó!',
          body: name
            ? `${name} votó la solicitud de parking del ${d}. ¡Añade tu voto!`
            : `Alguien votó la solicitud de parking del ${d}. ¡Añade tu voto!`,
        };
      if (he)
        return {
          title: '🗳️ שותף/ה הצביע/ה!',
          body: name
            ? `${name} הצביע/ה על בקשת החניה ל-${d}. הוסיפו גם את הקול שלכם!`
            : `מישהו הצביע על בקשת החניה ל-${d}. הוסיפו גם את הקול שלכם!`,
        };
      return {
        title: '🗳️ A housemate voted!',
        body: name
          ? `${name} voted on the parking request for ${d}. Add your vote too!`
          : `Someone voted on the parking request for ${d}. Add your vote too!`,
      };
    }

    case 'parking_vote_progress': {
      const d = shortDate(lang, str(p, 'date'));
      const inN = str(p, 'votesIn');
      const total = str(p, 'votesTotal');
      if (es)
        return {
          title: '🗳️ ¡Voto recibido!',
          body: `Tu solicitud de parking del ${d} sigue abierta — ${inN}/${total} votos.`,
        };
      if (he)
        return {
          title: '🗳️ ההצבעה התקבלה!',
          body: `בקשת החניה שלך ל-${d} עדיין פתוחה — ${inN}/${total} הצבעות.`,
        };
      return {
        title: '🗳️ Vote received!',
        body: `Your parking request for ${d} is still open — ${inN}/${total} votes in.`,
      };
    }

    case 'chore_added': {
      const name = str(p, 'name');
      const chore = str(p, 'choreName');
      if (es)
        return {
          title: '🧹 Nueva tarea de casa',
          body: `${name} añadió "${chore}". ¡A arrimar el hombro!`,
        };
      if (he)
        return { title: '🧹 מטלה חדשה נוספה', body: `${name} הוסיף/ה "${chore}". בואו נעזור!` };
      return { title: '🧹 New chore added', body: `${name} added "${chore}". Time to pitch in!` };
    }

    case 'chore_done': {
      const name = str(p, 'name');
      const chore = str(p, 'choreName');
      if (es)
        return { title: '✅ ¡Tarea hecha!', body: `${name} terminó "${chore}". Una cosa menos 🎉` };
      if (he)
        return { title: '✅ המטלה בוצעה!', body: `${name} סיים/ה "${chore}". דאגה אחת פחות 🎉` };
      return {
        title: '✅ Chore done!',
        body: `${name} finished "${chore}". One less thing to worry about 🎉`,
      };
    }

    case 'grocery_draft': {
      const count = Number(p['count'] ?? 0);
      if (es) {
        const items = count === 1 ? '1 artículo' : `${count} artículos`;
        return {
          title: '🛒 ¡Lista de compras en camino!',
          body: `${items} añadidos. Hora de ir de compras 💪`,
        };
      }
      if (he) {
        const items = count === 1 ? 'פריט אחד' : `${count} פריטים`;
        return { title: '🛒 רשימת קניות בדרך!', body: `${items} נוספו. זמן לצאת לקניות 💪` };
      }
      const items = count === 1 ? '1 item' : `${count} items`;
      return {
        title: '🛒 Shopping list incoming!',
        body: `${items} added. Time to brave the shops 💪`,
      };
    }

    case 'grocery_list_saved': {
      const name = str(p, 'name');
      const list = str(p, 'listName');
      if (es)
        return {
          title: '📋 ¡Nueva lista!',
          body: name
            ? `${name} hizo una lista: "${list}" 🛍️`
            : `Nueva lista lista: "${list}" — ¡a por las cosas!`,
        };
      if (he)
        return {
          title: '📋 רשימה חדשה!',
          body: name
            ? `${name} הכין/ה רשימה: "${list}" 🛍️`
            : `רשימה חדשה מוכנה: "${list}" — קדימה לקניות!`,
        };
      return {
        title: '📋 New list dropped!',
        body: name
          ? `${name} made a list: "${list}" 🛍️`
          : `New list ready: "${list}" — go get the stuff!`,
      };
    }

    case 'task_assigned': {
      const task = str(p, 'taskTitle');
      const actor = str(p, 'actorName') || (es ? 'Un compañero' : he ? 'שותף/ה' : 'A housemate');
      if (es) return { title: '📋 Nueva tarea para ti', body: `${actor} te asignó "${task}"` };
      if (he) return { title: '📋 משימה חדשה בשבילך', body: `${actor} הקצה/תה לך "${task}"` };
      return { title: '📋 New task for you', body: `${actor} assigned you "${task}"` };
    }

    case 'event_added': {
      const title = str(p, 'eventTitle');
      const actor = str(p, 'actorName') || (es ? 'Un compañero' : he ? 'שותף/ה' : 'A housemate');
      const startDateStr = str(p, 'date');
      const d = shortDate(lang, startDateStr);
      const startTime = str(p, 'time');
      const endDate = str(p, 'endDate');
      const endTime = str(p, 'endTime');
      const startPart = startTime ? `${d} · ${startTime}` : d;
      const hasEndDate = endDate && endDate !== startDateStr;
      const endPart = hasEndDate
        ? endTime
          ? `${shortDate(lang, endDate)} · ${endTime}`
          : shortDate(lang, endDate)
        : endTime
          ? endTime
          : '';
      const when = endPart ? `${startPart} → ${endPart}` : startPart;
      if (es) return { title: '📅 Nuevo evento', body: `${actor} añadió "${title}" · ${when}` };
      if (he) return { title: '📅 אירוע חדש', body: `${actor} הוסיף/ה "${title}" · ${when}` };
      return { title: '📅 New event', body: `${actor} added "${title}" · ${when}` };
    }

    case 'appliance_started': {
      const name = applianceLabel(lang, str(p, 'appliance'));
      const who = str(p, 'name') || (es ? 'Alguien' : he ? 'מישהו' : 'Someone');
      const minutes = typeof p['minutes'] === 'number' ? (p['minutes'] as number) : 0;
      const dur = minutes > 0 ? durationLabel(minutes) : '';
      if (es) {
        return {
          title: '🌀 Máquina en marcha',
          body: dur
            ? `${who} puso la ${name} — libre en ~${dur}`
            : `${who} puso la ${name} en marcha`,
        };
      }
      if (he) {
        return {
          title: '🌀 מכונה פועלת',
          body: dur
            ? `${who} הפעיל/ה את ${name} — תתפנה בעוד ~${dur}`
            : `${who} הפעיל/ה את ${name}`,
        };
      }
      return {
        title: '🌀 Machine running',
        body: dur ? `${who} started the ${name} — free in ~${dur}` : `${who} started the ${name}`,
      };
    }

    case 'appliance_free': {
      const name = applianceLabel(lang, str(p, 'appliance'));
      const Cap = name.charAt(0).toUpperCase() + name.slice(1);
      if (es) return { title: '🧺 Máquina libre', body: `La ${name} ya está libre — ¡a por ella!` };
      if (he) return { title: '🧺 המכונה פנויה', body: `${Cap} פנוי/ה עכשיו — קדימה!` };
      return { title: '🧺 Machine free', body: `${Cap} is free now — go for it!` };
    }

    default:
      return null;
  }
}
