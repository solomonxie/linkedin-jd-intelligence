// Background service worker: side panel setup + the ANALYZE message handler.
// The handler acks quickly (after writing a "pending" record) and lets the
// actual LLM call run to completion independent of the message channel — see
// docs/DESIGN.md "Task durability" for why.

import { getSettings } from "../shared/storage";
import type { AnalyzeAck, AnalyzeRequest } from "../shared/messaging";
import { broadcastJobRecordUpdated, isAnalyzeRequest } from "../shared/messaging";
import { buildAnalysisPrompt } from "./llm/promptBuilder";
import { callOpenAI } from "./llm/openaiClient";
import { parseAnalysisResponse } from "./llm/responseParser";
import { beginAnalysis, completeAnalysisError, completeAnalysisOk, completeAnalysisUnparsed } from "./historyStore";

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

  try {
    await beginAnalysis({
      jobId: request.jobId,
      url: request.url,
      resumeProfileId: profile.id,
      resumeProfileName: profile.name,
    });
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
  broadcastJobRecordUpdated(request.jobId);

  // Fire-and-forget: the caller already has its ack; this keeps running (and
  // keeps writing to IndexedDB) even if the side panel that asked closes.
  runAnalysis(request, settings.openaiApiKey, settings.openaiModel, profile.text).catch((error) => {
    console.error("Unhandled error running analysis", error);
  });

  return { ok: true };
}

async function runAnalysis(
  request: AnalyzeRequest,
  apiKey: string,
  model: string,
  resumeText: string,
): Promise<void> {
  try {
    const prompt = buildAnalysisPrompt({ resumeText, rawPageText: request.rawPageText });
    const rawResponse = await callOpenAI({ prompt, apiKey, model });
    const parsed = parseAnalysisResponse(rawResponse);
    if (parsed.ok) {
      await completeAnalysisOk(request.jobId, parsed.result);
    } else {
      await completeAnalysisUnparsed(request.jobId, parsed.rawText, parsed.reason);
    }
  } catch (error) {
    await completeAnalysisError(request.jobId, (error as Error).message);
  } finally {
    broadcastJobRecordUpdated(request.jobId);
  }
}
