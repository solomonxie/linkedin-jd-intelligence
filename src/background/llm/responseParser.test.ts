import { describe, expect, it } from "vitest";
import { parseAnalysisResponse } from "./responseParser";

function validResultJson(overrides: Record<string, unknown> = {}) {
  return {
    jobTitle: "Senior Backend Engineer",
    company: "Acme Corp",
    location: "San Francisco, CA",
    workplaceType: "hybrid",
    companyInfo: {
      industry: { value: ["Tech"], source: "llm-estimate" },
      mainProducts: { value: null, source: "llm-estimate" },
      employeeSize: { value: "1,001-5,000", source: "page" },
      engineeringSize: { value: null, source: "llm-estimate" },
      arr: { value: null, source: "llm-estimate" },
      fundingStage: { value: "Public (NYSE)", source: "page" },
      ownership: { value: "public", source: "page" },
      techStack: { value: ["Python", "Go"], source: "llm-estimate" },
    },
    role: {
      salaryRange: { value: "$150K-$190K", source: "page" },
      applicantCount: { value: 87, source: "page" },
      seniorHeadcount: { value: 44, source: "page" },
    },
    roleClassification: { normalizedRole: "Data Engineer", rationale: "Focused on pipelines." },
    requirements: [
      {
        requirement: "Python",
        tier: "must-have",
        weight: 60,
        matched: true,
        evidence: "5 years Python",
        resumeSnippet: "Built services in Python",
        children: [],
      },
    ],
    interviewRounds: [],
    summary: "A backend role that's really data engineering.",
    ...overrides,
  };
}

