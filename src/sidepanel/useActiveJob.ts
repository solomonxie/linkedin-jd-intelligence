// Tracks whichever LinkedIn tab is currently focused (the side panel is
// per-window, not per-tab), re-scrapes it, and looks up any cached
// JobRecord. Re-runs on tab focus/URL change, on the content script's
// PAGE_CHANGED push (SPA navigation without a full reload), and whenever a
// background analysis completes.

import { useCallback, useEffect, useState } from "react";
import { getJobRecord } from "../shared/db";
import { onJobRecordUpdated, onPageChanged, requestPageInfo, type PageInfoResponse } from "../shared/messaging";
import type { JobRecord } from "../shared/types";

export interface ActiveJobState {
  tabId: number | null;
  pageInfo: PageInfoResponse | null;
  record: JobRecord | null;
  loading: boolean;
  refresh: () => void;
}

export function useActiveJob(): ActiveJobState {
  const [tabId, setTabId] = useState<number | null>(null);
  const [pageInfo, setPageInfo] = useState<PageInfoResponse | null>(null);
  const [record, setRecord] = useState<JobRecord | null>(null);
  const [loading, setLoading] = useState(true);
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
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const info = await requestPageInfo(tabId);
        if (cancelled) return;
        setPageInfo(info);
        setRecord(info.jobId ? ((await getJobRecord(info.jobId)) ?? null) : null);
      } catch {
        // No content script in this tab — most likely not a LinkedIn job page.
        if (!cancelled) {
          setPageInfo(null);
          setRecord(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tabId, refreshToken]);

  return { tabId, pageInfo, record, loading, refresh };
}
