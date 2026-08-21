// Content script entry: answers GET_PAGE_INFO with a live scrape, and pushes
// PAGE_CHANGED when LinkedIn's SPA routing changes the job being viewed
// without a full page load (chrome.tabs.onUpdated doesn't reliably fire for
// History-API navigation, so the side panel can't rely on that alone).

import { broadcastPageChanged, isGetPageInfoRequest, type PageInfoResponse } from "../../shared/messaging";
import { extractJobId, extractRawPageText } from "./scraper";

function buildPageInfo(): PageInfoResponse {
  return {
    jobId: extractJobId(location.href),
    url: location.href,
    rawPageText: extractRawPageText(document),
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isGetPageInfoRequest(message)) return undefined;
  sendResponse(buildPageInfo());
  return undefined; // synchronous response, no need to keep the channel open
});

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
// (debounced since job-detail panels re-render often on their own).
let mutationDebounce: ReturnType<typeof setTimeout> | undefined;
new MutationObserver(() => {
  clearTimeout(mutationDebounce);
  mutationDebounce = setTimeout(notifyIfUrlChanged, 300);
}).observe(document.body, { childList: true, subtree: true });
