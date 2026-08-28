import { describe, expect, it } from "vitest";
import { parseExtractionResponse, parseRequirementsResponse } from "./responseParser";

function validExtractionJson(overrides: Record<string, unknown> = {}) {
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
      team: { value: "Data Platform", source: "page" },
      teamMission: { value: "Owns the batch and streaming pipelines other teams build on.", source: "page" },
      salaryRange: { value: "$150K-$190K", source: "page" },
      applicantCount: { value: 87, source: "page" },
      seniorHeadcount: { value: 44, source: "page" },
      applicantCountInsight: null,
    },
    roleClassification: { normalizedRole: "Data Engineer", rationale: "Focused on pipelines." },
    interviewRounds: [],
    summary: "A backend role that's really data engineering.",
    ...overrides,
  };
}

function validRequirementsJson(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

describe("parseExtractionResponse", () => {
  it("parses a well-formed ```json fenced block", () => {
    const raw = "Here you go:\n```json\n" + JSON.stringify(validExtractionJson()) + "\n```\nHope that helps!";
    const result = parseExtractionResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.jobTitle).toBe("Senior Backend Engineer");
    }
  });

  it("falls back to a bare fenced block without a json tag", () => {
    const raw = "```\n" + JSON.stringify(validExtractionJson()) + "\n```";
    const result = parseExtractionResponse(raw);
    expect(result.ok).toBe(true);
  });

  it("falls back to first-{-to-last-} when there's no fence at all", () => {
    const raw = "Sure, here is the result: " + JSON.stringify(validExtractionJson()) + " Let me know if needed.";
    const result = parseExtractionResponse(raw);
    expect(result.ok).toBe(true);
  });

  it("reports failure with the raw text preserved when JSON is malformed", () => {
    const raw = "```json\n{ not valid json \n```";
    const result = parseExtractionResponse(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rawText).toBe(raw);
      expect(result.reason).toMatch(/invalid JSON/);
    }
  });

  it("reports failure when the JSON doesn't match the schema", () => {
    const raw = "```json\n" + JSON.stringify({ jobTitle: "Only a title" }) + "\n```";
    const result = parseExtractionResponse(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/schema validation failed/);
    }
  });

  it("reports failure when there is no JSON-like content at all", () => {
    const result = parseExtractionResponse("I couldn't analyze this job posting.");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/no JSON object found/);
    }
  });

  it("recovers when the model flattens a Fact<T> to a bare value instead of {value, source}", () => {
    const flattened = validExtractionJson({
      companyInfo: {
        ...validExtractionJson().companyInfo,
        industry: "Tech",
        arr: null,
      },
    });
    const raw = "```json\n" + JSON.stringify(flattened) + "\n```";
    const result = parseExtractionResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Also recovers a bare string in place of the string[] the schema asks for.
      expect(result.result.companyInfo?.industry).toEqual({ value: ["Tech"], source: "llm-estimate" });
      expect(result.result.companyInfo?.arr).toEqual({ value: null, source: "llm-estimate" });
    }
  });

  it("nulls out a flattened value that is literally the source-tag string itself", () => {
    const flattened = validExtractionJson({
      companyInfo: { ...validExtractionJson().companyInfo, engineeringSize: "llm-estimate" },
    });
    const raw = "```json\n" + JSON.stringify(flattened) + "\n```";
    const result = parseExtractionResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.companyInfo?.engineeringSize).toEqual({ value: null, source: "llm-estimate" });
    }
  });

  it("recovers when summary is an array of bullet points instead of a string", () => {
    const raw = "```json\n" + JSON.stringify(validExtractionJson({ summary: ["Point one.", "Point two."] })) + "\n```";
    const result = parseExtractionResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.summary).toBe("Point one. Point two.");
    }
  });

  it("recovers when summary is null", () => {
    const raw = "```json\n" + JSON.stringify(validExtractionJson({ summary: null })) + "\n```";
    const result = parseExtractionResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.summary).toBe("");
    }
  });

  it("passes through a real applicantCountInsight string", () => {
    const raw =
      "```json\n" +
      JSON.stringify(
        validExtractionJson({
          role: { ...validExtractionJson().role, applicantCountInsight: "Likely high given the above-market salary." },
        }),
      ) +
      "\n```";
    const result = parseExtractionResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.role.applicantCountInsight).toBe("Likely high given the above-market salary.");
    }
  });

  it("recovers when applicantCountInsight is an array instead of a string", () => {
    const raw =
      "```json\n" +
      JSON.stringify(
        validExtractionJson({ role: { ...validExtractionJson().role, applicantCountInsight: ["Point one.", "Point two."] } }),
      ) +
      "\n```";
    const result = parseExtractionResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.role.applicantCountInsight).toBe("Point one. Point two.");
    }
  });

  it("accepts companyInfo: null (the model was told it's already cached)", () => {
    const raw = "```json\n" + JSON.stringify(validExtractionJson({ companyInfo: null })) + "\n```";
    const result = parseExtractionResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.companyInfo).toBeNull();
    }
  });

  it("parses explicit interview rounds", () => {
    const raw =
      "```json\n" +
      JSON.stringify(
        validExtractionJson({
          interviewRounds: [
            { label: "Recruiter screen", durationMinutes: 30, mode: "phone", source: "page" },
            { label: "Technical interview", durationMinutes: 60, mode: "virtual", source: "page" },
          ],
        }),
      ) +
      "\n```";
    const result = parseExtractionResponse(raw);
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
    const raw = "```json\n" + JSON.stringify(validExtractionJson({ interviewRounds: null })) + "\n```";
    const result = parseExtractionResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.interviewRounds).toEqual([]);
    }
  });

  it("falls back to null when workplaceType is missing or invalid", () => {
    const raw = "```json\n" + JSON.stringify(validExtractionJson({ workplaceType: "on the moon" })) + "\n```";
    const result = parseExtractionResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.workplaceType).toBeNull();
    }
  });
});

