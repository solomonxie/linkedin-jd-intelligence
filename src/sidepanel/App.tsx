import { useEffect, useRef, useState, type ReactNode } from "react";
import { useActiveJob } from "./useActiveJob";
import { useSettings } from "../shared/useSettings";
import { useSkillPrevalence } from "./useSkillPrevalence";
import { requestAnalyze } from "../shared/messaging";
import { blockCompany, blockJob, setActiveResumeProfile, unblockCompany, unblockJob } from "../shared/storage";
import { downloadAllData } from "../shared/exportData";
import { countByTier } from "../shared/matchFacts";
import { isStalePending } from "../shared/jobStatus";
import { normalizeSkillName } from "../shared/skillPrevalence";
import { extractCompanySlugHint, extractTitleSlugHint, humanizeSlug } from "../shared/companyKey";
import { blockReasonText, checkBlocked } from "../shared/blockList";
import { RequirementTree, RequirementTreeSkeleton } from "./RequirementTree";
import { CompanyRoleBrief, CompanyRoleBriefSkeleton } from "./CompanyRoleBrief";
import { InterviewRounds } from "./InterviewRounds";
import type { JobRecord, RequirementTier } from "../shared/types";

const TIER_LABELS: Record<RequirementTier, string> = {
  "must-have": "Required",
  "nice-to-have": "Preferred",
  implied: "Implied",
};

