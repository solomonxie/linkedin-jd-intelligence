import { afterEach, describe, expect, it, vi } from "vitest";
import { callOpenAI } from "./openaiClient";

/** A Response-alike whose body streams the given SSE chunks. */
function streamingResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  return {
    ok: true,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
  };
}

function contentEvent(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
}

describe("callOpenAI", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("posts to the chat completions endpoint and joins the streamed deltas", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      streamingResponse([contentEvent('{"jobTitle":'), contentEvent('"x"}'), "data: [DONE]\n\n"]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await callOpenAI({ prompt: "analyze this", apiKey: "sk-test", model: "gpt-4o-mini" });

    expect(result).toBe('{"jobTitle":"x"}');
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer sk-test" }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.stream).toBe(true);
    expect(body.reasoning_effort).toBeUndefined();
  });

  it("joins deltas split across chunk boundaries mid-event", async () => {
    const event = contentEvent("hello");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamingResponse([event.slice(0, 20), event.slice(20)])));

    await expect(callOpenAI({ prompt: "x", apiKey: "sk-test", model: "gpt-4o-mini" })).resolves.toBe("hello");
  });

  it("reads a trailing event that has no blank line after it", async () => {
    const event = contentEvent("hi").trimEnd();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamingResponse([event])));

    await expect(callOpenAI({ prompt: "x", apiKey: "sk-test", model: "gpt-4o-mini" })).resolves.toBe("hi");
  });

  it("includes reasoning_effort for a reasoning-capable model", async () => {
    const fetchMock = vi.fn().mockResolvedValue(streamingResponse([contentEvent("{}")]));
    vi.stubGlobal("fetch", fetchMock);

    await callOpenAI({ prompt: "x", apiKey: "sk-test", model: "gpt-5", reasoningEffort: "high" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.reasoning_effort).toBe("high");
  });

  it("omits reasoning_effort for a model that doesn't support it, even if requested", async () => {
    const fetchMock = vi.fn().mockResolvedValue(streamingResponse([contentEvent("{}")]));
    vi.stubGlobal("fetch", fetchMock);

    await callOpenAI({ prompt: "x", apiKey: "sk-test", model: "gpt-4o-mini", reasoningEffort: "high" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.reasoning_effort).toBeUndefined();
  });

  it("throws with the status and body when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () => "invalid api key",
      }),
    );

    await expect(callOpenAI({ prompt: "x", apiKey: "bad", model: "gpt-4o-mini" })).rejects.toThrow(
      /401.*invalid api key/s,
    );
  });

  it("surfaces an error delivered mid-stream after a 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(streamingResponse([`data: ${JSON.stringify({ error: { message: "rate limited" } })}\n\n`])),
    );

    await expect(callOpenAI({ prompt: "x", apiKey: "sk-test", model: "gpt-4o-mini" })).rejects.toThrow(
      /stream error: rate limited/,
    );
  });

  it("throws when the stream carries no content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamingResponse(["data: [DONE]\n\n"])));

    await expect(callOpenAI({ prompt: "x", apiKey: "sk-test", model: "gpt-4o-mini" })).rejects.toThrow(
      /no message content/,
    );
  });

  it("aborts with a named reason when nothing arrives within the stall timeout", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    // Attached before the clock moves: a rejection with no handler yet trips vitest's
    // unhandled-rejection check even though the assertion below would have caught it.
    const rejects = expect(callOpenAI({ prompt: "x", apiKey: "sk-test", model: "gpt-5" })).rejects.toThrow(
      /aborted: no response from OpenAI within 15s/,
    );
    await vi.advanceTimersByTimeAsync(15_000);

    await rejects;
  });

  it("keeps waiting past the stall timeout while data is still arriving", async () => {
    vi.useFakeTimers();
    const encoder = new TextEncoder();
    let push: ((chunk: string) => void) | null = null;
    let finish: (() => void) | null = null;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        push = (chunk) => controller.enqueue(encoder.encode(chunk));
        finish = () => controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body }));

    const pending = callOpenAI({ prompt: "x", apiKey: "sk-test", model: "gpt-5" });
    for (let i = 0; i < 4; i += 1) {
      await vi.advanceTimersByTimeAsync(10_000);
      push!(contentEvent("a"));
    }
    await vi.advanceTimersByTimeAsync(1);
    finish!();

    await expect(pending).resolves.toBe("aaaa");
  });
});
