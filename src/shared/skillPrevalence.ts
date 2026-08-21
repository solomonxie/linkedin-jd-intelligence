// Local, deterministic estimate of "how many candidates in this region likely
// have this skill" — derived only from the user's own cached job history, no
// external data, no LLM call. See docs/DESIGN.md "Skill prevalence estimate"
// for the full modeling rationale (including its stated limitations).

import type { JobRecord } from "./types";

const MIN_QUALIFYING_JOBS = 4;
const RIDGE_LAMBDA = 0.5;
const LEARNING_RATE = 0.1;
const ITERATIONS = 500;

export interface SkillPrevalenceResult {
  /** Normalized (lowercase/trim) skill name -> estimated regional candidate count. */
  estimates: Map<string, number>;
  qualifyingJobCount: number;
  /** False below MIN_QUALIFYING_JOBS — an underdetermined fit is worse than no estimate. */
  sufficientData: boolean;
}

interface QualifyingJob {
  skills: string[];
  applicantCount: number;
}

export function estimateSkillPrevalence(records: JobRecord[], regionBucket: string): SkillPrevalenceResult {
  const qualifyingJobs = collectQualifyingJobs(records, regionBucket);

  if (qualifyingJobs.length < MIN_QUALIFYING_JOBS) {
    return { estimates: new Map(), qualifyingJobCount: qualifyingJobs.length, sufficientData: false };
  }

  const skills = Array.from(new Set(qualifyingJobs.flatMap((job) => job.skills))).sort();
  const skillIndex = new Map(skills.map((skill, i) => [skill, i]));

  // Unknowns: params[0] = logP (log regional pool size), params[i+1] = log_q[skills[i]].
  const params = new Array(skills.length + 1).fill(0);

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const gradients = new Array(params.length).fill(0);

    for (const job of qualifyingJobs) {
      let predicted = params[0];
      for (const skill of job.skills) predicted += params[skillIndex.get(skill)! + 1];
      const error = predicted - Math.log(job.applicantCount);

      gradients[0] += error;
      for (const skill of job.skills) gradients[skillIndex.get(skill)! + 1] += error;
    }

    const n = qualifyingJobs.length;
    params[0] -= LEARNING_RATE * (gradients[0] / n);
    for (let i = 1; i < params.length; i++) {
      // Ridge regularization pulls log_q toward 0 (i.e. "no evidence this skill narrows the pool")
      // so the fit stays well-behaved when the system is underdetermined. Not applied to logP.
      const regularizedGradient = gradients[i] / n + RIDGE_LAMBDA * params[i];
      params[i] -= LEARNING_RATE * regularizedGradient;
    }
  }

  const maxObservedForSkill = new Map<string, number>();
  for (const job of qualifyingJobs) {
    for (const skill of job.skills) {
      maxObservedForSkill.set(skill, Math.max(maxObservedForSkill.get(skill) ?? 0, job.applicantCount));
    }
  }

  const estimates = new Map<string, number>();
  for (const skill of skills) {
    const rawEstimate = Math.exp(params[0] + params[skillIndex.get(skill)! + 1]);
    const floor = maxObservedForSkill.get(skill) ?? 0;
    estimates.set(skill, Math.round(Math.max(rawEstimate, floor)));
  }

  return { estimates, qualifyingJobCount: qualifyingJobs.length, sufficientData: true };
}

function collectQualifyingJobs(records: JobRecord[], regionBucket: string): QualifyingJob[] {
  const jobs: QualifyingJob[] = [];
  for (const record of records) {
    if (record.status !== "ok" || record.regionBucket !== regionBucket) continue;

    const applicantCount = record.role?.applicantCount.value ?? null;
    if (applicantCount === null || applicantCount <= 0) continue; // log(0) undefined, and null means unknown

    const skills = record.requirements
      .filter((r) => r.tier === "must-have")
      .map((r) => normalizeSkillName(r.requirement));
    if (skills.length === 0) continue;

    jobs.push({ skills, applicantCount });
  }
  return jobs;
}

export function normalizeSkillName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Groups by whatever LinkedIn's own location text says — trimmed and
 * whitespace-collapsed, no geocoding. Remote listings normalize to
 * "Remote" or "Remote — <region as shown>".
 */
export function computeRegionBucket(rawLocation: string): string {
  const trimmed = rawLocation.trim().replace(/\s+/g, " ");
  const remoteMatch = trimmed.match(/^remote\b[\s,–—-]*(.*)$/i);
  if (remoteMatch) {
    const rest = remoteMatch[1].trim();
    return rest ? `Remote — ${rest}` : "Remote";
  }
  return trimmed;
}
