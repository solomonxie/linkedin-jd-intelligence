// Status-transition helpers around shared/db.ts — every (re)analysis upserts
// the same JobRecord (keyed by LinkedIn job id) through pending -> ok |
// unparsed | error. See docs/DESIGN.md "Task durability".

import { getJobRecord, upsertJobRecord } from "../shared/db";
import { computeRegionBucket } from "../shared/skillPrevalence";
import type { AnalysisResult, CompanyInfo, JobRecord, RoleInfo } from "../shared/types";

export interface BeginAnalysisParams {
  jobId: string;
  url: string;
  resumeProfileId: string;
  resumeProfileName: string;
  /** Already-cached company info (see shared/companyKey.ts "Company info cache") for this posting's
   * company, if any — seeds the pending record so the brief's company fields render immediately
   * instead of sitting behind the skeleton for the whole LLM round-trip. Ignored once a record already
   * has its own companyInfo (re-analysis case, handled by `existing` below). */
  cachedCompanyInfo?: CompanyInfo | null;
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
    workplaceType: existing?.workplaceType ?? null,
    companyInfo: existing?.companyInfo ?? params.cachedCompanyInfo ?? null,
    role: existing?.role ?? null,
    roleClassification: existing?.roleClassification ?? null,
    requirements: existing?.requirements ?? [],
    interviewRounds: existing?.interviewRounds ?? [],
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
    workplaceType: result.workplaceType,
    // Re-analysis re-derives everything fresh from the LLM — but a hand
    // edit/addition shouldn't get silently clobbered by the next "Re-analyze"
    // click, so anything the user touched is preserved over the fresh value.
    companyInfo: preserveUserCompanyFacts(record.companyInfo, result.companyInfo),
    role: preserveUserRoleFacts(record.role, result.role),
    roleClassification: result.roleClassification,
    requirements: result.requirements,
    interviewRounds: [...result.interviewRounds, ...record.interviewRounds.filter((r) => r.source === "user")],
    summary: result.summary,
    rawResponse: null,
    errorMessage: null,
  };
  await upsertJobRecord(updated);
  return updated;
}

function preserveUserCompanyFacts(existing: CompanyInfo | null, fresh: CompanyInfo): CompanyInfo {
  if (!existing) return fresh;
  const merged = { ...fresh };
  for (const key of Object.keys(existing) as (keyof CompanyInfo)[]) {
    if (existing[key].source === "user") merged[key] = existing[key] as never;
  }
  return merged;
}

function preserveUserRoleFacts(existing: RoleInfo | null, fresh: RoleInfo): RoleInfo {
  if (!existing) return fresh;
  const merged = { ...fresh };
  // applicantCountInsight isn't a Fact (no source, never hand-edited) — always take the fresh value.
  const factKeys = (Object.keys(existing) as (keyof RoleInfo)[]).filter((key) => key !== "applicantCountInsight");
  for (const key of factKeys) {
    if (existing[key].source === "user") merged[key] = existing[key] as never;
  }
  return merged;
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
