// Thin wrapper around the OpenAI Chat Completions API. response_format is set
// to json_object as a belt-and-suspenders layer on top of the fenced-JSON
// instruction already in the prompt — responseParser.ts handles both a bare
// JSON body (what json_object mode actually returns) and a fenced one.
//
// Streamed, for two reasons beyond progress: a non-streamed call leaves the MV3
// service worker with nothing to do for a minute-plus (see background/keepalive.ts),
// and it gives no way to tell "still generating" from "hung" — which is what
// STALL_TIMEOUT_MS below now decides.

import type { ReasoningEffort } from "../../shared/types";

/** Reasoning-capable models accept reasoning_effort; sending it to a model that doesn't support it
 * (e.g. gpt-4o, gpt-4.1) errors, so it's only included for models matching this. */
export function supportsReasoningEffort(model: string): boolean {
  return /^(gpt-5|o1|o3|o4)/.test(model);
}

/** Longest gap with zero bytes arriving — before the first token or between two of them — that still
 * counts as "working". A healthy call starts emitting well inside this; a longer silence has always
 * meant a dead request in practice, not a slow one. Note this is NOT a cap on total duration: a
 * steadily-streaming response is allowed to take as long as it takes (up to TOTAL_TIMEOUT_MS). */
const STALL_TIMEOUT_MS = 15_000;
/** Backstop for a response that trickles forever without ever finishing. */
const TOTAL_TIMEOUT_MS = 180_000;

export interface CallOpenAIParams {
  prompt: string;
  apiKey: string;
  model: string;
  reasoningEffort?: ReasoningEffort;
}

export async function callOpenAI({ prompt, apiKey, model, reasoningEffort }: CallOpenAIParams): Promise<string> {
  const controller = new AbortController();
  // fetch() rejects with a generic AbortError, which on its own reads as "something cancelled this"
  // and hides which deadline fired — keep the reason so the record's error message can name it.
  let abortReason: string | null = null;
  const abortWith = (reason: string) => {
    abortReason = reason;
    controller.abort();
  };

  const totalTimer = setTimeout(() => abortWith(`still streaming after ${TOTAL_TIMEOUT_MS / 1000}s`), TOTAL_TIMEOUT_MS);
  let stallTimer = setTimeout(() => abortWith(`no response from OpenAI within ${STALL_TIMEOUT_MS / 1000}s`), STALL_TIMEOUT_MS);
  const resetStallTimer = () => {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => abortWith(`OpenAI stopped sending data for ${STALL_TIMEOUT_MS / 1000}s`), STALL_TIMEOUT_MS);
  };

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        stream: true,
        ...(reasoningEffort && supportsReasoningEffort(model) ? { reasoning_effort: reasoningEffort } : {}),
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new Error(`OpenAI request failed (${response.status}): ${bodyText || response.statusText}`);
    }
    if (!response.body) {
      throw new Error("OpenAI response had no body");
    }

    const content = await readStreamedContent(response.body, resetStallTimer);
    if (!content) {
      throw new Error("OpenAI response had no message content");
    }
    return content;
  } catch (error) {
    if (abortReason) throw new Error(`OpenAI request aborted: ${abortReason}`);
    throw error;
  } finally {
    clearTimeout(totalTimer);
    clearTimeout(stallTimer);
  }
}

/** Concatenates the `delta.content` pieces of an SSE stream. `onData` is called for every raw chunk
 * (not just content ones) — keepalive pings and `[DONE]` are proof of life too. */
async function readStreamedContent(body: ReadableStream<Uint8Array>, onData: () => void): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  const drain = (chunk: string) => {
    buffer += chunk;
    // SSE events are separated by a blank line; whatever follows the last one is a partial event.
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) content += extractDelta(event);
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      onData();
      drain(decoder.decode(value, { stream: true }));
    }
  } finally {
    reader.releaseLock();
  }
  // A final event with no trailing blank line still carries content.
  if (buffer.trim()) content += extractDelta(buffer);
  return content;
}

function extractDelta(event: string): string {
  let text = "";
  for (const line of event.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice("data:".length).trim();
    if (!payload || payload === "[DONE]") continue;
    let parsed: { choices?: { delta?: { content?: string } }[]; error?: { message?: string } };
    try {
      parsed = JSON.parse(payload);
    } catch {
      continue; // Non-JSON keepalive/comment line.
    }
    // OpenAI reports a mid-stream failure in-band, after a 200 — without this it would surface as an
    // empty response ("no message content") instead of the actual reason.
    if (parsed.error) throw new Error(`OpenAI stream error: ${parsed.error.message ?? "unknown"}`);
    text += parsed.choices?.[0]?.delta?.content ?? "";
  }
  return text;
}

export interface VerifyApiKeyResult {
  ok: boolean;
  error?: string;
}

/** Cheap, side-effect-free check (list models) so Settings can confirm a key works before saving it. */
export async function verifyOpenAiApiKey(apiKey: string): Promise<VerifyApiKeyResult> {
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      return { ok: false, error: `OpenAI rejected the key (${response.status}): ${bodyText || response.statusText}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
