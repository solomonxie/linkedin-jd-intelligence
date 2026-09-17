// Content script entry: answers GET_PAGE_INFO with a live scrape, and pushes
// PAGE_CHANGED when LinkedIn's SPA routing changes the job being viewed
// without a full page load (chrome.tabs.onUpdated doesn't reliably fire for
// History-API navigation, so the side panel can't rely on that alone).

import {
  broadcastPageChanged,
  isExtensionContextValid,
  isGetPageInfoRequest,
  type PageInfoResponse,
} from "../../shared/messaging";
import { extractJobId, extractRawPageTextWhenReady } from "./scraper";
import { findCurrentJobCardInfo, initListFilter, scheduleListFilterPass } from "./listFilter";

async function buildPageInfo(): Promise<PageInfoResponse> {
  const jobId = extractJobId(location.href);
  // Best-effort, LLM-free — never lets a failure here stop the response, since rawPageText below is
  // the one thing Analyze actually depends on.
  let jobTitle: string | null = null;
  let company: string | null = null;
  try {
    if (jobId) ({ jobTitle, company } = findCurrentJobCardInfo(jobId));
  } catch {
    // See listFilter.ts's own module comment.
  }
  return {
    jobId,
    url: location.href,
    rawPageText: await extractRawPageTextWhenReady(document),
    jobTitle,
    company,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isGetPageInfoRequest(message)) return undefined;
  void buildPageInfo().then(sendResponse);
  return true; // async response — keep the message channel open until it resolves
});

// Registered after the message listener above so a failure here can never stop this tab from
// answering GET_PAGE_INFO — block-list list-dimming is a bonus, not core functionality.
try {
  initListFilter();
} catch {
  // See listFilter.ts's own module comment — this shouldn't throw, but never let it take the rest
  // of this content script down if it somehow does.
}

let lastUrl = location.href;

function notifyIfUrlChanged(): void {
  if (teardownIfOrphaned()) return;
  if (location.href === lastUrl) return;
  lastUrl = location.href;
  broadcastPageChanged();
}

const historyPatches = new Map<"pushState" | "replaceState", { patched: History[keyof History]; original: History[keyof History] }>();

function patchHistoryMethod(method: "pushState" | "replaceState"): void {
  const original = history[method];
  const bound = original.bind(history);
  const patched = ((...args: Parameters<History["pushState"]>) => {
    bound(...args);
    // LinkedIn's own router is the caller here — our bookkeeping must never throw into it.
    try {
      notifyIfUrlChanged();
    } catch {
      // See teardownIfOrphaned().
    }
  }) as History[typeof method];
  historyPatches.set(method, { patched, original });
  history[method] = patched;
}
patchHistoryMethod("pushState");
patchHistoryMethod("replaceState");

window.addEventListener("popstate", notifyIfUrlChanged);

// Fallback safety net in case a navigation changes the URL some other way
// (debounced since job-detail panels re-render often on their own). Also
// drives the block-list list-dimming pass — same DOM churn is what would
// reveal newly-rendered job cards, so one shared observer covers both.
let mutationDebounce: ReturnType<typeof setTimeout> | undefined;
const observer = new MutationObserver(() => {
  clearTimeout(mutationDebounce);
  mutationDebounce = setTimeout(() => {
    notifyIfUrlChanged();
    try {
      scheduleListFilterPass();
    } catch {
      // Same defensive stance as the initListFilter() call above.
    }
  }, 300);
});
observer.observe(document.body, { childList: true, subtree: true });

/**
 * Reloading, updating or disabling the extension doesn't unload this script from tabs that are
 * already open — Chrome leaves it running with a dead context, where chrome.runtime.getURL()
 * returns "chrome-extension://invalid/" and every chrome.* call throws synchronously. Left alone,
 * this script would keep firing on LinkedIn's DOM churn forever, throwing into the host page's
 * router on every SPA navigation. So the first time we notice, we unhook everything and go quiet;
 * the side panel already tells the user to reload the tab to get a live script back.
 */
function teardownIfOrphaned(): boolean {
  if (isExtensionContextValid()) return false;
  observer.disconnect();
  clearTimeout(mutationDebounce);
  window.removeEventListener("popstate", notifyIfUrlChanged);
  for (const [method, { patched, original }] of historyPatches) {
    // Only if nothing else patched over us since — clobbering another script's patch would break
    // the page in a different way.
    if (history[method] === patched) history[method] = original;
  }
  historyPatches.clear();
  return true;
}
