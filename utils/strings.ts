export function truncateText(text: string, maxLength: number): string {
  if (Number.isNaN(maxLength) || maxLength <= 0) throw new Error('maxLength must be positive');
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
}

export function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}
