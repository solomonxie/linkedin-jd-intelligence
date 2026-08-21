import type { ReactNode } from "react";
import type { CompanyInfo, Fact, RoleInfo } from "../shared/types";

export function CompanyRoleBrief({ companyInfo, role }: { companyInfo: CompanyInfo; role: RoleInfo }) {
  return (
    <div className="brief">
      <h3>Company & Role Brief</h3>
      <ul>
        {factRow("Domain", companyInfo.domain)}
        {factRow("Main products", companyInfo.mainProducts)}
        {factRow("Size", companyInfo.employeeSize)}
        {factRow("Eng. size", companyInfo.engineeringSize)}
        {factRow("ARR", companyInfo.arr)}
        {factRow("Stage", companyInfo.fundingStage)}
        {factRow("Ownership", companyInfo.ownership)}
        {factRow("Tech stack", companyInfo.techStack)}
        {factRow("Salary", role.salaryRange)}
        {factRow("Applicants", role.applicantCount, (n) => `${n} applicants`)}
        {factRow("Senior eng. headcount", role.seniorHeadcount)}
      </ul>
      <p className="muted">est = LLM's general knowledge, not verified — may be stale.</p>
    </div>
  );
}

function isBlank(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

function factRow<T>(label: string, fact: Fact<T>, format?: (value: T) => string): ReactNode {
  if (fact.value === null || isBlank(fact.value)) return null;
  const display = format ? format(fact.value) : Array.isArray(fact.value) ? fact.value.join(", ") : String(fact.value);
  return (
    <li key={label}>
      <span className="brief-label">{label}</span>
      <span>{display}</span>
      {fact.source === "llm-estimate" && <span className="source-badge">est</span>}
    </li>
  );
}
