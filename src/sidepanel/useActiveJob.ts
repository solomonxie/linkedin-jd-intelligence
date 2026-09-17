// Tracks whichever LinkedIn tab is currently focused (the side panel is
// per-window, not per-tab), re-scrapes it, and looks up any cached
// JobRecord. Re-runs on tab focus/URL change, on the content script's
// PAGE_CHANGED push (SPA navigation without a full reload), and whenever a
// background analysis completes.

import { useCallback, useEffect, useRef, useState } from "react";
import { getJobRecord } from "../shared/db";
import { onJobRecordUpdated, onPageChanged, requestPageInfo, type PageInfoResponse } from "../shared/messaging";
import { extractJobId } from "../content-scripts/linkedin/scraper";
import type { JobRecord } from "../shared/types";

// Mirrors manifest.config.ts's content_scripts match pattern — the content script is only ever
// injected here, so anywhere else a missing response means "not an eligible page," not "reload me."
const LINKEDIN_JOBS_URL_PATTERN = /^https:\/\/www\.linkedin\.com\/jobs\//;

// The content script runs at document_idle, which on a page as heavy as LinkedIn's lands well
// after the side panel's first ask — so the first attempt losing the race is normal, not a
// missing script. Retry across a few seconds before believing it's really absent.
const PAGE_INFO_RETRY_DELAYS_MS = [150, 400, 1000, 2000];

/** Chrome's wording for "nothing is listening in that tab" — the only failure that a tab reload
 * actually fixes. Any other rejection is a real error and must not be reported as this. */
function isNoReceiverError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Receiving end does not exist|Could not establish connection/i.test(message);
}

