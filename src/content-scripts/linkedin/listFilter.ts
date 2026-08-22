// Hides job cards in LinkedIn's job list (search-results rail, "related jobs" rail on a detail
// page, etc.) that match the block list.
//
// Two earlier attempts at this got the card boundary wrong — first assuming an <li> wrapper (there
// isn't one), then assuming a job-view anchor with an SEO slug (list cards aren't <a> elements at
// all — they're <div role="button"> with a JS click handler, no href). Checked against a real page,
// each card carries a stable, semantically-named marker instead of either:
// componentkey="job-card-component-ref-{jobId}" — clearly a React tracking key, not a hashed
// CSS-module class, so far less likely to shift on a LinkedIn redeploy than anything else on the
// page. Nothing on the detail pane (the currently-open job's own content) carries this attribute,
// so targeting it can't touch that pane — a real bug the anchor-based version had, since a handful
// of unrelated detail-pane links (feedback widget, footer, company-insight citations) happened to
// carry the open job's id as a query param and got matched instead of any list card.
//
// Every card, and the pass as a whole, is wrapped defensively: a malformed card or a settings-read
// failure only skips filtering, it never throws out of this module and never touches the rest of
// the content script (the JD scraper in main.ts keeps working regardless).

import type { BlockReason } from "../../shared/blockList";
import { getSettings, onSettingsChanged } from "../../shared/storage";
import type { Settings } from "../../shared/types";

const CARD_SELECTOR = '[componentkey^="job-card-component-ref-"]';
const CARD_KEY_PREFIX = "job-card-component-ref-";

interface CardInfo {
  card: HTMLElement;
  jobId: string;
  titleText: string;
  /** Clean company name, from the 2nd <p> in the card (title, company, location, in that order —
   * consistent across every sampled card). Empty string if a card doesn't follow that pattern. */
  companyText: string;
  companyBlob: string;
}

let currentSettings: Settings | null = null;
let passScheduled = false;

export function findJobCards(): CardInfo[] {
  const seen = new Set<string>();
  const cards: CardInfo[] = [];
  for (const el of document.querySelectorAll<HTMLElement>(CARD_SELECTOR)) {
    const jobId = el.getAttribute("componentkey")?.slice(CARD_KEY_PREFIX.length) ?? "";
    // The same card renders componentkey on both its outer <div role="button"> and an inner
    // wrapper — keep only the first (outermost, in document order) match per job id.
    if (!jobId || seen.has(jobId)) continue;
    seen.add(jobId);
    const paragraphs = el.querySelectorAll("p");
    const titleText = paragraphs[0]?.textContent?.trim() ?? "";
    const companyText = paragraphs[1]?.textContent?.trim() ?? "";
    const fullText = el.textContent?.trim() ?? "";
    // Company name + location/meta, with the title text (found once) cut back out — kept as a
    // fallback for matching on cards that don't follow the clean title/company/location <p> order.
    const companyBlob = titleText ? fullText.replace(titleText, " ") : fullText;
    cards.push({ card: el, jobId, titleText, companyText, companyBlob });
  }
  return cards;
}

/** Best-effort, LLM-free title/company for one job id, read straight from its own row in a
 * currently-rendered list (search-results rail, "related jobs" rail) — lets the side panel offer
 * "Block this job"/"Block this company" (and a non-blank label for either) before any analysis has
 * run. Null fields when that job's row isn't present on the page right now (e.g. a bare
 * /jobs/view/{id} page with no list rendered) — never a wrong guess, just sometimes unavailable. */
export function findCurrentJobCardInfo(jobId: string): { jobTitle: string | null; company: string | null } {
  const match = findJobCards().find((c) => c.jobId === jobId);
  return { jobTitle: match?.titleText || null, company: match?.companyText || null };
}

/** Pure: derives the block reason (if any) for a card from its job id, title text, and the
 * surrounding "everything else" blob — no DOM, no chrome APIs, so this is the part of the module
 * worth unit-testing directly. Company matching is a substring check against the blob (not the
 * side panel's exact key match) since the card gives no isolated company-name field to key off. */
export function reasonForCardContent(
  input: { jobId: string | null; titleText: string; companyBlob: string },
  settings: Settings,
): BlockReason | null {
  if (input.jobId) {
    const job = settings.blockedJobs.find((j) => j.jobId === input.jobId);
    if (job) return { type: "job", jobId: job.jobId };
  }

  const blobLower = input.companyBlob.toLowerCase();
  const company = settings.blockedCompanies.find((c) => blobLower.includes(c.name.toLowerCase()));
  if (company) return { type: "company", key: company.key, name: company.name };

  const companyKeyword = settings.companyBlockKeywords.find((k) => blobLower.includes(k.value.toLowerCase()));
  if (companyKeyword) return { type: "company-keyword", value: companyKeyword.value };

  const titleLower = input.titleText.toLowerCase();
  const roleKeyword = settings.roleBlockKeywords.find((k) => titleLower.includes(k.value.toLowerCase()));
  if (roleKeyword) return { type: "role-keyword", value: roleKeyword.value };

  return null;
}

/** Hides (not dims) a blocked card entirely, and un-hides one that no longer matches — idempotent,
 * so re-running it every pass with no change is a no-op either way. */
export function applyCardState(card: HTMLElement, reason: BlockReason | null): void {
  card.style.display = reason ? "none" : "";
}

function runFilterPass(): void {
  if (!currentSettings) return;
  for (const { card, jobId, titleText, companyBlob } of findJobCards()) {
    try {
      applyCardState(card, reasonForCardContent({ jobId, titleText, companyBlob }, currentSettings));
    } catch {
      // One malformed card never stops the rest of the list from being filtered.
    }
  }
}

/** Debounced entry point for callers (the shared MutationObserver in main.ts). */
export function scheduleListFilterPass(): void {
  if (passScheduled) return;
  passScheduled = true;
  setTimeout(() => {
    passScheduled = false;
    try {
      runFilterPass();
    } catch {
      // Whole-pass safety net — never let this reach main.ts's caller.
    }
  }, 0);
}

/** Call once at content-script startup. Loads the block list, runs an initial pass, and re-runs
 * whenever it changes (e.g. the user clicks "Block this company" in the side panel while this
 * LinkedIn tab is open). */
export function initListFilter(): void {
  getSettings()
    .then((settings) => {
      currentSettings = settings;
      scheduleListFilterPass();
    })
    .catch(() => {
      // No settings yet (or a storage error) — just skip filtering, nothing else depends on this.
    });

  onSettingsChanged((settings) => {
    currentSettings = settings;
    scheduleListFilterPass();
  });
}
