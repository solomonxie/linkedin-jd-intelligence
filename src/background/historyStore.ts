// Status-transition helpers around shared/db.ts — every (re)analysis upserts
// the same JobRecord (keyed by LinkedIn job id) through pending -> ok |
// unparsed | error. See docs/DESIGN.md "Task durability".

import { getJobRecord, upsertJobRecord } from "../shared/db";
import { computeRegionBucket } from "../shared/skillPrevalence";
import type { AnalysisResult, JobRecord } from "../shared/types";

export interface BeginAnalysisParams {
  jobId: string;
  url: string;
  resumeProfileId: string;
  resumeProfileName: string;
}

/** Upserts a "pending" record *before* the LLM call starts, so status survives a crash/restart. */
export async function beginAnalysis(params: BeginAnalysisParams): Promise<JobRecord> {
  const existing = await getJobRecord(params.jobId);
  const record: JobRecord = {
    id: params.jobId,
    url: params.url,
    status: "pending",
    startedAt: new Date().toISOString(),
    analyzedAt: existing?.analyzedAt ?? null,
    resumeProfileId: params.resumeProfileId,
    resumeProfileName: params.resumeProfileName,
    regionBucket: existing?.regionBucket ?? null,
    jobTitle: existing?.jobTitle ?? null,
    company: existing?.company ?? null,
    location: existing?.location ?? null,
    companyInfo: existing?.companyInfo ?? null,
    role: existing?.role ?? null,
    roleClassification: existing?.roleClassification ?? null,
    requirements: existing?.requirements ?? [],
    summary: existing?.summary ?? null,
    rawResponse: null,
    errorMessage: null,
  };
  await upsertJobRecord(record);
  return record;
}

export async function completeAnalysisOk(jobId: string, result: AnalysisResult): Promise<JobRecord> {
  const record = await requirePending(jobId, "completeAnalysisOk");
  const updated: JobRecord = {
    ...record,
    status: "ok",
    analyzedAt: new Date().toISOString(),
    regionBucket: computeRegionBucket(result.location),
    jobTitle: result.jobTitle,
    company: result.company,
    location: result.location,
    companyInfo: result.companyInfo,
    role: result.role,
    roleClassification: result.roleClassification,
    requirements: result.requirements,
    summary: result.summary,
    rawResponse: null,
    errorMessage: null,
  };
  await upsertJobRecord(updated);
  return updated;
}

export async function completeAnalysisUnparsed(jobId: string, rawText: string, reason: string): Promise<JobRecord> {
  const record = await requirePending(jobId, "completeAnalysisUnparsed");
  const updated: JobRecord = {
    ...record,
    status: "unparsed",
    analyzedAt: new Date().toISOString(),
    rawResponse: rawText,
    errorMessage: reason,
  };
  await upsertJobRecord(updated);
  return updated;
}

export async function completeAnalysisError(jobId: string, errorMessage: string): Promise<JobRecord> {
  const record = await requirePending(jobId, "completeAnalysisError");
  const updated: JobRecord = { ...record, status: "error", analyzedAt: new Date().toISOString(), errorMessage };
  await upsertJobRecord(updated);
  return updated;
}

async function requirePending(jobId: string, caller: string): Promise<JobRecord> {
  const record = await getJobRecord(jobId);
  if (!record) throw new Error(`${caller}: no record found for job ${jobId} (beginAnalysis wasn't called first)`);
  return record;
}

// Re-exported for backwards compatibility — the real implementation lives in
// shared/ since the UI needs it too (to decide when to stop showing a
// spinner and offer a retry instead), not just the background.
export { isStalePending } from "../shared/jobStatus";
