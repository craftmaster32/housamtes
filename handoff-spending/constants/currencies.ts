// constants/currencies.ts
// Locale-aware currency catalog. Replaces the symbol-only contract that
// previously lived in `settingsStore` (which only stored e.g. "$", losing the
// distinction between USD/CAD/AUD and forcing every screen to hand-format
// numbers).
//
// New contract:
//   - `code` is the canonical key (ISO 4217). Persisted by settingsStore and
//      sent to the AI insight edge function as a string the model understands.
//   - `symbol`, `label`, `locale`, `decimals` are presentation-only.
//   - `formatFull(n, code)` and `formatShort(n, code)` are the only two
//      formatters any screen should use. Callers never touch `Intl` directly.
//
// Migration: settingsStore can keep `currency: string` as the symbol (legacy
// reads keep working) AND add `currencyCode: CurrencyCode`. New code should
// read `currencyCode`; old code reading `currency` keeps the symbol. A small
// helper `currencyFromSymbol(symbol)` covers the gap during rollout.

export type CurrencyCode =
  | 'ILS' | 'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD' | 'CHF' | 'JPY';

export interface Currency {
  code: CurrencyCode;
  symbol: string;
  label: string;
  locale: string;
  decimals: number;   // fraction digits for fmtFull (JPY = 0)
}

export const CURRENCIES: Record<CurrencyCode, Currency> = {
  ILS: { code: 'ILS', symbol: '₪',  label: 'Israeli Shekel',     locale: 'he-IL', decimals: 2 },
  USD: { code: 'USD', symbol: '$',  label: 'US Dollar',          locale: 'en-US', decimals: 2 },
  EUR: { code: 'EUR', symbol: '€',  label: 'Euro',               locale: 'en-IE', decimals: 2 },
  GBP: { code: 'GBP', symbol: '£',  label: 'British Pound',      locale: 'en-GB', decimals: 2 },
  AUD: { code: 'AUD', symbol: 'A$', label: 'Australian Dollar',  locale: 'en-AU', decimals: 2 },
  CAD: { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar',    locale: 'en-CA', decimals: 2 },
  CHF: { code: 'CHF', symbol: 'Fr', label: 'Swiss Franc',        locale: 'de-CH', decimals: 2 },
  JPY: { code: 'JPY', symbol: '¥',  label: 'Japanese Yen',       locale: 'ja-JP', decimals: 0 },
};

export const CURRENCY_LIST: Currency[] = Object.values(CURRENCIES);
export const DEFAULT_CURRENCY: CurrencyCode = 'ILS';

/** Look up a Currency from a code; falls back to DEFAULT_CURRENCY. */
export function getCurrency(code: CurrencyCode | string | undefined): Currency {
  if (code && code in CURRENCIES) return CURRENCIES[code as CurrencyCode];
  return CURRENCIES[DEFAULT_CURRENCY];
}

/**
 * Best-effort migration helper: map a legacy symbol-only string back to a
 * CurrencyCode. Ambiguous symbols (e.g. "$") resolve to USD; users can re-pick
 * the right one in Settings. Use this once at app boot to migrate `currency`
 * (symbol) → `currencyCode` (ISO).
 */
export function currencyFromSymbol(symbol: string | null | undefined): CurrencyCode {
  if (!symbol) return DEFAULT_CURRENCY;
  const match = CURRENCY_LIST.find((c) => c.symbol === symbol);
  return match?.code ?? DEFAULT_CURRENCY;
}

/** "₪1,234.56" — uses Intl when available, falls back to manual formatting. */
export function formatFull(amount: number, code: CurrencyCode | string): string {
  const cur = getCurrency(code);
  // Use Intl for thousands separators + locale-correct decimal mark.
  // Note: we use `currency: cur.code` with `currencyDisplay: 'narrowSymbol'`
  // so RN Hermes returns the short form when possible. We override the symbol
  // ourselves to keep visual consistency with the legacy "₪123.45" style.
  try {
    const fmt = new Intl.NumberFormat(cur.locale, {
      minimumFractionDigits: cur.decimals,
      maximumFractionDigits: cur.decimals,
    });
    return `${cur.symbol}${fmt.format(amount)}`;
  } catch {
    return `${cur.symbol}${amount.toFixed(cur.decimals)}`;
  }
}

/** "₪1.2k" / "₪540" — for tight chart labels and badges. */
export function formatShort(amount: number, code: CurrencyCode | string): string {
  const cur = getCurrency(code);
  if (!Number.isFinite(amount)) return `${cur.symbol}0`;
  if (Math.abs(amount) >= 1000) {
    return `${cur.symbol}${(amount / 1000).toFixed(1)}k`;
  }
  return `${cur.symbol}${amount.toFixed(0)}`;
}
