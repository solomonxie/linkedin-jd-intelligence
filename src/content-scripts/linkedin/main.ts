// Content script entry: answers GET_PAGE_INFO with a live scrape, and pushes
// PAGE_CHANGED when LinkedIn's SPA routing changes the job being viewed
// without a full page load (chrome.tabs.onUpdated doesn't reliably fire for
// History-API navigation, so the side panel can't rely on that alone).

import { broadcastPageChanged, isGetPageInfoRequest, type PageInfoResponse } from "../../shared/messaging";
import { extractJobId, extractRawPageTextWhenReady } from "./scraper";
import { initListFilter, scheduleListFilterPass } from "./listFilter";

async function buildPageInfo(): Promise<PageInfoResponse> {
  return {
    jobId: extractJobId(location.href),
    url: location.href,
    rawPageText: await extractRawPageTextWhenReady(document),
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
  if (location.href === lastUrl) return;
  lastUrl = location.href;
  broadcastPageChanged();
}

function patchHistoryMethod(method: "pushState" | "replaceState"): void {
  const original = history[method].bind(history);
  history[method] = ((...args: Parameters<History["pushState"]>) => {
    original(...args);
    notifyIfUrlChanged();
  }) as History[typeof method];
}
patchHistoryMethod("pushState");
patchHistoryMethod("replaceState");

window.addEventListener("popstate", notifyIfUrlChanged);

// Fallback safety net in case a navigation changes the URL some other way
// (debounced since job-detail panels re-render often on their own). Also
// drives the block-list list-dimming pass — same DOM churn is what would
// reveal newly-rendered job cards, so one shared observer covers both.
let mutationDebounce: ReturnType<typeof setTimeout> | undefined;
new MutationObserver(() => {
  clearTimeout(mutationDebounce);
  mutationDebounce = setTimeout(() => {
    notifyIfUrlChanged();
    try {
      scheduleListFilterPass();
    } catch {
      // Same defensive stance as the initListFilter() call above.
    }
  }, 300);
}).observe(document.body, { childList: true, subtree: true });
