// Normalizes whatever wording a posting (or the model) used for pay into one fixed shape:
// "$120k-150k CAD", "$120k USD", "$50-70/hr USD". No thousands separators, no cents, no symbol
// prefixes like "C$" — the currency is always a plain "$" plus a trailing ISO code, so two postings
// in different currencies can't look alike at a glance.

const SYMBOL_CURRENCIES: [RegExp, string][] = [
  [/\b(?:c|ca|cad|cdn)\s*\$/i, "CAD"],
  [/\b(?:us|usd)\s*\$/i, "USD"],
  [/\b(?:a|au|aud)\s*\$/i, "AUD"],
  [/\bnz\s*\$/i, "NZD"],
  [/£/, "GBP"],
  [/€/, "EUR"],
  [/₹/, "INR"],
];
const CURRENCY_CODES = ["USD", "CAD", "GBP", "EUR", "AUD", "NZD", "INR", "SGD", "JPY", "CHF", "SEK", "MXN", "BRL"];

const HOURLY_PATTERN = /(per\s*hour|hourly|an\s*hour|\/\s*h(?:r|our)?\b)/i;
// A retirement-plan mention would otherwise read as the number 401,000.
const RETIREMENT_PLAN_PATTERN = /401\s*\(?k\)?/gi;
const AMOUNT_PATTERN = /(\d+(?:[.,]\d+)*)\s*([km])?/gi;

export function normalizeSalaryRange(raw: string | null): string | null {
  if (!raw) return null;
  const text = raw.replace(RETIREMENT_PLAN_PATTERN, " ").trim();
  if (!text) return null;

  const currency = detectCurrency(text);
  const hourly = HOURLY_PATTERN.test(text);
  const amounts = extractAmounts(stripCurrencyWords(text), hourly);
  // Nothing parseable (e.g. "Competitive", "DOE") — leave the posting's own words alone rather than
  // inventing a number or blanking a real answer.
  if (amounts.length === 0) return raw.trim();

  const [low, high] = amounts;
  const format = (value: number) => (hourly ? String(Math.round(value)) : `${Math.round(value / 1000)}k`);
  const range = high !== undefined && high !== low ? `${format(low)}-${format(high)}` : format(low);
  return `$${range}${hourly ? "/hr" : ""}${currency ? ` ${currency}` : ""}`;
}

function detectCurrency(text: string): string | null {
  const code = CURRENCY_CODES.find((c) => new RegExp(`\\b${c}\\b`, "i").test(text));
  if (code) return code;
  for (const [pattern, currency] of SYMBOL_CURRENCIES) {
    if (pattern.test(text)) return currency;
  }
  // A bare "$" is ambiguous by nature; USD is the only defensible default, and the prompt asks the
  // model to state the code explicitly so this rarely decides anything.
  return text.includes("$") ? "USD" : null;
}

/** Drops currency words so their digits (if any) can't be read as amounts. */
function stripCurrencyWords(text: string): string {
  return CURRENCY_CODES.reduce((acc, code) => acc.replace(new RegExp(`\\b${code}\\b`, "gi"), " "), text);
}

/** The first two plausible pay figures, low first. */
function extractAmounts(text: string, hourly: boolean): number[] {
  const values: number[] = [];
  for (const match of text.matchAll(AMOUNT_PATTERN)) {
    const value = expand(match[1], match[2]);
    if (value === null) continue;
    const plausible = hourly ? value >= 5 && value <= 2000 : value >= 10_000;
    if (plausible && !values.includes(value)) values.push(value);
    if (values.length === 2) break;
  }
  return values.sort((a, b) => a - b);
}

function expand(digits: string, suffix: string | undefined): number | null {
  // "120,000" and "120.000" are both thousands-separated; "1.2m" is not.
  const bare = suffix ? digits.replace(/,/g, "") : digits.replace(/[.,](?=\d{3}\b)/g, "");
  const value = Number(bare.replace(/,/g, ""));
  if (!Number.isFinite(value) || value === 0) return null;
  const multiplier = suffix?.toLowerCase() === "k" ? 1_000 : suffix?.toLowerCase() === "m" ? 1_000_000 : 1;
  return value * multiplier;
}
