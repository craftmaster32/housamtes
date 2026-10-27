export type MateOutfit = 'partyHat' | 'nightcap' | 'scarf' | null;

/**
 * What Mate wears right now: a party hat over New Year (31 Dec – 1 Jan), a
 * nightcap late at night (22:00–05:59), a scarf in winter (Dec – Feb).
 * Earlier rules win, so New Year's Eve at midnight is still a party.
 */
export function mateOutfitFor(date: Date): MateOutfit {
  const month = date.getMonth();
  const day = date.getDate();
  const hour = date.getHours();
  if ((month === 11 && day === 31) || (month === 0 && day === 1)) return 'partyHat';
  if (hour >= 22 || hour < 6) return 'nightcap';
  if (month === 11 || month <= 1) return 'scarf';
  return null;
}
