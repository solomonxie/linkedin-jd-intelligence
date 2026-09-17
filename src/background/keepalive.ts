// Chrome shuts an MV3 service worker down after ~30s of inactivity. An analysis
// is one long fetch, which from the worker's point of view can look like doing
// nothing — and if it's killed mid-flight nothing ever writes the record's
// terminal status, so the panel spins until the stale threshold with no reason
// to show. Calling any extension API resets that idle timer.

const PING_INTERVAL_MS = 20_000;

let holders = 0;
let timer: ReturnType<typeof setInterval> | null = null;

/** Keeps the worker alive until the returned release function is called. Ref-counted, so
 * overlapping analyses don't cancel each other's keepalive. */
export function acquireKeepalive(): () => void {
  holders += 1;
  timer ??= setInterval(() => void chrome.runtime.getPlatformInfo(), PING_INTERVAL_MS);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders -= 1;
    if (holders === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}
