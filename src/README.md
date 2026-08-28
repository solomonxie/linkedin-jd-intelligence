# Code map

This file's job is to help you find your way around `src/` and the config files. For the full
design (architecture, diagrams, data model, algorithms), see [`docs/DESIGN.md`](../docs/DESIGN.md).

## How a click on "Analyze" actually flows

Read top to bottom; each arrow is "calls" or "sends a message to".

```
0) Build time
   manifest.config.ts  (MV3 manifest, read by vite.config.ts via @crxjs/vite-plugin)
     -> wires up every entry point named below into dist/manifest.json

1) A LinkedIn job tab is open
   src/content-scripts/linkedin/main.ts              (content script entry)
     -> src/content-scripts/linkedin/scraper.ts
          scrapeJobId()        - regex on the URL, not the DOM
          scrapeRawPageText()  - `main` landmark -> document.body fallback, length-capped
          watches MutationObserver + URL changes (LinkedIn is an SPA)
     -> src/content-scripts/linkedin/listFilter.ts
          hides job cards matching the block list on LinkedIn's own list pages
          (search-results, "related jobs") — see docs/DESIGN.md "List hiding"
     -> listens for GET_PAGE_INFO                    [src/shared/messaging.ts]

2) User opens the side panel (toolbar icon)
   src/sidepanel/index.html -> main.tsx -> App.tsx
     on tab focus/change:
       requestPageInfo(tabId)                        [src/shared/messaging.ts]
         -> content script (step 1) responds { jobId, rawPageText }
       getJobRecord(jobId)                            [src/shared/db.ts]
         -> cached record found  -> render brief + requirement tree
         -> nothing cached       -> render "Analyze" button only

3) User clicks Analyze
   App.tsx
     -> requestAnalyze({ jobId, url, rawPageText, resumeProfileId })
                                                       [src/shared/messaging.ts]
          -> src/background/index.ts  (message router, picks up ANALYZE)

4) Background does the work (survives the side panel/tab closing — see
   docs/DESIGN.md "Task durability")
   src/background/index.ts
     -> upsertJobRecord({ status: "pending", ... })   [src/shared/db.ts]
     -> getSettings()                                 [src/shared/storage.ts]
          resolves the API key/model + the active resume profile's text
     -> buildExtractionPrompt({ rawPageText, cachedCompanyInfo })
        buildRequirementsPrompt({ resumeText, rawPageText })
                                                       [src/background/llm/promptBuilder.ts]
          extraction uses ROLE_TAXONOMY                [src/shared/roleTaxonomy.ts]
          requirements uses SKILL_PRESETS              [src/background/llm/skillPresets.ts]
     -> Promise.all, run concurrently:
          callOpenAI(extractionPrompt, apiKey, model)  [src/background/llm/openaiClient.ts]
          callOpenAI(requirementsPrompt, apiKey, model)
          -> fetch https://api.openai.com/... (x2)
     -> parseExtractionResponse(rawText)                [src/background/llm/responseParser.ts]
        parseRequirementsResponse(rawText)
          zod-validates each, merged into one AnalysisResult [src/shared/types.ts]
     -> upsertJobRecord({ status: "ok"|"unparsed"|"error", ... })
                                                       [src/shared/db.ts]
     -> broadcastJobRecordUpdated(jobId)               [src/shared/messaging.ts]
          -> any open side panel re-reads getJobRecord() and re-renders

5) Side panel renders the result
   App.tsx
     -> matchFacts.ts        per-tier n/m + locally renormalized weights (top-level nodes only)
     -> skillPrevalence.ts   ⓘ hover estimate, reads getAllJobRecords() [src/shared/db.ts]

6) Options page (settings + history — separate from the flow above)
   src/options/index.html -> main.tsx -> App.tsx
     Settings section -> src/shared/storage.ts (API key, model, resume profiles, block list)
     Resume upload    -> src/shared/resumeParser/{pdfParser,docxParser,index}.ts
     History section  -> src/shared/db.ts (getAllJobRecords / by profile / by region)
```

## Layout

- `manifest.config.ts`, `vite.config.ts`, `tsconfig.json` — build/MV3 config, start here to see what gets built and how.
- `src/background/` — the service worker; all LLM calls and cache writes happen here, not in the UI.
- `src/content-scripts/linkedin/` — the only code that touches LinkedIn's DOM: raw text + a URL-derived job id for scraping (no per-field selectors), plus the block-list list-hiding pass.
- `src/sidepanel/`, `src/options/` — the two React UI surfaces.
- `src/shared/` — everything both sides depend on: types, storage/db wrappers, the messaging envelope, the block-list check, and the pure computation modules (`matchFacts.ts`, `skillPrevalence.ts`, `resumeParser/`).
