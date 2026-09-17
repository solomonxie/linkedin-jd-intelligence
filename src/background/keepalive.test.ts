import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { acquireKeepalive } from "./keepalive";

describe("acquireKeepalive", () => {
  const getPlatformInfo = vi.fn().mockResolvedValue({});

  beforeEach(() => {
    vi.useFakeTimers();
    getPlatformInfo.mockClear();
    vi.stubGlobal("chrome", { runtime: { getPlatformInfo } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("pings while held and stops once released", async () => {
    const release = acquireKeepalive();
    await vi.advanceTimersByTimeAsync(45_000);
    expect(getPlatformInfo).toHaveBeenCalledTimes(2);

    release();
    await vi.advanceTimersByTimeAsync(45_000);
    expect(getPlatformInfo).toHaveBeenCalledTimes(2);
  });

  it("keeps pinging until the last holder releases", async () => {
    const releaseFirst = acquireKeepalive();
    const releaseSecond = acquireKeepalive();

    releaseFirst();
    releaseFirst(); // Double release must not drop the second holder's count.
    await vi.advanceTimersByTimeAsync(20_000);
    expect(getPlatformInfo).toHaveBeenCalledTimes(1);

    releaseSecond();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(getPlatformInfo).toHaveBeenCalledTimes(1);
  });
});
