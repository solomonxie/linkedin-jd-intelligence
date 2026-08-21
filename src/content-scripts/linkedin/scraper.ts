// Pure extraction functions — no per-field DOM selectors beyond a broad text
// grab. Job id comes from a URL regex (far more stable than any DOM
// selector); everything else is raw text the LLM extracts itself.
// See docs/DESIGN.md "LinkedIn scraping".

const MAX_TEXT_LENGTH = 20_000;

/**
 * Job id from `/jobs/view/{id}`, LinkedIn's SEO-slugged
 * `/jobs/view/{title-slug}-{id}` form, or the `currentJobId` query param;
 * null if this isn't a job page.
 */
export function extractJobId(url: string): string | null {
  const viewMatch = url.match(/\/jobs\/view\/(?:[^/?]*-)?(\d+)(?:[/?]|$)/);
  if (viewMatch) return viewMatch[1];

  try {
    const currentJobId = new URL(url).searchParams.get("currentJobId");
    if (currentJobId) return currentJobId;
  } catch {
    // Malformed URL — fall through to null.
  }

  return null;
}

export function isJobPage(url: string): boolean {
  return extractJobId(url) !== null;
}

/**
 * Broad text grab: `main` landmark, falling back to the whole body, capped to
 * keep token cost predictable on LinkedIn's often-long pages. Prefers
 * innerText (visible-text-only) but falls back to textContent, since jsdom
 * (used in tests) doesn't implement layout-aware innerText.
 */
export function extractRawPageText(doc: Document = document): string {
  const scope = doc.querySelector("main") ?? doc.body;
  const text = getVisibleText(scope).trim();
  return text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
}

function getVisibleText(el: Element | null): string {
  if (!el) return "";
  const withInnerText = el as HTMLElement;
  return withInnerText.innerText ?? el.textContent ?? "";
}

const READY_POLL_INTERVAL_MS = 150;
const READY_POLL_TIMEOUT_MS = 3000;
// Substring, not exact match — LinkedIn's toggles often carry extra
// accessibility-only text alongside the visible label (e.g. a visually-hidden
// span describing what's being expanded), so an exact-string match would
// silently miss them. Requires "more" without "less" nearby so an
// already-expanded toggle (now reading "...see less") is never re-collapsed,
// and a from/to word pair like "less" ... "more" close together doesn't false-match.
const EXPAND_TEXT_PATTERN = /\b(show|see) more\b/i;
const COLLAPSE_TEXT_PATTERN = /\bless\b/i;
// Deliberately NOT <a> — an in-place "show more" toggle is a <button> (or a
// non-anchor element wearing role="button"); a real anchor's job is to
// navigate, and clicking one does exactly that (confirmed live: this matched
// a company-profile link and hijacked the page). The runtime guard below is
// a second line of defense for any <a role="button"> that still slips through.
const EXPANDABLE_SELECTOR = 'button, [role="button"]';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Clicks every "Show more"/"See more"-style toggle in scope so the job
 * description and any collapsed premium insight sections render their full
 * content into the DOM before scraping. Best-effort text match — not
 * verified against LinkedIn's live markup, since specific button wording and
 * structure can vary or change. Never clicks a real <a href> — that
 * navigates the page instead of expanding anything in place. */
function expandCollapsedSections(scope: Element): void {
  for (const el of Array.from(scope.querySelectorAll<HTMLElement>(EXPANDABLE_SELECTOR))) {
    if (el instanceof HTMLAnchorElement && el.hasAttribute("href")) continue;
    const text = el.textContent?.trim() ?? "";
    if (EXPAND_TEXT_PATTERN.test(text) && !COLLAPSE_TEXT_PATTERN.test(text)) el.click();
  }
}

/**
 * LinkedIn's SPA updates the URL (and job id) immediately on navigation but
 * fetches and renders the newly-selected job's description asynchronously —
 * scraping right away can capture stale text left over from the previous job,
 * or a half-rendered page. Poll until two consecutive reads agree (rendering
 * has settled) or the timeout elapses, then expand any collapsed sections and
 * take a final read.
 */
export async function extractRawPageTextWhenReady(
  doc: Document = document,
  { pollIntervalMs = READY_POLL_INTERVAL_MS, timeoutMs = READY_POLL_TIMEOUT_MS }: { pollIntervalMs?: number; timeoutMs?: number } = {},
): Promise<string> {
  const scope = () => doc.querySelector("main") ?? doc.body;
  let previous: string | null = null;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const current = getVisibleText(scope()).trim();
    if (current.length > 0 && current === previous) break;
    previous = current;
    await delay(pollIntervalMs);
  }
  expandCollapsedSections(scope());
  await delay(pollIntervalMs);
  const text = getVisibleText(scope()).trim();
  return text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
}
