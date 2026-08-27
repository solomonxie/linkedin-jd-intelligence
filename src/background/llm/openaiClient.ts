// Thin wrapper around the OpenAI Chat Completions API. response_format is set
// to json_object as a belt-and-suspenders layer on top of the fenced-JSON
// instruction already in the prompt — responseParser.ts handles both a bare
// JSON body (what json_object mode actually returns) and a fenced one.

import type { ReasoningEffort } from "../../shared/types";

/** Reasoning-capable models accept reasoning_effort; sending it to a model that doesn't support it
 * (e.g. gpt-4o, gpt-4.1) errors, so it's only included for models matching this. */
export function supportsReasoningEffort(model: string): boolean {
  return /^(gpt-5|o1|o3|o4)/.test(model);
}

export interface CallOpenAIParams {
  prompt: string;
  apiKey: string;
  model: string;
  reasoningEffort?: ReasoningEffort;
}

export async function callOpenAI({ prompt, apiKey, model, reasoningEffort }: CallOpenAIParams): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      ...(reasoningEffort && supportsReasoningEffort(model) ? { reasoning_effort: reasoningEffort } : {}),
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw new Error(`OpenAI request failed (${response.status}): ${bodyText || response.statusText}`);
  }

  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI response had no message content");
  }
  return content;
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
