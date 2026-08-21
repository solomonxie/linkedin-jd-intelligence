// Turns a company name (or a best-effort guess of one) into a lookup key for
// shared/db.ts's "companies" store, so company-level facts can be reused
// across every job posting from the same company instead of re-derived by
// the LLM each time. Both are heuristics: neither is guaranteed to hit, but
// a miss just means the normal per-job LLM lookup runs — never a wrong answer.

const CORPORATE_SUFFIXES = /\b(inc|llc|ltd|corp|corporation|co|company)\b\.?/g;

/** Normalizes a display name into a stable lookup key ("Affirm, Inc." -> "affirm"). */
export function normalizeCompanyKey(name: string): string {
  return name
    .toLowerCase()
    .replace(CORPORATE_SUFFIXES, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Best-effort company name guess from LinkedIn's SEO-slugged job URL
 * (".../{title-slug}-at-{company-slug}-{id}/"), so a cache lookup can happen
 * *before* the LLM call that would otherwise be the only source of the
 * company name. The leading `.*` is greedy so it matches the last "-at-" in
 * the string, in case the job title itself contains the word "at".
 */
export function extractCompanySlugHint(url: string): string | null {
  const match = url.match(/\/jobs\/view\/.*-at-([a-z0-9-]+)-\d+(?:[/?]|$)/i);
  return match ? match[1] : null;
}
