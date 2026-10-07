/** "₪1180" or "₪1180.50" — whole amounts without decimals. */
export function formatMoney(currency: string, amount: number): string {
  return `${currency}${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}
