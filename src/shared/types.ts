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
  industry: Fact<string[]>;
  headquarters: Fact<string>;
  mainProducts: Fact<string[]>;
  employeeSize: Fact<string>;
  engineeringSize: Fact<string>;
  arr: Fact<string>;
  fundingStage: Fact<string>;
  ownership: Fact<"public" | "private">;
  techStack: Fact<string[]>;
}

export interface RoleInfo {
  /** Short team name (e.g. "Data Platform", "DevOps", "BI", "Support") — named explicitly on the
   * posting when stated, otherwise the LLM's best guess from the role's responsibilities. */
  team: Fact<string>;
  /** One short sentence on what that team does/owns. Same sourcing as `team`. */
  teamMission: Fact<string>;
  salaryRange: Fact<string>;
  /** Must never be "llm-estimate" — null unless literally shown on the page. */
  applicantCount: Fact<number>;
  /** Count of senior-level applicants to this posting: senior-level % from LinkedIn's "see how you
   * compare to others who clicked apply" panel, applied to applicantCount (e.g. 50% of 100 -> 50).
   * Must never be "llm-estimate" — same reasoning as applicantCount. */
  seniorHeadcount: Fact<number>;
  /** A short, speculative reason applicantCount looks unusually high (400+) or low (<100) — e.g. salary,
   * seniority, remote setup, niche skills. Not a Fact — always the LLM's own reasoning, never sourced
   * from the page. Null whenever applicantCount is null or within the ordinary range. */
  applicantCountInsight: string | null;
}

/** An all-blank CompanyInfo — used to seed a pending JobRecord when there's no cached company info yet,
 * so the shape is always a real CompanyInfo (never a special-cased null) for the UI to render against. */
export function blankCompanyInfo(): CompanyInfo {
  const blank = { value: null, source: "llm-estimate" as const };
  return {
    industry: blank,
    headquarters: blank,
    mainProducts: blank,
    employeeSize: blank,
    engineeringSize: blank,
    arr: blank,
    fundingStage: blank,
    ownership: blank,
    techStack: blank,
  };
}

/** An all-blank RoleInfo — see blankCompanyInfo() above; seeds a pending record so the brief can render
 * (with its role rows simply hidden, per CompanyRoleBrief's isBlank check) before the LLM has run. */
export function blankRoleInfo(): RoleInfo {
  const blank = { value: null, source: "llm-estimate" as const };
  return {
    team: blank,
    teamMission: blank,
    salaryRange: blank,
    applicantCount: blank,
    seniorHeadcount: blank,
    applicantCountInsight: null,
  };
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

/** One job blocked by hand ("Block this job") — skipped on any future visit, never auto-analyzed. */
export interface BlockedJob {
  jobId: string;
  jobTitle: string;
  company: string;
  /** The job posting's URL at the moment it was blocked — lets Settings link back to it even when
   * jobTitle/company came back blank (e.g. blocked before analysis, on a page with no list rendered
   * to read them from). May be absent on an entry blocked before this field existed. */
  url?: string;
  addedAt: string;
}

/** One company blocked by hand ("Block this company"), keyed like the company-info cache so
 * "Affirm" and "Affirm, Inc." block together. */
export interface BlockedCompany {
  key: string;
  name: string;
  /** The URL of whichever job posting was open when this company was blocked — not the company
   * itself, just a concrete reference so Settings can show something clickable. May be absent on an
   * entry blocked before this field existed. */
  sampleJobUrl?: string;
  addedAt: string;
}

/** One user-entered substring, matched case-insensitively against a company name or job title. */
export interface BlockKeyword {
  id: string;
  value: string;
  addedAt: string;
}

/** OpenAI's reasoning-effort levels — only meaningful for a reasoning-capable model (see
 * background/llm/openaiClient.ts supportsReasoningEffort); ignored otherwise. */
export type ReasoningEffort = "minimal" | "low" | "medium" | "high";

export interface Settings {
  openaiApiKey: string | null;
  openaiModel: string;
  /** Only sent to the API when openaiModel supports it. */
  openaiReasoningEffort: ReasoningEffort;
  activeResumeProfileId: string | null;
  resumeProfiles: ResumeProfile[];
  blockedJobs: BlockedJob[];
  blockedCompanies: BlockedCompany[];
  companyBlockKeywords: BlockKeyword[];
  roleBlockKeywords: BlockKeyword[];
}

export const DEFAULT_OPENAI_MODEL = "gpt-5";

export const DEFAULT_SETTINGS: Settings = {
  openaiApiKey: null,
  openaiModel: DEFAULT_OPENAI_MODEL,
  openaiReasoningEffort: "medium",
  activeResumeProfileId: null,
  resumeProfiles: [],
  blockedJobs: [],
  blockedCompanies: [],
  companyBlockKeywords: [],
  roleBlockKeywords: [],
};