describe("parseAnalysisResponse", () => {
  it("parses a well-formed ```json fenced block", () => {
    const raw = "Here you go:\n```json\n" + JSON.stringify(validResultJson()) + "\n```\nHope that helps!";
    const result = parseAnalysisResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.jobTitle).toBe("Senior Backend Engineer");
      expect(result.result.requirements[0].tier).toBe("must-have");
    }
  });

  it("falls back to a bare fenced block without a json tag", () => {
    const raw = "```\n" + JSON.stringify(validResultJson()) + "\n```";
    const result = parseAnalysisResponse(raw);
    expect(result.ok).toBe(true);
  });

  it("falls back to first-{-to-last-} when there's no fence at all", () => {
    const raw = "Sure, here is the result: " + JSON.stringify(validResultJson()) + " Let me know if needed.";
    const result = parseAnalysisResponse(raw);
    expect(result.ok).toBe(true);
  });

  it("reports failure with the raw text preserved when JSON is malformed", () => {
    const raw = "```json\n{ not valid json \n```";
    const result = parseAnalysisResponse(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rawText).toBe(raw);
      expect(result.reason).toMatch(/invalid JSON/);
    }
  });

  it("reports failure when the JSON doesn't match the schema", () => {
    const raw = "```json\n" + JSON.stringify({ jobTitle: "Only a title" }) + "\n```";
    const result = parseAnalysisResponse(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/schema validation failed/);
    }
  });

  it("reports failure when there is no JSON-like content at all", () => {
    const result = parseAnalysisResponse("I couldn't analyze this job posting.");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/no JSON object found/);
    }
  });

  it("recovers when the model flattens a Fact<T> to a bare value instead of {value, source}", () => {
    const flattened = validResultJson({
      companyInfo: {
        ...validResultJson().companyInfo,
        industry: "Tech",
        arr: null,
      },
    });
    const raw = "```json\n" + JSON.stringify(flattened) + "\n```";
    const result = parseAnalysisResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Also recovers a bare string in place of the string[] the schema asks for.
      expect(result.result.companyInfo?.industry).toEqual({ value: ["Tech"], source: "llm-estimate" });
      expect(result.result.companyInfo?.arr).toEqual({ value: null, source: "llm-estimate" });
    }
  });

  it("nulls out a flattened value that is literally the source-tag string itself", () => {
    const flattened = validResultJson({
      companyInfo: { ...validResultJson().companyInfo, engineeringSize: "llm-estimate" },
    });
    const raw = "```json\n" + JSON.stringify(flattened) + "\n```";
    const result = parseAnalysisResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.companyInfo?.engineeringSize).toEqual({ value: null, source: "llm-estimate" });
    }
  });

  it("recovers when summary is an array of bullet points instead of a string", () => {
    const raw = "```json\n" + JSON.stringify(validResultJson({ summary: ["Point one.", "Point two."] })) + "\n```";
    const result = parseAnalysisResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.summary).toBe("Point one. Point two.");
    }
  });

  it("recovers when summary is null", () => {
    const raw = "```json\n" + JSON.stringify(validResultJson({ summary: null })) + "\n```";
    const result = parseAnalysisResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.summary).toBe("");
    }
  });

  it("recovers when a requirement's matched is a string instead of a boolean", () => {
    const withStringMatched = validResultJson();
    withStringMatched.requirements[0].matched = "true" as unknown as boolean;
    const raw = "```json\n" + JSON.stringify(withStringMatched) + "\n```";
    const result = parseAnalysisResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.requirements[0].matched).toBe(true);
    }
  });

  it("recovers when a requirement's matched is null", () => {
    const withNullMatched = validResultJson();
    withNullMatched.requirements[0].matched = null as unknown as boolean;
    const raw = "```json\n" + JSON.stringify(withNullMatched) + "\n```";
    const result = parseAnalysisResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.requirements[0].matched).toBe(false);
    }
  });

  it("accepts companyInfo: null (the model was told it's already cached)", () => {
    const raw = "```json\n" + JSON.stringify(validResultJson({ companyInfo: null })) + "\n```";
    const result = parseAnalysisResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.companyInfo).toBeNull();
    }
  });

  it("parses explicit interview rounds", () => {
    const raw =
      "```json\n" +
      JSON.stringify(
        validResultJson({
          interviewRounds: [
            { label: "Recruiter screen", durationMinutes: 30, mode: "phone", source: "page" },
            { label: "Technical interview", durationMinutes: 60, mode: "virtual", source: "page" },
          ],
        }),
      ) +
      "\n```";
    const result = parseAnalysisResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.interviewRounds).toHaveLength(2);
      expect(result.result.interviewRounds[0]).toEqual({
        label: "Recruiter screen",
        durationMinutes: 30,
        mode: "phone",
        source: "page",
      });
    }
  });

  it("defaults interviewRounds to [] when omitted or null", () => {
    const raw = "```json\n" + JSON.stringify(validResultJson({ interviewRounds: null })) + "\n```";
    const result = parseAnalysisResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.interviewRounds).toEqual([]);
    }
  });

  it("falls back to null when workplaceType is missing or invalid", () => {
    const raw = "```json\n" + JSON.stringify(validResultJson({ workplaceType: "on the moon" })) + "\n```";
    const result = parseAnalysisResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.workplaceType).toBeNull();
    }
  });

  it("recovers when a leaf requirement node has children: null instead of []", () => {
    const nested = validResultJson({
      requirements: [
        {
          requirement: "Python",
          tier: "must-have",
          weight: 100,
          matched: true,
          evidence: null,
          resumeSnippet: null,
          children: null,
        },
      ],
    });
    const raw = "```json\n" + JSON.stringify(nested) + "\n```";
    const result = parseAnalysisResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.requirements[0].children).toEqual([]);
    }
  });

  it("recursively validates nested requirement children", () => {
    const nested = validResultJson({
      requirements: [
        {
          requirement: "Container system",
          tier: "must-have",
          weight: 40,
          matched: true,
          evidence: null,
          resumeSnippet: null,
          children: [
            {
              requirement: "Kubernetes",
              tier: "must-have",
              weight: 60,
              matched: false,
              evidence: null,
              resumeSnippet: null,
              children: [],
            },
          ],
        },
      ],
    });
    const raw = "```json\n" + JSON.stringify(nested) + "\n```";
    const result = parseAnalysisResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.requirements[0].children[0].requirement).toBe("Kubernetes");
    }
  });
});
