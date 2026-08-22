// Pure block-list check: given the current Settings and whatever's known
// about a job (id, company, title — the latter two possibly only a
// best-effort URL-slug guess pre-analysis, see companyKey.ts), decides
// whether the side panel should skip it instead of analyzing.

import { normalizeCompanyKey } from "./companyKey";
import type { Settings } from "./types";

export interface BlockCheckInput {
  jobId: string | null;
  company: string | null;
  jobTitle: string | null;
}

export type BlockReason =
  | { type: "job"; jobId: string }
  | { type: "company"; key: string; name: string }
  | { type: "company-keyword"; value: string }
  | { type: "role-keyword"; value: string };

export function checkBlocked(settings: Settings, input: BlockCheckInput): BlockReason | null {
  if (input.jobId) {
    const job = settings.blockedJobs.find((j) => j.jobId === input.jobId);
    if (job) return { type: "job", jobId: job.jobId };
  }

  if (input.company) {
    const key = normalizeCompanyKey(input.company);
    const company = settings.blockedCompanies.find((c) => c.key === key);
    if (company) return { type: "company", key: company.key, name: company.name };

    const companyLower = input.company.toLowerCase();
    const companyKeyword = settings.companyBlockKeywords.find((k) => companyLower.includes(k.value.toLowerCase()));
    if (companyKeyword) return { type: "company-keyword", value: companyKeyword.value };
  }

  if (input.jobTitle) {
    const titleLower = input.jobTitle.toLowerCase();
    const roleKeyword = settings.roleBlockKeywords.find((k) => titleLower.includes(k.value.toLowerCase()));
    if (roleKeyword) return { type: "role-keyword", value: roleKeyword.value };
  }

  return null;
}

export function blockReasonText(reason: BlockReason): string {
  switch (reason.type) {
    case "job":
      return "This job posting is blocked.";
    case "company":
      return `Blocked company: ${reason.name}`;
    case "company-keyword":
      return `Company name matches blocked keyword "${reason.value}".`;
    case "role-keyword":
      return `Job title matches blocked keyword "${reason.value}".`;
  }
}
