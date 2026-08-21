// Core data model shared across background, content scripts, and UI.
// See docs/DESIGN.md for the rationale behind each shape.

/** A fact the LLM reports (or the user supplies by hand), tagged by where it came from. */
export interface Fact<T> {
  value: T | null;
  source: "page" | "llm-estimate" | "user";
}

export type RequirementTier = "must-have" | "nice-to-have" | "implied";

/** One node in the weighted, expandable requirement tree. */
export interface RequirementNode {
  requirement: string;
  tier: RequirementTier;
  /** Relative importance within its sibling group, 0-100 (raw LLM value; UI renormalizes). */
  weight: number;
  matched: boolean;
  evidence: string | null;
  resumeSnippet: string | null;
  children: RequirementNode[];
}

export interface CompanyInfo {
  domain: Fact<string>;
  mainProducts: Fact<string[]>;
  employeeSize: Fact<string>;
  engineeringSize: Fact<string>;
  arr: Fact<string>;
  fundingStage: Fact<string>;
  ownership: Fact<"public" | "private">;
  techStack: Fact<string[]>;
}

export interface RoleInfo {
  salaryRange: Fact<string>;
  seniorHeadcount: Fact<string>;
  /** Must never be "llm-estimate" — null unless literally shown on the page. */
  applicantCount: Fact<number>;
}

export interface RoleClassification {
  normalizedRole: string;
  rationale: string;
}

export type WorkplaceType = "remote" | "hybrid" | "onsite";

/**
 * One step of a hiring process, e.g. "Round 1: Recruiter screen" or
 * "Round 2: Technical interview (45 min, virtual)". Never "llm-estimate" —
 * like applicantCount, guessing a specific company's actual process from
 * general knowledge would be misleading; it's either on the posting or the
 * user enters it themselves.
 */
export interface InterviewRound {
  label: string;
  durationMinutes: number | null;
  mode: string | null;
  source: "page" | "user";
}

/** The parsed, validated shape of one LLM analysis response. */
export interface AnalysisResult {
  jobTitle: string;
  company: string;
  location: string;
  workplaceType: WorkplaceType | null;
  companyInfo: CompanyInfo;
  role: RoleInfo;
  roleClassification: RoleClassification;
  requirements: RequirementNode[];
  interviewRounds: InterviewRound[];
  summary: string;
}

export type JobStatus = "pending" | "ok" | "unparsed" | "error";

/** Persisted, per-job cache entry — keyed by LinkedIn job id, upserted on (re)analysis. */
export interface JobRecord {
  id: string;
  url: string;
  status: JobStatus;
  startedAt: string;
  analyzedAt: string | null;
  resumeProfileId: string;
  /** Snapshot so history stays meaningful if the profile is later renamed/deleted. */
  resumeProfileName: string;
  regionBucket: string | null;

  jobTitle: string | null;
  company: string | null;
  location: string | null;
  workplaceType: WorkplaceType | null;
  companyInfo: CompanyInfo | null;
  role: RoleInfo | null;
  roleClassification: RoleClassification | null;
  requirements: RequirementNode[];
  interviewRounds: InterviewRound[];
  summary: string | null;

  /** Kept when status is "unparsed", for a manual "view raw response" fallback. */
  rawResponse: string | null;
  /** Kept when status is "error". */
  errorMessage: string | null;
}

/**
 * Company-level facts, persisted separately from job records and keyed by a
 * normalized company name (see shared/companyKey.ts) so they're shared across
 * every job posting from the same company instead of re-derived each time.
 */
export interface CompanyRecord {
  key: string;
  name: string;
  companyInfo: CompanyInfo;
  updatedAt: string;
}

export interface ResumeProfile {
  id: string;
  name: string;
  fileName: string;
  parsedAt: string;
  text: string;
}

export interface Settings {
  openaiApiKey: string | null;
  openaiModel: string;
  activeResumeProfileId: string | null;
  resumeProfiles: ResumeProfile[];
}

export const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";

export const DEFAULT_SETTINGS: Settings = {
  openaiApiKey: null,
  openaiModel: DEFAULT_OPENAI_MODEL,
  activeResumeProfileId: null,
  resumeProfiles: [],
};
