// Background service worker: side panel setup + the ANALYZE message handler.
// The handler acks quickly (after writing a "pending" record) and lets the
// actual LLM call run to completion independent of the message channel — see
// docs/DESIGN.md "Task durability" for why.

import { getSettings } from "../shared/storage";
import { getCompanyRecord, upsertCompanyRecord } from "../shared/db";
import { extractCompanySlugHint, normalizeCompanyKey } from "../shared/companyKey";
import type { AnalyzeAck, AnalyzeRequest } from "../shared/messaging";
import { broadcastJobRecordUpdated, isAnalyzeRequest } from "../shared/messaging";
import { buildExtractionPrompt, buildRequirementsPrompt } from "./llm/promptBuilder";
import { callOpenAI } from "./llm/openaiClient";
import { parseExtractionResponse, parseRequirementsResponse } from "./llm/responseParser";
import { beginAnalysis, completeAnalysisError, completeAnalysisOk, completeAnalysisUnparsed } from "./historyStore";
import { blankCompanyInfo } from "../shared/types";
import type { AnalysisResult, CompanyInfo, CompanyRecord, ReasoningEffort } from "../shared/types";

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Failed to set side panel behavior", error));

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isAnalyzeRequest(message)) return undefined;
  handleAnalyzeRequest(message).then(sendResponse);
  return true; // async response
});

async function handleAnalyzeRequest(request: AnalyzeRequest): Promise<AnalyzeAck> {
  const settings = await getSettings();
  if (!settings.openaiApiKey) {
    return { ok: false, error: "No OpenAI API key set. Add one in Settings." };
  }

  const profile = settings.resumeProfiles.find((p) => p.id === request.resumeProfileId);
  if (!profile) {
    return { ok: false, error: "Selected resume profile not found." };
  }

  // Best-effort company guess from the URL, so the prompt can skip re-deriving companyInfo when we
  // already have it cached — see shared/companyKey.ts for why this is a hint, not ground truth. Looked
  // up *before* beginAnalysis so a cache hit can seed the pending record immediately: the brief's
  // company fields then render right away instead of waiting behind the whole LLM round-trip.
  const slugHint = extractCompanySlugHint(request.url);
  const slugKey = slugHint ? normalizeCompanyKey(slugHint) : null;
  const cached = slugKey ? await getCompanyRecord(slugKey) : undefined;

  try {
    await beginAnalysis({
      jobId: request.jobId,
      url: request.url,
      resumeProfileId: profile.id,
      resumeProfileName: profile.name,
      cachedCompanyInfo: cached?.companyInfo,
    });
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
  broadcastJobRecordUpdated(request.jobId);

  // Fire-and-forget: the caller already has its ack; this keeps running (and
  // keeps writing to IndexedDB) even if the side panel that asked closes.
  runAnalysis(request, settings.openaiApiKey, settings.openaiModel, settings.openaiReasoningEffort, profile.text, cached, slugKey).catch(
    (error) => {
      console.error("Unhandled error running analysis", error);
    },
  );

  return { ok: true };
}

async function runAnalysis(
  request: AnalyzeRequest,
  apiKey: string,
  model: string,
  reasoningEffort: ReasoningEffort,
  resumeText: string,
  cached: CompanyRecord | undefined,
  slugKey: string | null,
): Promise<void> {
  try {
    const extractionPrompt = buildExtractionPrompt({
      rawPageText: request.rawPageText,
      cachedCompanyInfo: cached ? { name: cached.name, info: cached.companyInfo } : null,
    });
    const requirementsPrompt = buildRequirementsPrompt({ resumeText, rawPageText: request.rawPageText });

    // Two independent calls run concurrently instead of one prompt that pays for both instruction sets
    // serially — extraction doesn't need the requirement tree's rules/skill-reference bulk (or the resume
    // at all), and requirements doesn't need the company/role instructions. See promptBuilder.ts.
    const [extractionRaw, requirementsRaw] = await Promise.all([
      callOpenAI({ prompt: extractionPrompt, apiKey, model, reasoningEffort }),
      callOpenAI({ prompt: requirementsPrompt, apiKey, model, reasoningEffort }),
    ]);
    const extractionParsed = parseExtractionResponse(extractionRaw);
    const requirementsParsed = parseRequirementsResponse(requirementsRaw);

    if (!extractionParsed.ok || !requirementsParsed.ok) {
      const rawText = [
        !extractionParsed.ok ? `[extraction]\n${extractionParsed.rawText}` : null,
        !requirementsParsed.ok ? `[requirements]\n${requirementsParsed.rawText}` : null,
      ]
        .filter((part): part is string => part !== null)
        .join("\n\n");
      const reason = [
        !extractionParsed.ok ? `extraction: ${extractionParsed.reason}` : null,
        !requirementsParsed.ok ? `requirements: ${requirementsParsed.reason}` : null,
      ]
        .filter((part): part is string => part !== null)
        .join("; ");
      await completeAnalysisUnparsed(request.jobId, rawText, reason);
      return;
    }

    const companyInfo = extractionParsed.result.companyInfo ?? cached?.companyInfo ?? blankCompanyInfo();
    const result: AnalysisResult = { ...extractionParsed.result, companyInfo, requirements: requirementsParsed.result.requirements };
    await completeAnalysisOk(request.jobId, result);

    // Only persist when freshly derived — a cache hit already reflects
    // what's stored, no need to rewrite it.
    if (extractionParsed.result.companyInfo) {
      await cacheCompanyInfo(result.company, companyInfo, slugKey);
    }
  } catch (error) {
    await completeAnalysisError(request.jobId, (error as Error).message);
  } finally {
    broadcastJobRecordUpdated(request.jobId);
  }
}

async function cacheCompanyInfo(companyName: string, companyInfo: CompanyInfo, slugKey: string | null): Promise<void> {
  const nameKey = normalizeCompanyKey(companyName);
  const updatedAt = new Date().toISOString();
  const record: CompanyRecord = { key: nameKey, name: companyName, companyInfo, updatedAt };
  await upsertCompanyRecord(record);
  // The URL-slug key can differ from the name-derived key (e.g. "Affirm, Inc." vs "affirm") —
  // store under both so a future slug-based lookup for this company still hits.
  if (slugKey && slugKey !== nameKey) {
    await upsertCompanyRecord({ ...record, key: slugKey });
  }
}
