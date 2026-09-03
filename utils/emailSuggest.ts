// Common providers a mistyped domain is checked against — catches typos like
// "gmial.com" or "yaho.com" before the form is submitted. This is a heuristic,
// not proof the address is real: the confirmation email is still what
// actually verifies that.
const COMMON_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'aol.com',
  'live.com',
  'msn.com',
  'protonmail.com',
];

const MAX_SUGGEST_DISTANCE = 2;

function levenshteinDistance(a: string, b: string): number {
  const prevRow: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  let currRow: number[] = [];
  for (let i = 1; i <= a.length; i++) {
    currRow = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(currRow[j - 1] + 1, prevRow[j] + 1, prevRow[j - 1] + cost);
    }
    prevRow.splice(0, prevRow.length, ...currRow);
  }
  return prevRow[b.length];
}

/**
 * Returns a corrected email address when the domain looks like a typo of a
 * common provider, or null when there's nothing to suggest (already valid,
 * no "@", or too far from any known domain to guess confidently).
 */
export function suggestEmailCorrection(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return null;

  const localPart = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (COMMON_EMAIL_DOMAINS.includes(domain)) return null;

  let closest: string | null = null;
  let closestDistance = Infinity;
  for (const candidate of COMMON_EMAIL_DOMAINS) {
    const distance = levenshteinDistance(domain, candidate);
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = candidate;
    }
  }

  if (closest && closestDistance > 0 && closestDistance <= MAX_SUGGEST_DISTANCE) {
    return `${localPart}@${closest}`;
  }
  return null;
}
