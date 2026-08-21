// Pure extraction functions — no per-field DOM selectors beyond a broad text
// grab. Job id comes from a URL regex (far more stable than any DOM
// selector); everything else is raw text the LLM extracts itself.
// See docs/DESIGN.md "LinkedIn scraping".

const MAX_TEXT_LENGTH = 20_000;

/** Job id from `/jobs/view/{id}` or the `currentJobId` query param; null if this isn't a job page. */
export function extractJobId(url: string): string | null {
  const viewMatch = url.match(/\/jobs\/view\/(\d+)/);
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
