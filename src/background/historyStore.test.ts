import { describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import {
  beginAnalysis,
  completeAnalysisError,
  completeAnalysisOk,
  completeAnalysisUnparsed,
  isStalePending,
} from "./historyStore";
import { getAllJobRecords, getJobRecord, upsertJobRecord } from "../shared/db";
import type { AnalysisResult, JobRecord } from "../shared/types";

const sampleResult: AnalysisResult = {
  jobTitle: "Senior Backend Engineer",
  company: "Acme Corp",
  location: "San Francisco, CA",
  workplaceType: "hybrid",
  companyInfo: {
    industry: { value: ["Tech"], source: "llm-estimate" },
    mainProducts: { value: null, source: "llm-estimate" },
    employeeSize: { value: null, source: "llm-estimate" },
    engineeringSize: { value: null, source: "llm-estimate" },
    arr: { value: null, source: "llm-estimate" },
    fundingStage: { value: null, source: "llm-estimate" },
    ownership: { value: null, source: "llm-estimate" },
    techStack: { value: null, source: "llm-estimate" },
  },
  role: {
    salaryRange: { value: null, source: "llm-estimate" },
    seniorHeadcount: { value: null, source: "llm-estimate" },
    applicantCount: { value: 87, source: "page" },
    applicantInsights: { value: null, source: "page" },
  },
  roleClassification: { normalizedRole: "Data Engineer", rationale: "Pipelines, not just APIs." },
  requirements: [],
  interviewRounds: [],
  summary: "Looks like a data engineering role.",
};

// shared/db.ts caches one IndexedDB connection for the module's lifetime, so
// these tests share a database — each test uses its own job id rather than
// resetting state, since (re-)analysis is naturally idempotent per id anyway.

describe("historyStore", () => {
  it("begins analysis with a pending record", async () => {
    const record = await beginAnalysis({
      jobId: "job-1",
      url: "https://www.linkedin.com/jobs/view/job-1",
      resumeProfileId: "p1",
      resumeProfileName: "Backend",
    });
    expect(record.status).toBe("pending");
    expect(record.analyzedAt).toBeNull();

    const stored = await getJobRecord("job-1");
    expect(stored?.status).toBe("pending");
  });

  it("completes analysis ok, deriving regionBucket from the result location", async () => {
    await beginAnalysis({
      jobId: "job-1",
      url: "https://www.linkedin.com/jobs/view/job-1",
      resumeProfileId: "p1",
      resumeProfileName: "Backend",
    });
    const updated = await completeAnalysisOk("job-1", sampleResult);
    expect(updated.status).toBe("ok");
    expect(updated.regionBucket).toBe("San Francisco, CA");
    expect(updated.jobTitle).toBe("Senior Backend Engineer");
    expect(updated.analyzedAt).not.toBeNull();
  });

  it("completes analysis as unparsed, preserving the raw response", async () => {
    await beginAnalysis({
      jobId: "job-2",
      url: "https://www.linkedin.com/jobs/view/job-2",
      resumeProfileId: "p1",
      resumeProfileName: "Backend",
    });
    const updated = await completeAnalysisUnparsed("job-2", "not json", "invalid JSON");
    expect(updated.status).toBe("unparsed");
    expect(updated.rawResponse).toBe("not json");
    expect(updated.errorMessage).toBe("invalid JSON");
  });

  it("completes analysis as error", async () => {
    await beginAnalysis({
      jobId: "job-3",
      url: "https://www.linkedin.com/jobs/view/job-3",
      resumeProfileId: "p1",
      resumeProfileName: "Backend",
    });
    const updated = await completeAnalysisError("job-3", "OpenAI request failed (401)");
    expect(updated.status).toBe("error");
    expect(updated.errorMessage).toBe("OpenAI request failed (401)");
  });

  it("re-analysis upserts the same record instead of creating a new one", async () => {
    const jobId = "job-reanalyze";
    await beginAnalysis({
      jobId,
      url: `https://www.linkedin.com/jobs/view/${jobId}`,
      resumeProfileId: "p1",
      resumeProfileName: "Backend",
    });
    await completeAnalysisOk(jobId, sampleResult);

    await beginAnalysis({
      jobId,
      url: `https://www.linkedin.com/jobs/view/${jobId}`,
      resumeProfileId: "p1",
      resumeProfileName: "Backend",
    });
    const reAnalyzed = await completeAnalysisOk(jobId, { ...sampleResult, summary: "Updated summary" });
    expect(reAnalyzed.summary).toBe("Updated summary");

    const stored = await getJobRecord(jobId);
    expect(stored?.summary).toBe("Updated summary");
    const all = await getAllJobRecords();
    expect(all.filter((r) => r.id === jobId)).toHaveLength(1);
  });

  it("preserves user-edited facts and user-added interview rounds across re-analysis", async () => {
    const jobId = "job-preserve-edits";
    await beginAnalysis({
      jobId,
      url: `https://www.linkedin.com/jobs/view/${jobId}`,
      resumeProfileId: "p1",
      resumeProfileName: "Backend",
    });
    const first = await completeAnalysisOk(jobId, sampleResult);

    // Simulate the user hand-editing a fact and adding an interview round.
    const edited: JobRecord = {
      ...first,
      companyInfo: { ...first.companyInfo!, arr: { value: "$50M ARR (I checked)", source: "user" } },
      interviewRounds: [{ label: "Take-home project", durationMinutes: null, mode: null, source: "user" }],
    };
    await upsertJobRecord(edited);

    await beginAnalysis({
      jobId,
      url: `https://www.linkedin.com/jobs/view/${jobId}`,
      resumeProfileId: "p1",
      resumeProfileName: "Backend",
    });
    const reAnalyzed = await completeAnalysisOk(jobId, {
      ...sampleResult,
      interviewRounds: [{ label: "Recruiter screen", durationMinutes: 30, mode: "phone", source: "page" }],
    });

    expect(reAnalyzed.companyInfo?.arr).toEqual({ value: "$50M ARR (I checked)", source: "user" });
    // The LLM's other fresh facts still come through untouched.
    expect(reAnalyzed.companyInfo?.industry).toEqual(sampleResult.companyInfo.industry);
    expect(reAnalyzed.interviewRounds).toEqual([
      { label: "Recruiter screen", durationMinutes: 30, mode: "phone", source: "page" },
      { label: "Take-home project", durationMinutes: null, mode: null, source: "user" },
    ]);
  });

  it("throws if completing analysis without a prior beginAnalysis", async () => {
    await expect(completeAnalysisOk("never-started", sampleResult)).rejects.toThrow(/no record found/);
  });
});

describe("isStalePending", () => {
  const base: JobRecord = {
    id: "x",
    url: "",
    status: "pending",
    startedAt: new Date().toISOString(),
    analyzedAt: null,
    resumeProfileId: "p1",
    resumeProfileName: "Backend",
    regionBucket: null,
    jobTitle: null,
    company: null,
    location: null,
    workplaceType: null,
    companyInfo: null,
    role: null,
    roleClassification: null,
    requirements: [],
    interviewRounds: [],
    summary: null,
    rawResponse: null,
    errorMessage: null,
  };

  it("is false for a fresh pending record", () => {
    expect(isStalePending(base)).toBe(false);
  });

  it("is true once startedAt is older than the staleness threshold", () => {
    const old = { ...base, startedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString() };
    expect(isStalePending(old)).toBe(true);
  });

  it("is false for a non-pending record regardless of age", () => {
    const old = { ...base, status: "ok" as const, startedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString() };
    expect(isStalePending(old)).toBe(false);
  });
});
