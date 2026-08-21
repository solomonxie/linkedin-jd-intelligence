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
// Matches LinkedIn's job description toggle and the similar toggles on
// premium insight sections — deliberately excludes "...less" so an
// already-expanded section is never re-collapsed.
const EXPAND_BUTTON_PATTERN = /^(show|see) more$/i;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Clicks every "Show more"/"See more" toggle in scope so the job description
 * and any collapsed premium insight sections render their full content into
 * the DOM before scraping. */
function expandCollapsedSections(scope: Element): void {
  for (const button of Array.from(scope.querySelectorAll("button"))) {
    if (EXPAND_BUTTON_PATTERN.test(button.textContent?.trim() ?? "")) button.click();
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
