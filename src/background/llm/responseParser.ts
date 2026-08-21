// Extracts and validates the fenced JSON block the LLM was asked to return.
// Tab/API responses aren't guaranteed-well-formed, so this is defensive:
// fenced -> bare-fenced -> first-{-to-last-} fallback, then zod validation.

import { z } from "zod";
import type { AnalysisResult, RequirementNode } from "../../shared/types";

function factSchema<T extends z.ZodTypeAny>(valueSchema: T) {
  const fact = z.object({
    value: valueSchema.nullable(),
    source: z.enum(["page", "llm-estimate"]),
  });
  // The model occasionally flattens Fact<T> to a bare value instead of
  // {value, source} despite the schema in the prompt — recover instead of
  // failing the whole response; "llm-estimate" is the safe default since we
  // can't tell whether an unwrapped value came from the page.
  return z.preprocess((input) => {
    if (input !== null && typeof input === "object" && "value" in (input as Record<string, unknown>)) {
      return input;
    }
    return { value: input ?? null, source: "llm-estimate" };
  }, fact);
}

const requirementNodeSchema: z.ZodType<RequirementNode> = z.lazy(() =>
  z.object({
    requirement: z.string(),
    tier: z.enum(["must-have", "nice-to-have", "implied"]),
    weight: z.number(),
    matched: z.boolean(),
    evidence: z.string().nullable(),
    resumeSnippet: z.string().nullable(),
    // A leaf node sometimes comes back as `children: null` instead of `[]` —
    // recover instead of failing the whole response over it.
    children: z.preprocess((v) => v ?? [], z.array(requirementNodeSchema)),
  }),
);

const companyInfoSchema = z.object({
  domain: factSchema(z.string()),
  mainProducts: factSchema(z.array(z.string())),
  employeeSize: factSchema(z.string()),
  engineeringSize: factSchema(z.string()),
  arr: factSchema(z.string()),
  fundingStage: factSchema(z.string()),
  ownership: factSchema(z.enum(["public", "private"])),
  techStack: factSchema(z.array(z.string())),
});

const roleInfoSchema = z.object({
  salaryRange: factSchema(z.string()),
  seniorHeadcount: factSchema(z.string()),
  applicantCount: factSchema(z.number()),
});

const analysisResultSchema = z.object({
  jobTitle: z.string(),
  company: z.string(),
  location: z.string(),
  // .catch(null) rather than a hard requirement — a field the model might
  // omit shouldn't fail the whole response over it.
  workplaceType: z.enum(["remote", "hybrid", "onsite"]).nullable().catch(null),
  companyInfo: companyInfoSchema,
  role: roleInfoSchema,
  roleClassification: z.object({
    normalizedRole: z.string(),
    rationale: z.string(),
  }),
  requirements: z.array(requirementNodeSchema),
  summary: z.string(),
}) satisfies z.ZodType<AnalysisResult>;

export type ParseResult =
  | { ok: true; result: AnalysisResult }
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
