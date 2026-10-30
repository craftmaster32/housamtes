/**
 * Section names are stored in capitals ("GENERAL"); redesigned pages write them
 * as a word ("General"). Scripts without case (Hebrew) come back unchanged.
 */
export function asWord(label: string): string {
  return label.charAt(0) + label.slice(1).toLowerCase();
}
