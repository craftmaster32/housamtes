// Localized dad jokes for the daily-joke push notification. Kept server-side so
// the Edge Function doesn't depend on the app bundle. One joke is chosen per
// calendar day (deterministically), so the whole house gets the same groan.

import type { Lang } from './notificationCopy.ts';

interface Joke {
  setup: string;
  punchline: string;
}

const JOKES: Record<Lang, Joke[]> = {
  en: [
    {
      setup: 'Why did the housemate bring a ladder to pay rent?',
      punchline: 'The cost was through the roof.',
    },
    { setup: 'What do you call a shared fridge with no food?', punchline: 'A cold case.' },
    {
      setup: 'Why did the dish soap break up with the sponge?',
      punchline: 'It felt taken for granted.',
    },
    {
      setup: "Why don't bills ever get invited to parties?",
      punchline: 'They always bring the total down.',
    },
    { setup: 'What did the broom say when it was late?', punchline: 'Sorry, I over-swept.' },
    {
      setup: 'Why did the parking spot go to therapy?',
      punchline: 'It had too many boundary issues.',
    },
    { setup: 'How does a house stay in shape?', punchline: 'Lots of running… water.' },
    { setup: 'Why was the grocery list so calm?', punchline: 'It had everything under control.' },
    { setup: 'What do you call roommates who never argue?', punchline: 'Fictional.' },
    { setup: 'Why did the trash can blush?', punchline: 'It saw the recycling bin.' },
    { setup: 'What did the WiFi say to the housemate?', punchline: 'We really have a connection.' },
    { setup: 'Why did the chore chart get promoted?', punchline: 'It always followed through.' },
  ],
  es: [
    {
      setup: '¿Por qué el compañero trajo una escalera para pagar el alquiler?',
      punchline: 'El precio estaba por las nubes.',
    },
    { setup: '¿Cómo se llama una nevera compartida sin comida?', punchline: 'Un caso frío.' },
    {
      setup: '¿Por qué las cuentas nunca van a las fiestas?',
      punchline: 'Siempre bajan el total.',
    },
    { setup: '¿Por qué la escoba llegó tarde?', punchline: 'Se quedó barriendo de más.' },
    {
      setup: '¿Por qué la plaza de parking fue a terapia?',
      punchline: 'Tenía problemas de límites.',
    },
    { setup: '¿Cómo se mantiene en forma una casa?', punchline: 'Con mucha agua… corriente.' },
    { setup: '¿Cómo se llama a los compañeros que nunca discuten?', punchline: 'Ficticios.' },
    { setup: '¿Por qué se sonrojó el cubo de basura?', punchline: 'Vio el de reciclaje.' },
    { setup: '¿Qué le dijo el WiFi al compañero?', punchline: 'Tenemos una conexión de verdad.' },
    { setup: '¿Por qué ascendieron a la lista de tareas?', punchline: 'Siempre cumplía.' },
    { setup: '¿Por qué el jabón dejó a la esponja?', punchline: 'Se sentía dado por sentado.' },
    {
      setup: '¿Por qué la lista de la compra estaba tan tranquila?',
      punchline: 'Lo tenía todo bajo control.',
    },
  ],
  he: [
    { setup: 'למה השותף הביא סולם כדי לשלם שכר דירה?', punchline: 'כי המחיר היה בשמיים.' },
    { setup: 'איך קוראים למקרר משותף בלי אוכל?', punchline: 'תיק קר.' },
    { setup: 'למה חשבונות אף פעם לא מוזמנים למסיבות?', punchline: 'הם תמיד מורידים את הסכום.' },
    { setup: 'למה המטאטא איחר?', punchline: 'הוא נסחף.' },
    { setup: 'למה החניה הלכה לטיפול?', punchline: 'היו לה בעיות גבולות.' },
    { setup: 'איך בית נשאר בכושר?', punchline: 'הרבה מים… זורמים.' },
    { setup: 'איך קוראים לשותפים שאף פעם לא רבים?', punchline: 'דמיוניים.' },
    { setup: 'למה פח האשפה הסמיק?', punchline: 'הוא ראה את פח המִחזור.' },
    { setup: 'מה ה־WiFi אמר לשותף?', punchline: 'יש בינינו חיבור אמיתי.' },
    { setup: 'למה קידמו את לוח המטלות?', punchline: 'הוא תמיד עמד במשימות.' },
    { setup: 'למה הסבון נפרד מהספוג?', punchline: 'הוא הרגיש מובן מאליו.' },
    { setup: 'למה רשימת הקניות הייתה כל כך רגועה?', punchline: 'הכול היה אצלה בשליטה.' },
  ],
};

export function dailyJokeTitle(lang: Lang): string {
  if (lang === 'es') return '🤣 Chiste malo del día';
  if (lang === 'he') return '🤣 בדיחת אבא יומית';
  return '🤣 Dad joke of the day';
}

/** Same joke for everyone on a given day; rotates as the days go by. */
export function pickDailyJoke(lang: Lang, date: Date): Joke {
  const list = JOKES[lang] ?? JOKES.en;
  const dayNumber = Math.floor(date.getTime() / 86_400_000);
  return list[((dayNumber % list.length) + list.length) % list.length];
}
