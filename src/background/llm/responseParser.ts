// Extracts and validates the fenced JSON block the LLM was asked to return.
// Tab/API responses aren't guaranteed-well-formed, so this is defensive:
// fenced -> bare-fenced -> first-{-to-last-} fallback, then zod validation.

import { z } from "zod";
import type { AnalysisResult, RequirementNode } from "../../shared/types";

/**
 * The LLM's raw response shape — companyInfo may legitimately be null when
 * the prompt told it company research was already cached (see
 * promptBuilder's CACHED COMPANY INFO section). The caller resolves this down
 * to a full AnalysisResult (companyInfo always populated, from the response
 * or from the cache) before it's persisted.
 */
export type AnalysisResponse = Omit<AnalysisResult, "companyInfo"> & { companyInfo: AnalysisResult["companyInfo"] | null };

function factSchema<T extends z.ZodTypeAny>(valueSchema: T) {
  const fact = z.object({
    value: valueSchema.nullable(),
    source: z.enum(["page", "llm-estimate"]),
  });
  // The model occasionally flattens Fact<T> to a bare value instead of
  // {value, source} despite the schema in the prompt — recover instead of
  // failing the whole response; "llm-estimate" is the safe default since we
  // can't tell whether an unwrapped value came from the page.
  //
  // Rarer failure mode, same shape: the model emits the *source tag itself*
  // ("page"/"llm-estimate") as the bare value, e.g. `"engineeringSize":
  // "llm-estimate"` instead of a real string — that string then survives
  // straight through to the UI looking like real data. Treat that exact
  // sentinel as "the model left this blank" (value: null) rather than a
  // literal value.
  return z.preprocess((input) => {
    if (input !== null && typeof input === "object" && "value" in (input as Record<string, unknown>)) {
      return input;
    }
    const value = input === "page" || input === "llm-estimate" ? null : (input ?? null);
    return { value, source: "llm-estimate" };
  }, fact);
}

// The model occasionally returns "true"/"false" (or "yes"/"no") as a string,
// or omits/nulls the field, instead of a real boolean — recover instead of
// failing the whole response over it.
const looseBooleanSchema = z.preprocess((v) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return /^(true|yes)$/i.test(v.trim());
  return Boolean(v);
}, z.boolean());

const requirementNodeSchema: z.ZodType<RequirementNode> = z.lazy(() =>
  z.object({
    requirement: z.string(),
    tier: z.enum(["must-have", "nice-to-have", "implied"]),
    weight: z.number(),
    matched: looseBooleanSchema,
    evidence: z.string().nullable(),
    resumeSnippet: z.string().nullable(),
    // A leaf node sometimes comes back as `children: null` instead of `[]` —
    // recover instead of failing the whole response over it.
    children: z.preprocess((v) => v ?? [], z.array(requirementNodeSchema)),
  }),
);

// The model occasionally returns a single string instead of an array for a
// multi-value field despite the schema in the prompt — recover instead of
// failing the whole response.
const stringArraySchema = z.preprocess((v) => (typeof v === "string" ? [v] : v), z.array(z.string()));

const companyInfoSchema = z.object({
  industry: factSchema(stringArraySchema),
  mainProducts: factSchema(z.array(z.string())),
  employeeSize: factSchema(z.string()),
  engineeringSize: factSchema(z.string()),
  arr: factSchema(z.string()),
  fundingStage: factSchema(z.string()),
  ownership: factSchema(z.enum(["public", "private"])),
  techStack: factSchema(z.array(z.string())),
});

const roleInfoSchema = z.object({
  team: factSchema(z.string()),
  teamMission: factSchema(z.string()),
  salaryRange: factSchema(z.string()),
  applicantCount: factSchema(z.number()),
  seniorHeadcount: factSchema(z.number()),
  // Not a Fact (see shared/types.ts) — same array/non-string recovery as `summary` below, but nullable
  // since most jobs shouldn't get one at all (ordinary applicant count).
  applicantCountInsight: z.preprocess(
    (v) => (typeof v === "string" ? v : Array.isArray(v) ? v.join(" ") : null),
    z.string().nullable(),
  ),
});

const interviewRoundSchema = z.object({
  label: z.string(),
  durationMinutes: z.number().nullable().catch(null),
  mode: z.string().nullable().catch(null),
  // The model should only ever write "page" — catch(...) just means a stray
  // "llm-estimate" (never asked for here) doesn't fail the whole response.
  source: z.enum(["page", "user"]).catch("page"),
});

const analysisResultSchema = z.object({
  jobTitle: z.string(),
  company: z.string(),
  location: z.string(),
  // .catch(null) rather than a hard requirement — a field the model might
  // omit shouldn't fail the whole response over it.
  workplaceType: z.enum(["remote", "hybrid", "onsite"]).nullable().catch(null),
  // null when the prompt told the model companyInfo was already cached (see
  // promptBuilder's CACHED COMPANY INFO section) — resolved by the caller.
  companyInfo: companyInfoSchema.nullable(),
  role: roleInfoSchema,
  roleClassification: z.object({
    normalizedRole: z.string(),
    rationale: z.string(),
  }),
  requirements: z.array(requirementNodeSchema),
  // Defaults to [] if the model omits it or sends null — nothing found is the common case.
  interviewRounds: z.preprocess((v) => v ?? [], z.array(interviewRoundSchema)),
  // The model occasionally returns an array of bullet points, or omits/nulls
  // this, instead of one string — recover instead of failing the whole
  // response over a summary.
  summary: z.preprocess((v) => (typeof v === "string" ? v : Array.isArray(v) ? v.join(" ") : ""), z.string()),
}) satisfies z.ZodType<AnalysisResponse>;

export type ParseResult =
  | { ok: true; result: AnalysisResponse }
  | { ok: false; rawText: string; reason: string };

export function parseAnalysisResponse(rawText: string): ParseResult {
  const candidate = extractJsonCandidate(rawText);
  if (!candidate) {
    return { ok: false, rawText, reason: "no JSON object found in response" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (error) {
    return { ok: false, rawText, reason: `invalid JSON: ${(error as Error).message}` };
  }

  const validated = analysisResultSchema.safeParse(parsed);
  if (!validated.success) {
    return { ok: false, rawText, reason: `schema validation failed: ${validated.error.message}` };
  }

  return { ok: true, result: validated.data };
}

function extractJsonCandidate(rawText: string): string | null {
  const jsonFence = rawText.match(/```json\s*([\s\S]*?)```/i);
  if (jsonFence) return jsonFence[1].trim();

  const bareFence = rawText.match(/```\s*([\s\S]*?)```/);
  if (bareFence) return bareFence[1].trim();

  const firstBrace = rawText.indexOf("{");
  const lastBrace = rawText.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return rawText.slice(firstBrace, lastBrace + 1);
  }

  return null;
}