async function requestPageInfoWithRetry(tabId: number): Promise<PageInfoResponse> {
  for (const delayMs of PAGE_INFO_RETRY_DELAYS_MS) {
    try {
      return await requestPageInfo(tabId);
    } catch (error) {
      if (!isNoReceiverError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return requestPageInfo(tabId);
}

export interface ActiveJobState {
  tabId: number | null;
  pageInfo: PageInfoResponse | null;
  record: JobRecord | null;
  loading: boolean;
  /**
   * requestPageInfo() rejected because no content script answered in this
   * tab — most commonly a LinkedIn tab that was already open when the
   * extension was installed/reloaded, so it never got the script injected.
   * Distinct from "not a job page" (pageInfo.jobId === null) so the UI can
   * tell the user to reload the tab instead of implying they're on the
   * wrong page.
   */
  contentScriptMissing: boolean;
  /**
   * False between spotting a new job in the tab's URL and the content script's scrape coming back.
   * `pageInfo` is a provisional stub in that window — its `rawPageText` is empty, so analysis must
   * wait; everything else (which job this is, its cached record) is already correct.
   */
  pageReady: boolean;
  /** Any other failure, surfaced verbatim rather than mislabelled as a missing content script. */
  loadError: string | null;
  refresh: () => void;
}

export function useActiveJob(): ActiveJobState {
  const [tabId, setTabId] = useState<number | null>(null);
  const [pageInfo, setPageInfo] = useState<PageInfoResponse | null>(null);
  const [record, setRecord] = useState<JobRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [contentScriptMissing, setContentScriptMissing] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = useCallback(() => setRefreshToken((t) => t + 1), []);

  // Guarded so an unrelated background tab finishing its load can't yank the panel's state. Reads
  // the tab id through a ref: the listener below is registered once and would otherwise close over
  // the id from first render forever.
  const tabIdRef = useRef<number | null>(null);
  tabIdRef.current = tabId;
  const pageInfoRef = useRef<PageInfoResponse | null>(null);
  pageInfoRef.current = pageInfo;
  // Identifies the newest fetch. Only it is allowed to clear the spinner, so a run superseded
  // mid-flight (PAGE_CHANGED can arrive faster than the retry loop finishes) can't strand it.
  const fetchRunRef = useRef(0);
  const refreshOnTab = useCallback(
    (updatedTabId: number) => {
      if (updatedTabId === tabIdRef.current) refresh();
    },
    [refresh],
  );

  useEffect(() => {
    let cancelled = false;
    async function updateActiveTab() {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!cancelled) setTabId(tab?.id ?? null);
    }
    // A same-tab reload keeps the same tabId, so setTabId() above is a no-op and nothing re-runs
    // the fetch below — the panel would sit on whatever the pre-reload attempt concluded forever.
    // Ask again explicitly once the new document is up.
    const onTabUpdated = (updatedTabId: number, info: chrome.tabs.OnUpdatedInfo) => {
      void updateActiveTab();
      // Only a finished document load. Deliberately NOT info.url: LinkedIn's SPA rewrites the URL
      // constantly, and each one restarting the retry loop below means it never gets to finish.
      // In-page navigation is already covered by the content script's PAGE_CHANGED push.
      if (info.status === "complete") refreshOnTab(updatedTabId);
    };
    updateActiveTab();
    chrome.tabs.onActivated.addListener(updateActiveTab);
    chrome.tabs.onUpdated.addListener(onTabUpdated);
    chrome.windows.onFocusChanged.addListener(updateActiveTab);
    return () => {
      cancelled = true;
      chrome.tabs.onActivated.removeListener(updateActiveTab);
      chrome.tabs.onUpdated.removeListener(onTabUpdated);
      chrome.windows.onFocusChanged.removeListener(updateActiveTab);
    };
  }, []);

  useEffect(() => onPageChanged(refresh), [refresh]);
  useEffect(() => onJobRecordUpdated(refresh), [refresh]);

  useEffect(() => {
    if (tabId === null) {
      setPageInfo(null);
      setRecord(null);
      setContentScriptMissing(false);
      setPageReady(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const runId = ++fetchRunRef.current;
    // Only the first fetch for a tab shows the spinner — a re-ask keeps the current view up rather
    // than flashing "Loading…" over it, so a stuck re-ask can never present as a stuck panel.
    setLoading((current) => current || pageInfoRef.current === null);
    setContentScriptMissing(false);
    setLoadError(null);

    (async () => {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (!tab.url || !LINKEDIN_JOBS_URL_PATTERN.test(tab.url)) {
          // No content script was ever going to answer here — this is just an ordinary
          // "wrong page" state, not a recoverable content-script-missing one.
          if (!cancelled) {
            setPageInfo({ jobId: null, url: tab.url ?? "", rawPageText: "", jobTitle: null, company: null });
            setRecord(null);
          }
          return;
        }

        // The tab's own URL already says which job this is, and it's available now — the content
        // script's scrape has to wait for LinkedIn's SPA to settle (seconds). Swap to the new job
        // immediately on the URL alone, so the panel can't sit showing the previous job's analysis as
        // if it were this one. rawPageText stays empty until the real scrape lands, which is what
        // pageReady gates.
        const urlJobId = extractJobId(tab.url);
        if (urlJobId !== pageInfoRef.current?.jobId) {
          setPageReady(false);
          setPageInfo({ jobId: urlJobId, url: tab.url, rawPageText: "", jobTitle: null, company: null });
          setRecord(urlJobId ? ((await getJobRecord(urlJobId)) ?? null) : null);
          if (cancelled) return;
        }

        const info = await requestPageInfoWithRetry(tabId);
        if (cancelled) return;
        setPageInfo(info);
        setRecord(info.jobId ? ((await getJobRecord(info.jobId)) ?? null) : null);
        setPageReady(true);
      } catch (error) {
        // Only a genuinely absent listener means "reload the tab". Everything else (a scrape that
        // threw, an IndexedDB failure) used to land here too and get reported as a missing content
        // script, which hid the actual error behind advice that could never fix it.
        if (!cancelled) {
          setPageInfo(null);
          setRecord(null);
          setPageReady(false);
          if (isNoReceiverError(error)) setContentScriptMissing(true);
          else setLoadError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (runId === fetchRunRef.current) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tabId, refreshToken]);

  return { tabId, pageInfo, record, loading, contentScriptMissing, pageReady, loadError, refresh };
}
