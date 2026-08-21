import { useState, type ReactNode } from "react";
import { useActiveJob } from "./useActiveJob";
import { useSettings } from "../shared/useSettings";
import { useSkillPrevalence } from "./useSkillPrevalence";
import { requestAnalyze } from "../shared/messaging";
import { setActiveResumeProfile } from "../shared/storage";
import { countByTier } from "../shared/matchFacts";
import { isStalePending } from "../shared/jobStatus";
import { normalizeSkillName } from "../shared/skillPrevalence";
import { RequirementTree } from "./RequirementTree";
import { CompanyRoleBrief } from "./CompanyRoleBrief";
import type { JobRecord, RequirementTier } from "../shared/types";

const TIER_LABELS: Record<RequirementTier, string> = {
  "must-have": "Required",
  "nice-to-have": "Preferred",
  implied: "Implied",
};

export function App() {
  const { pageInfo, record, loading } = useActiveJob();
  const settings = useSettings();
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const activeProfile = settings.resumeProfiles.find((p) => p.id === settings.activeResumeProfileId) ?? null;
  const prevalence = useSkillPrevalence(record?.regionBucket ?? null);

  function prevalenceTooltip(skill: string): string | null {
    const region = record?.regionBucket;
    if (!region) return null;
    if (!prevalence.sufficientData) {
      return `Not enough data yet in ${region} — analyze a few more postings here first.`;
    }
    const estimate = prevalence.estimates.get(normalizeSkillName(skill));
    if (estimate === undefined) return null;
    return `~${estimate.toLocaleString()} candidates in ${region} likely have this skill (estimated from ${prevalence.qualifyingJobCount} postings you've analyzed here; rough heuristic, not verified).`;
  }

  async function handleAnalyze() {
    if (!pageInfo?.jobId || !activeProfile) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    const ack = await requestAnalyze({
      jobId: pageInfo.jobId,
      url: pageInfo.url,
      rawPageText: pageInfo.rawPageText,
      resumeProfileId: activeProfile.id,
    });
    setAnalyzing(false);
    if (!ack.ok) setAnalyzeError(ack.error ?? "Analysis failed to start.");
  }

  if (loading) return <Shell>Loading…</Shell>;
  if (!pageInfo?.jobId) return <Shell>Open a LinkedIn job posting to analyze it.</Shell>;
  if (!settings.openaiApiKey) return <Shell>Add an OpenAI API key in Settings to start analyzing.</Shell>;
  if (!activeProfile) return <Shell>Upload a resume in Settings to start analyzing.</Shell>;

  const isPendingFresh = record?.status === "pending" && !isStalePending(record);
  const isPendingStale = record?.status === "pending" && isStalePending(record);
  const busy = analyzing || isPendingFresh;

  return (
    <Shell>
      <h2>{record?.jobTitle ?? "Detecting…"}</h2>
      {record?.roleClassification && <p className="muted">→ classified as: {record.roleClassification.normalizedRole}</p>}
      <p>
        {record?.company ?? ""}
        {record?.location ? ` · ${record.location}` : ""}
      </p>

      <label>
        Resume:{" "}
        <select value={activeProfile.id} onChange={(e) => void setActiveResumeProfile(e.target.value)}>
          {settings.resumeProfiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <button onClick={handleAnalyze} disabled={busy}>
        {busy ? "Analyzing…" : record?.status === "ok" ? "Re-analyze" : "Analyze"}
      </button>

      {analyzeError && <p className="error">{analyzeError}</p>}
      {isPendingStale && <p className="error">Previous analysis didn't complete — click Analyze to retry.</p>}
      {record?.status === "error" && <p className="error">{record.errorMessage}</p>}
      {record?.status === "unparsed" && <p className="error">Couldn't parse the response: {record.errorMessage}</p>}

      {record?.status === "ok" && record.companyInfo && record.role && (
        <CompanyRoleBrief companyInfo={record.companyInfo} role={record.role} />
      )}
      {record?.status === "ok" && <TierSummary requirements={record.requirements} />}
      {record?.status === "ok" && (
        <RequirementTree nodes={record.requirements} prevalenceTooltip={prevalenceTooltip} />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="app">{children}</div>;
}

function TierSummary({ requirements }: { requirements: JobRecord["requirements"] }) {
  const counts = countByTier(requirements);
  return (
    <ul className="tier-summary">
      {(Object.keys(TIER_LABELS) as RequirementTier[]).map((tier) => (
        <li key={tier}>
          {TIER_LABELS[tier]}: {counts[tier].matched}/{counts[tier].total}
        </li>
      ))}
    </ul>
  );
}
