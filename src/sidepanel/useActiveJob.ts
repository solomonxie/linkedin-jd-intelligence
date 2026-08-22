// Tracks whichever LinkedIn tab is currently focused (the side panel is
// per-window, not per-tab), re-scrapes it, and looks up any cached
// JobRecord. Re-runs on tab focus/URL change, on the content script's
// PAGE_CHANGED push (SPA navigation without a full reload), and whenever a
// background analysis completes.

import { useCallback, useEffect, useState } from "react";
import { getJobRecord } from "../shared/db";
import { onJobRecordUpdated, onPageChanged, requestPageInfo, type PageInfoResponse } from "../shared/messaging";
import type { JobRecord } from "../shared/types";

// Mirrors manifest.config.ts's content_scripts match pattern — the content script is only ever
// injected here, so anywhere else a missing response means "not an eligible page," not "reload me."
const LINKEDIN_JOBS_URL_PATTERN = /^https:\/\/www\.linkedin\.com\/jobs\//;

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
  refresh: () => void;
}

export function useActiveJob(): ActiveJobState {
  const [tabId, setTabId] = useState<number | null>(null);
  const [pageInfo, setPageInfo] = useState<PageInfoResponse | null>(null);
  const [record, setRecord] = useState<JobRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [contentScriptMissing, setContentScriptMissing] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = useCallback(() => setRefreshToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    async function updateActiveTab() {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!cancelled) setTabId(tab?.id ?? null);
    }
    updateActiveTab();
    chrome.tabs.onActivated.addListener(updateActiveTab);
    chrome.tabs.onUpdated.addListener(updateActiveTab);
    chrome.windows.onFocusChanged.addListener(updateActiveTab);
    return () => {
      cancelled = true;
      chrome.tabs.onActivated.removeListener(updateActiveTab);
      chrome.tabs.onUpdated.removeListener(updateActiveTab);
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
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setContentScriptMissing(false);

    (async () => {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (!tab.url || !LINKEDIN_JOBS_URL_PATTERN.test(tab.url)) {
          // No content script was ever going to answer here — this is just an ordinary
          // "wrong page" state, not a recoverable content-script-missing one.
          if (!cancelled) {
            setPageInfo({ jobId: null, url: tab.url ?? "", rawPageText: "" });
            setRecord(null);
          }
          return;
        }

        const info = await requestPageInfo(tabId);
        if (cancelled) return;
        setPageInfo(info);
        setRecord(info.jobId ? ((await getJobRecord(info.jobId)) ?? null) : null);
      } catch {
        // sendMessage rejected even though the tab matches the content script's URL pattern —
        // it was open before the extension was installed/reloaded, so no script attached.
        if (!cancelled) {
          setPageInfo(null);
          setRecord(null);
          setContentScriptMissing(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tabId, refreshToken]);

  return { tabId, pageInfo, record, loading, contentScriptMissing, refresh };
}
