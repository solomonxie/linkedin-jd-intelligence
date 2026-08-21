// Typed message envelope for the three extension contexts.
//
// Side panel <-> content script: request/response over chrome.tabs.sendMessage,
// scoped to the LinkedIn tab being looked at.
//
// Side panel -> background: "ANALYZE" just kicks the work off and gets an
// immediate accept/reject ack — the actual result is written to IndexedDB and
// announced via a broadcast, not returned in this response, because analysis
// must keep running (and land in the cache) even if the side panel that asked
// for it has since closed. See docs/DESIGN.md "Task durability".

export interface GetPageInfoRequest {
  type: "GET_PAGE_INFO";
}

export interface PageInfoResponse {
  jobId: string | null;
  url: string;
  rawPageText: string;
}

export interface AnalyzeRequest {
  type: "ANALYZE";
  jobId: string;
  url: string;
  rawPageText: string;
  resumeProfileId: string;
}

export interface AnalyzeAck {
  ok: boolean;
  error?: string;
}

export interface JobRecordUpdatedMessage {
  type: "JOB_RECORD_UPDATED";
  jobId: string;
}

export async function requestPageInfo(tabId: number): Promise<PageInfoResponse> {
  return chrome.tabs.sendMessage(tabId, { type: "GET_PAGE_INFO" } satisfies GetPageInfoRequest);
}

export async function requestAnalyze(request: Omit<AnalyzeRequest, "type">): Promise<AnalyzeAck> {
  return chrome.runtime.sendMessage({ type: "ANALYZE", ...request } satisfies AnalyzeRequest);
}

export function broadcastJobRecordUpdated(jobId: string): void {
  const message: JobRecordUpdatedMessage = { type: "JOB_RECORD_UPDATED", jobId };
  // No open listener (e.g. side panel closed) rejects this — fine, IndexedDB
  // is the source of truth and the panel re-reads it on next open anyway.
  chrome.runtime.sendMessage(message).catch(() => {});
}

export function onJobRecordUpdated(callback: (jobId: string) => void): () => void {
  const listener = (message: unknown) => {
    if (isJobRecordUpdatedMessage(message)) callback(message.jobId);
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}

export function isAnalyzeRequest(message: unknown): message is AnalyzeRequest {
  return isObjectWithType(message, "ANALYZE");
}

export function isGetPageInfoRequest(message: unknown): message is GetPageInfoRequest {
  return isObjectWithType(message, "GET_PAGE_INFO");
}

function isJobRecordUpdatedMessage(message: unknown): message is JobRecordUpdatedMessage {
  return isObjectWithType(message, "JOB_RECORD_UPDATED");
}

function isObjectWithType(message: unknown, type: string): boolean {
  return typeof message === "object" && message !== null && (message as { type?: unknown }).type === type;
}