export function App() {
  const { tabId, pageInfo, record, loading, contentScriptMissing, refresh } = useActiveJob();
  const settings = useSettings();
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const activeProfile = settings.resumeProfiles.find((p) => p.id === settings.activeResumeProfileId) ?? null;
  const prevalence = useSkillPrevalence(record?.regionBucket ?? null);

  // Best-known company/title for the block check and for Block this job/company: the analyzed
  // record's exact value once one exists, otherwise whatever the content script could read straight
  // off the job's own row in a currently-rendered LinkedIn list (no LLM call — see
  // listFilter.ts's findCurrentJobCardInfo), otherwise a best-effort guess from the job URL's SEO
  // slug (mostly dead on current LinkedIn markup, kept as a last-resort fallback). A miss at every
  // level just means blocking/keyword-matching can't apply until the job is analyzed.
  const companySlugHint = pageInfo?.url ? extractCompanySlugHint(pageInfo.url) : null;
  const titleSlugHint = pageInfo?.url ? extractTitleSlugHint(pageInfo.url) : null;
  const bestCompany = record?.company ?? pageInfo?.company ?? (companySlugHint ? humanizeSlug(companySlugHint) : null);
  const bestJobTitle = record?.jobTitle ?? pageInfo?.jobTitle ?? (titleSlugHint ? humanizeSlug(titleSlugHint) : null);
  const blockReason = pageInfo?.jobId
    ? checkBlocked(settings, { jobId: pageInfo.jobId, company: bestCompany, jobTitle: bestJobTitle })
    : null;

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

  const isPendingFresh = record?.status === "pending" && !isStalePending(record);
  const isPendingStale = record?.status === "pending" && isStalePending(record);
  const busy = analyzing || isPendingFresh;

  const errorMessage =
    analyzeError ??
    (isPendingStale ? "Previous analysis didn't complete — click Analyze to retry." : null) ??
    (record?.status === "error" ? record.errorMessage : null) ??
    (record?.status === "unparsed" ? `Couldn't parse the response: ${record.errorMessage}` : null);

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

  // Auto-analyze the first time we see a given job: only while it's a valid,
  // never-before-seen JD page (record === null) with everything needed already
  // configured. Guarded per jobId so it fires once, not on every render — once
  // analysis starts, beginAnalysis() writes a "pending" record which flips
  // `record` away from null and stops this from re-firing.
  const autoAnalyzedJobId = useRef<string | null>(null);
  useEffect(() => {
    const jobId = pageInfo?.jobId;
    if (!jobId || !activeProfile || !settings.openaiApiKey) return;
    if (blockReason) return;
    if (record !== null) return;
    if (autoAnalyzedJobId.current === jobId) return;
    autoAnalyzedJobId.current = jobId;
    void handleAnalyze();
  }, [pageInfo?.jobId, activeProfile, settings.openaiApiKey, record, blockReason]);

  // OpenAI's response isn't streamed, so there's no real completion percentage —
  // an elapsed-time counter is the honest "progress info" available. Ticks once
  // a second only while a request is actually in flight.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [busy]);

  const elapsedSeconds = isPendingFresh && record ? Math.max(0, Math.floor((Date.now() - new Date(record.startedAt).getTime()) / 1000)) : 0;

  if (loading) return <Shell><p className="empty-state">Loading…</p></Shell>;
  if (contentScriptMissing) {
    return (
      <Shell>
        <div className="empty-state">
          <p>This tab was open before the extension loaded, so it can't be read yet.</p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              if (tabId === null) return;
              // A same-tab reload doesn't change tabId, so nothing re-triggers
              // the page-info fetch on its own — wait for this reload to
              // finish (new content script attached) and refresh explicitly.
              const onUpdated = (updatedTabId: number, info: chrome.tabs.OnUpdatedInfo) => {
                if (updatedTabId !== tabId || info.status !== "complete") return;
                chrome.tabs.onUpdated.removeListener(onUpdated);
                refresh();
              };
              chrome.tabs.onUpdated.addListener(onUpdated);
              chrome.tabs.reload(tabId);
            }}
          >
            Reload tab
          </button>
        </div>
      </Shell>
    );
  }
  if (!pageInfo?.jobId) {
    return (
      <Shell>
        <p className="empty-state">Open a LinkedIn job posting to analyze it.</p>
      </Shell>
    );
  }
  if (blockReason) {
    return (
      <Shell>
        <div className="empty-state">
          <p>{blockReasonText(blockReason)}</p>
          {blockReason.type === "job" && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => void unblockJob(blockReason.jobId).then(refresh)}
            >
              Unblock this job
            </button>
          )}
          {blockReason.type === "company" && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => void unblockCompany(blockReason.key).then(refresh)}
            >
              Unblock this company
            </button>
          )}
          {(blockReason.type === "company-keyword" || blockReason.type === "role-keyword") && (
            <p className="muted">Manage blocked keywords in Settings.</p>
          )}
          <button type="button" onClick={() => chrome.runtime.openOptionsPage()}>
            Open Settings
          </button>
        </div>
      </Shell>
    );
  }
  if (!settings.openaiApiKey) {
    return (
      <Shell>
        <div className="empty-state">
          <p>Add an OpenAI API key to start analyzing.</p>
          <button type="button" className="btn-primary" onClick={() => chrome.runtime.openOptionsPage()}>
            Open Settings
          </button>
        </div>
      </Shell>
    );
  }
  if (!activeProfile) {
    return (
      <Shell>
        <div className="empty-state">
          <p>Upload a resume to start analyzing.</p>
          <button type="button" className="btn-primary" onClick={() => chrome.runtime.openOptionsPage()}>
            Open Settings
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="job-header">
        <h2>{record?.jobTitle ?? "Detecting…"}</h2>
        {record?.roleClassification && <p className="muted">→ classified as: {record.roleClassification.normalizedRole}</p>}
        <p className="subtitle">
          {record?.company ?? ""}
          {record?.location ? ` · ${record.location}` : ""}
          {record?.workplaceType ? ` (${record.workplaceType})` : ""}
        </p>
      </header>

      <div className="toolbar">
        <label>
          Resume:
          <select value={activeProfile.id} onChange={(e) => void setActiveResumeProfile(e.target.value)}>
            {settings.resumeProfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className="btn-primary" onClick={handleAnalyze} disabled={busy}>
          {busy ? `Analyzing… (${elapsedSeconds}s)` : record?.status === "ok" ? "Re-analyze" : "Analyze"}
        </button>

        {errorMessage && (
          <span className="error-icon" role="img" aria-label="Analysis error" title={errorMessage}>
            ⚠
          </span>
        )}
      </div>

      {/* Whatever's already known (a previous successful analysis, or nothing yet) stays on screen
          through a pending/error/unparsed status instead of being replaced by an error block — the
          error itself only ever shows as the icon above, never blocking the content area. */}
      {record && (
        <>
          {record.companyInfo && record.role ? (
            <CompanyRoleBrief record={record} onSaved={refresh} />
          ) : (
            <CompanyRoleBriefSkeleton />
          )}
          <div className="card">
            <h3>Skill / Experience Match</h3>
            {record.requirements.length > 0 ? (
              <>
                <TierSummary requirements={record.requirements} />
                <RequirementTree nodes={record.requirements} prevalenceTooltip={prevalenceTooltip} />
              </>
            ) : (
              <RequirementTreeSkeleton />
            )}
          </div>
          <InterviewRounds record={record} onSaved={refresh} />
        </>
      )}

      <footer className="app-footer">
        <button type="button" onClick={() => chrome.runtime.openOptionsPage()}>
          Settings
        </button>
        <button
          type="button"
          onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL("src/options/index.html?tab=history") })}
        >
          History
        </button>
        <button
          type="button"
          disabled={record?.status !== "ok"}
          onClick={() => {
            if (!record) return;
            // A side panel can't reliably print (Chrome restricts window.print()
            // there) — open the same page as a normal tab with the job id, where
            // printing works, and print from there instead.
            chrome.tabs.create({ url: chrome.runtime.getURL(`src/sidepanel/index.html?printJobId=${record.id}`) });
          }}
        >
          Export as PDF
        </button>
        <button type="button" onClick={() => void downloadAllData()}>
          Export entire DB
        </button>
        <button
          type="button"
          disabled={!pageInfo?.jobId}
          onClick={() => {
            if (!pageInfo?.jobId) return;
            void blockJob({
              jobId: pageInfo.jobId,
              jobTitle: bestJobTitle ?? "",
              company: bestCompany ?? "",
              url: pageInfo.url,
            }).then(refresh);
          }}
        >
          Block this job
        </button>
        <button
          type="button"
          disabled={!bestCompany}
          onClick={() => {
            if (!bestCompany) return;
            void blockCompany(bestCompany, pageInfo?.url).then(refresh);
          }}
        >
          Block this company
        </button>
      </footer>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="app">{children}</div>;
}

export function TierSummary({ requirements }: { requirements: JobRecord["requirements"] }) {
  const counts = countByTier(requirements);
  return (
    <ul className="tier-summary">
      {(Object.keys(TIER_LABELS) as RequirementTier[]).map((tier) => (
        <li key={tier} data-tier={tier}>
          {TIER_LABELS[tier]}: {counts[tier].matched}/{counts[tier].total}
        </li>
      ))}
    </ul>
  );
}
