// Dims job cards in LinkedIn's job list (search-results rail, "related jobs"
// rail on a detail page, etc.) that match the block list — same URL-slug
// heuristic the side panel uses for a pre-analysis block check (see
// shared/companyKey.ts, shared/blockList.ts), not a company/title DOM
// selector, so nothing here depends on LinkedIn's card markup beyond "an
// anchor pointing at /jobs/view/... sits inside an <li>." A miss (no slug in
// the href, no <li> ancestor) just means that card can't be evaluated —
// never a wrong block, same tradeoff as everywhere else this heuristic is
// used.
//
// Every card, and the pass as a whole, is wrapped defensively: a malformed
// card or a settings-read failure only skips filtering, it never throws out
// of this module and never touches the rest of the content script (the JD
// scraper in main.ts keeps working regardless).

import { checkBlocked, type BlockReason } from "../../shared/blockList";
import { extractCompanySlugHint, extractTitleSlugHint, humanizeSlug } from "../../shared/companyKey";
import { getSettings, onSettingsChanged } from "../../shared/storage";
import type { Settings } from "../../shared/types";
import { extractJobId } from "./scraper";

const BADGE_CLASS = "jdi-blocked-badge";
const BADGE_STYLE =
  "position:absolute;top:4px;right:4px;background:#b91c1c;color:#fff;font:600 11px system-ui,sans-serif;" +
  "padding:2px 6px;border-radius:4px;z-index:2;pointer-events:none;";

let currentSettings: Settings | null = null;
let passScheduled = false;

export function findJobCards(): HTMLElement[] {
  const anchors = document.querySelectorAll<HTMLAnchorElement>('a[href*="/jobs/view/"]');
  const cards = new Set<HTMLElement>();
  for (const anchor of anchors) {
    const card = anchor.closest("li");
    if (card instanceof HTMLElement) cards.add(card);
  }
  return Array.from(cards);
}

/** Pure: derives the block reason (if any) for a card from its job-view URL alone — no DOM, no
 * chrome APIs, so this is the part of the module worth unit-testing directly. */
export function reasonForHref(href: string, settings: Settings): BlockReason | null {
  const companySlug = extractCompanySlugHint(href);
  const titleSlug = extractTitleSlugHint(href);
  return checkBlocked(settings, {
    jobId: extractJobId(href),
    company: companySlug ? humanizeSlug(companySlug) : null,
    jobTitle: titleSlug ? humanizeSlug(titleSlug) : null,
  });
}

function reasonForCard(card: HTMLElement, settings: Settings): BlockReason | null {
  const anchor = card.querySelector<HTMLAnchorElement>('a[href*="/jobs/view/"]');
  if (!anchor) return null;
  return reasonForHref(anchor.href, settings);
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
  for (const card of findJobCards()) {
    try {
      applyCardState(card, reasonForCard(card, currentSettings));
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
