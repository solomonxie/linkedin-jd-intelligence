import { describe, expect, it } from "vitest";
import { computeRegionBucket, estimateSkillPrevalence } from "./skillPrevalence";
import type { JobRecord, RequirementNode } from "./types";

function mustHave(requirement: string): RequirementNode {
  return {
    requirement,
    tier: "must-have",
    weight: 50,
    matched: true,
    evidence: null,
    resumeSnippet: null,
    children: [],
  };
}

function makeRecord(overrides: {
  id: string;
  regionBucket: string;
  applicantCount: number | null;
  skills: string[];
}): JobRecord {
  return {
    id: overrides.id,
    url: `https://www.linkedin.com/jobs/view/${overrides.id}`,
    status: "ok",
    startedAt: "2026-01-01T00:00:00.000Z",
    analyzedAt: "2026-01-01T00:00:05.000Z",
    resumeProfileId: "profile-1",
    resumeProfileName: "Backend",
    regionBucket: overrides.regionBucket,
    jobTitle: "Some Role",
    company: "Some Co",
    location: overrides.regionBucket,
    companyInfo: null,
    role: {
      salaryRange: { value: null, source: "llm-estimate" },
      seniorHeadcount: { value: null, source: "llm-estimate" },
      applicantCount: { value: overrides.applicantCount, source: "page" },
    },
    roleClassification: null,
    requirements: overrides.skills.map(mustHave),
    summary: null,
    rawResponse: null,
    errorMessage: null,
  };
}

describe("computeRegionBucket", () => {
  it("trims and collapses whitespace for a plain location", () => {
    expect(computeRegionBucket("  San Francisco,   CA  ")).toBe("San Francisco, CA");
  });

  it("normalizes bare 'Remote' listings", () => {
    expect(computeRegionBucket("Remote")).toBe("Remote");
  });

  it("normalizes 'Remote, <region>' listings", () => {
    expect(computeRegionBucket("Remote, United States")).toBe("Remote — United States");
  });

  it("normalizes 'Remote - <region>' listings", () => {
    expect(computeRegionBucket("Remote - Canada")).toBe("Remote — Canada");
  });
});

describe("estimateSkillPrevalence", () => {
  it("reports insufficient data below the minimum qualifying-job threshold", () => {
    const records = [
      makeRecord({ id: "1", regionBucket: "City", applicantCount: 100, skills: ["Python"] }),
      makeRecord({ id: "2", regionBucket: "City", applicantCount: 100, skills: ["Python"] }),
    ];
    const result = estimateSkillPrevalence(records, "City");
    expect(result.sufficientData).toBe(false);
    expect(result.estimates.size).toBe(0);
  });

  it("excludes jobs with a different region, missing/zero applicant count, or no must-have skills", () => {
    const records = [
      makeRecord({ id: "1", regionBucket: "City", applicantCount: 100, skills: ["Python"] }),
      makeRecord({ id: "2", regionBucket: "Other City", applicantCount: 100, skills: ["Python"] }),
      makeRecord({ id: "3", regionBucket: "City", applicantCount: null, skills: ["Python"] }),
      makeRecord({ id: "4", regionBucket: "City", applicantCount: 0, skills: ["Python"] }),
      makeRecord({ id: "5", regionBucket: "City", applicantCount: 100, skills: [] }),
      makeRecord({ id: "6", regionBucket: "City", applicantCount: 100, skills: ["Python"] }),
      makeRecord({ id: "7", regionBucket: "City", applicantCount: 100, skills: ["Python"] }),
      makeRecord({ id: "8", regionBucket: "City", applicantCount: 100, skills: ["Python"] }),
    ];
    const result = estimateSkillPrevalence(records, "City");
    // Only records 1, 6, 7, 8 qualify.
    expect(result.qualifyingJobCount).toBe(4);
    expect(result.sufficientData).toBe(true);
  });

  it("normalizes skill names case-insensitively", () => {
    const records = [
      makeRecord({ id: "1", regionBucket: "City", applicantCount: 100, skills: ["React"] }),
      makeRecord({ id: "2", regionBucket: "City", applicantCount: 100, skills: ["react"] }),
      makeRecord({ id: "3", regionBucket: "City", applicantCount: 100, skills: [" React "] }),
      makeRecord({ id: "4", regionBucket: "City", applicantCount: 100, skills: ["React"] }),
    ];
    const result = estimateSkillPrevalence(records, "City");
    expect(result.estimates.size).toBe(1);
    expect(result.estimates.has("react")).toBe(true);
  });

  it("estimates never fall below the largest single observed applicant count for that skill", () => {
    // The user's worked example: overlapping applicant pools across jobs.
    const records = [
      makeRecord({ id: "1", regionBucket: "City", applicantCount: 400, skills: ["Python", "Go"] }),
      makeRecord({ id: "2", regionBucket: "City", applicantCount: 200, skills: ["Python", "C#"] }),
      makeRecord({ id: "3", regionBucket: "City", applicantCount: 150, skills: ["Python", "Java"] }),
      makeRecord({ id: "4", regionBucket: "City", applicantCount: 100, skills: ["Go", "Java"] }),
      makeRecord({ id: "5", regionBucket: "City", applicantCount: 500, skills: ["Python"] }),
    ];
    const result = estimateSkillPrevalence(records, "City");
    expect(result.sufficientData).toBe(true);
    expect(result.estimates.get("python")!).toBeGreaterThanOrEqual(500);
    expect(result.estimates.get("go")!).toBeGreaterThanOrEqual(400);
    expect(result.estimates.get("c#")!).toBeGreaterThanOrEqual(200);
    // Python appears in more, higher-applicant-count jobs than the region-only "Go".
    expect(result.estimates.get("python")!).toBeGreaterThan(result.estimates.get("c#")!);
  });
});
