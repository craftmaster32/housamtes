// Guesses an expense's category from what it was for, like the grocery list
// guesses aisles. Words are in English, Hebrew and Spanish; the matching rules
// are the grocery ones (see `words()` in groceryCategory.ts).
import { detectCategory, OTHER_CATEGORY, words } from '@utils/groceryCategory';

/** The category every new expense starts on until it's recognised. */
export const DEFAULT_EXPENSE_CATEGORY = 'Other';

// prettier-ignore
const RULES: Array<{ category: string; re: RegExp }> = [
  { category: 'Rent', re: words([
    '=rent', 'landlord', 'שכירות', 'שכר דירה', 'בעל הבית', 'alquiler', 'arriendo',
  ]) },
  { category: 'Electricity', re: words([
    'electricity', 'electric bill', 'electric company', 'power bill', 'חשמל', 'חברת החשמל', 'electricidad', '=luz',
  ]) },
  { category: 'Water', re: words([
    'water bill', 'water company', '=מים', 'חשבון מים', 'תאגיד מים', 'factura del agua', '=agua',
  ]) },
  { category: 'Internet', re: words([
    'internet', 'wifi', 'wi-fi', 'router', 'broadband', 'fiber', 'fibre', 'bezeq', 'hot net',
    'אינטרנט', 'ראוטר', 'נתב', 'בזק', 'סיבים', 'fibra', 'banda ancha',
  ]) },
  { category: 'Health', re: words([
    'pharmacy', 'doctor', 'dentist', 'medicine', 'super-pharm', 'superpharm', 'clinic',
    'בית מרקחת', 'רופא', 'רופאה', 'תרופות', 'תרופה', 'סופר פארם', 'מרפאה', 'farmacia', 'médico',
    'medico', 'dentista',
  ]) },
  { category: 'Transport', re: words([
    'taxi', 'uber', 'gett', '=bus', '=train', 'fuel', 'petrol', 'gas station', 'parking', 'rav kav',
    'flight', 'מונית', 'אוטובוס', 'רכבת', 'דלק', 'חניה', 'רב קו', 'רב-קו', 'טיסה', 'gasolina',
    'tren', 'autobús', 'autobus', 'aparcamiento', 'vuelo',
  ]) },
  { category: 'Outside Food', re: words([
    'restaurant', 'pizza', 'takeaway', 'takeout', 'delivery', 'wolt', '10bis', 'sushi', 'burger',
    'cafe', 'café', 'coffee', 'dinner', 'lunch', 'breakfast', 'brunch', '=bar', 'falafel', 'shawarma',
    'מסעדה', 'פיצה', 'משלוח', 'וולט', 'סושי', 'המבורגר', 'ארוחת', 'קפה', 'בית קפה', '=בר',
    'פלאפל', 'שווארמה', 'restaurante', 'cena', 'almuerzo', 'desayuno', 'hamburguesa',
  ]) },
  { category: 'Entertainment', re: words([
    'cinema', 'movie', 'netflix', 'spotify', 'disney', 'concert', 'tickets', 'party', '=games',
    'museum', 'קולנוע', 'סרט', 'נטפליקס', 'ספוטיפיי', 'הופעה', 'כרטיסים', 'מסיבה',
    'מוזיאון', '=cine', 'película', 'entradas', 'fiesta', 'concierto', 'museo',
  ]) },
  { category: 'Groceries', re: words([
    'supermarket', 'grocer', 'shufersal', 'rami levy', 'victory', 'yochananof', 'osher ad',
    'tiv taam', 'mega', 'weekly shop', 'שופרסל', 'רמי לוי', 'ויקטורי', 'יוחננוף', 'אושר עד',
    'טיב טעם', '=סופר', 'מכולת', 'קניות', 'supermercado', 'mercadona', 'compra',
  ]) },
];

/**
 * The house category that best fits an expense title, or null when nothing is
 * recognised. Only returns categories the house actually has. A title that
 * reads like a shopping-list item ("milk", "toilet paper") counts as Groceries.
 */
export function guessExpenseCategory(title: string, available: string[]): string | null {
  const text = title.trim();
  if (!text) return null;
  const has = (name: string): string | undefined =>
    available.find((a) => a.toLowerCase() === name.toLowerCase());
  for (const rule of RULES) {
    if (rule.re.test(text)) {
      const match = has(rule.category);
      if (match) return match;
    }
  }
  if (detectCategory(text) !== OTHER_CATEGORY) return has('Groceries') ?? null;
  return null;
}

/** "Other" when the house has it, otherwise its first category. */
export function defaultExpenseCategory(available: string[]): string {
  return (
    available.find((a) => a.toLowerCase() === DEFAULT_EXPENSE_CATEGORY.toLowerCase()) ??
    available[0] ??
    ''
  );
}
