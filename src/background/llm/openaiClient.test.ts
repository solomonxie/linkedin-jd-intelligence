import { afterEach, describe, expect, it, vi } from "vitest";
import { callOpenAI } from "./openaiClient";

describe("callOpenAI", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to the chat completions endpoint and returns the message content", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"jobTitle":"x"}' } }] }),
    });
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
    expect(body.reasoning_effort).toBeUndefined();
  });

  it("includes reasoning_effort for a reasoning-capable model", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "{}" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await callOpenAI({ prompt: "x", apiKey: "sk-test", model: "gpt-5", reasoningEffort: "high" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.reasoning_effort).toBe("high");
  });

  it("omits reasoning_effort for a model that doesn't support it, even if requested", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "{}" } }] }),
    });
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

  it("throws when the response has no message content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) }),
    );

    await expect(callOpenAI({ prompt: "x", apiKey: "sk-test", model: "gpt-4o-mini" })).rejects.toThrow(
      /no message content/,
    );
  });
});