describe("parseRequirementsResponse", () => {
  it("parses a well-formed ```json fenced block", () => {
    const raw = "```json\n" + JSON.stringify(validRequirementsJson()) + "\n```";
    const result = parseRequirementsResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.requirements[0].tier).toBe("must-have");
    }
  });

  it("reports failure when the JSON doesn't match the schema", () => {
    const raw = "```json\n" + JSON.stringify({ requirements: [{ requirement: "Python" }] }) + "\n```";
    const result = parseRequirementsResponse(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/schema validation failed/);
    }
  });

  it("recovers when a requirement's matched is a string instead of a boolean", () => {
    const withStringMatched = validRequirementsJson();
    (withStringMatched.requirements[0] as { matched: unknown }).matched = "true";
    const raw = "```json\n" + JSON.stringify(withStringMatched) + "\n```";
    const result = parseRequirementsResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.requirements[0].matched).toBe(true);
    }
  });

  it("recovers when a requirement's matched is null", () => {
    const withNullMatched = validRequirementsJson();
    (withNullMatched.requirements[0] as { matched: unknown }).matched = null;
    const raw = "```json\n" + JSON.stringify(withNullMatched) + "\n```";
    const result = parseRequirementsResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.requirements[0].matched).toBe(false);
    }
  });

  it("recovers when a leaf requirement node has children: null instead of []", () => {
    const nested = validRequirementsJson({
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
    const result = parseRequirementsResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.requirements[0].children).toEqual([]);
    }
  });

  it("recursively validates nested requirement children", () => {
    const nested = validRequirementsJson({
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
    const result = parseRequirementsResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.requirements[0].children[0].requirement).toBe("Kubernetes");
    }
  });

  it("reports failure when there is no JSON-like content at all", () => {
    const result = parseRequirementsResponse("I couldn't analyze this job posting.");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/no JSON object found/);
    }
  });
});
