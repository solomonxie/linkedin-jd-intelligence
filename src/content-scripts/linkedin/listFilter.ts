// Dims job cards in LinkedIn's job list (search-results rail, "related jobs"
// rail on a detail page, etc.) that match the block list.
//
// LinkedIn's list markup has no <li> wrapper and no stable class name (every
// class here is a hashed CSS-module name that changes across deploys), and a
// card's job-view anchor carries no SEO slug — just a bare
// /jobs/view/{id}/?trackingId=... — so neither of this file's first attempt
// at finding "the card" and "the company name" holds up. What *is* stable:
// the anchor's own text is the job title, and walking up from it, the first
// ancestor whose text is meaningfully longer than the title alone is the
// card (title + company + location + meta all concatenated with no
// separator, e.g. "AffirmSenior Software Engineer, Backend..."). Company
// matching against that blob is necessarily substring-based, not the exact
// key match the side panel uses — a deliberate, looser tradeoff scoped to
// this file alone (see reasonForCardContent).
//
// Every card, and the pass as a whole, is wrapped defensively: a malformed
// card or a settings-read failure only skips filtering, it never throws out
// of this module and never touches the rest of the content script (the JD
// scraper in main.ts keeps working regardless).

import type { BlockReason } from "../../shared/blockList";
import { getSettings, onSettingsChanged } from "../../shared/storage";
import type { Settings } from "../../shared/types";
import { extractJobId } from "./scraper";

const BADGE_CLASS = "jdi-blocked-badge";
const BADGE_STYLE =
  "position:absolute;top:4px;right:4px;background:#b91c1c;color:#fff;font:600 11px system-ui,sans-serif;" +
  "padding:2px 6px;border-radius:4px;z-index:2;pointer-events:none;";

// A card boundary must have at least this much text beyond the title alone (company + location +
// meta) — filters out trivial single-wrapper-div hops that don't actually add anything.
const MIN_EXTRA_TEXT = 5;
// Safety cap so a title-less/textless anchor (icon-only link, unexpected markup) can't walk this
// all the way up to <body> and have every card on the page collapse into one "card."
const MAX_ANCESTOR_HOPS = 10;

interface CardInfo {
  card: HTMLElement;
  jobId: string | null;
  titleText: string;
  companyBlob: string;
}

let currentSettings: Settings | null = null;
let passScheduled = false;

/** Walks up from a job-view anchor to the smallest ancestor whose text is meaningfully longer than
 * the anchor's own — see the module comment for why depth/class name aren't usable instead. */
function findCardBoundary(anchor: HTMLAnchorElement): HTMLElement | null {
  const anchorText = anchor.textContent?.trim() ?? "";
  let el: HTMLElement | null = anchor;
  for (let i = 0; i < MAX_ANCESTOR_HOPS && el; i++) {
    const text = el.textContent?.trim() ?? "";
    if (text.length >= anchorText.length + MIN_EXTRA_TEXT) return el;
    el = el.parentElement;
  }
  return null;
}

export function findJobCards(): CardInfo[] {
  const anchors = document.querySelectorAll<HTMLAnchorElement>('a[href*="/jobs/view/"]');
  const seen = new Set<HTMLElement>();
  const cards: CardInfo[] = [];
  for (const anchor of anchors) {
    const card = findCardBoundary(anchor);
    if (!card || seen.has(card)) continue;
    seen.add(card);
    const titleText = anchor.textContent?.trim() ?? "";
    const fullText = card.textContent?.trim() ?? "";
    // Company name + location/meta, with the title text (found once) cut back out — see module
    // comment. Order between what was before/after the title in the DOM doesn't matter, both ends
    // just get concatenated; that's still fine for a substring check.
    const companyBlob = titleText ? fullText.replace(titleText, " ") : fullText;
    cards.push({ card, jobId: extractJobId(anchor.href), titleText, companyBlob });
  }
  return cards;
}

/** Pure: derives the block reason (if any) for a card from its title text + the surrounding
 * "everything else" blob — no DOM, no chrome APIs, so this is the part of the module worth
 * unit-testing directly. Company matching is a substring check against the blob (not the side
 * panel's exact key match) since the card gives no isolated company-name field to key off. */
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

export function applyCardState(card: HTMLElement, reason: BlockReason | null): void {
  const badge = card.querySelector<HTMLElement>(`.${BADGE_CLASS}`);
  if (!reason) {
    card.style.opacity = "";
    card.style.filter = "";
    badge?.remove();
    return;
  }
  card.style.opacity = "0.35";
  card.style.filter = "grayscale(1)";
  if (!badge) {
    if (getComputedStyle(card).position === "static") card.style.position = "relative";
    const el = document.createElement("div");
    el.className = BADGE_CLASS;
    el.textContent = "🚫 Blocked";
    el.style.cssText = BADGE_STYLE;
    card.appendChild(el);
  }
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
