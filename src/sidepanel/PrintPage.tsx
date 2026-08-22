// A dedicated, non-interactive rendering of one JobRecord, opened in a normal
// tab (not the side panel) so window.print() actually works — see main.tsx.
// The requirement tree starts pre-expanded since there's no interaction to expand it with.

import { useEffect } from "react";
import { CompanyRoleBrief } from "./CompanyRoleBrief";
import { InterviewRounds } from "./InterviewRounds";
import { RequirementTree } from "./RequirementTree";
import { TierSummary } from "./App";
import type { JobRecord } from "../shared/types";

export function PrintPage({ record }: { record: JobRecord }) {
  useEffect(() => {
    // Let the initial (fully expanded) layout paint before printing.
    const id = setTimeout(() => window.print(), 300);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="app">
      <header className="job-header">
        <h2>{record.jobTitle ?? record.id}</h2>
        {record.roleClassification && <p className="muted">→ classified as: {record.roleClassification.normalizedRole}</p>}
        <p className="subtitle">
          {record.company ?? ""}
          {record.location ? ` · ${record.location}` : ""}
          {record.workplaceType ? ` (${record.workplaceType})` : ""}
        </p>
      </header>

      {record.companyInfo && record.role && <CompanyRoleBrief record={record} />}

      <div className="card">
        <h3>Skill / Experience Match</h3>
        <TierSummary requirements={record.requirements} />
        <RequirementTree nodes={record.requirements} prevalenceTooltip={() => null} />
      </div>

      <InterviewRounds record={record} />

      <button type="button" onClick={() => window.print()}>
        Print / Save as PDF
      </button>
    </div>
  );
}
