// Shared by background (deciding when to give up retrying implicitly) and the
// UI (deciding when to stop showing a spinner and offer a retry instead).

import type { JobRecord } from "./types";

export const STALE_PENDING_THRESHOLD_MS = 2 * 60 * 1000;

/** True once a "pending" record is old enough that its analysis was almost certainly abandoned. */
export function isStalePending(record: JobRecord): boolean {
  if (record.status !== "pending") return false;
  return Date.now() - new Date(record.startedAt).getTime() > STALE_PENDING_THRESHOLD_MS;
}
