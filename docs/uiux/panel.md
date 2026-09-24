# Side panel

`src/sidepanel/App.tsx` — the whole analysis product, ~380px wide.

```
┌─────────────────────────────────────┐
│ Senior Backend Engineer             │ ← falls back to page text / URL
│ → classified as: Data Engineer      │   row's own text, so it never sits
│ Acme Corp · San Francisco, CA       │   on "Detecting…" for a round trip
│ (Hybrid)                            │
│ Resume: Backend ▾               ⚠   │ ← ⚠ = last analysis errored; hover
│ ┌─────────────────────────────────┐ │   for the message. The error never
│ │        Re-analyze               │ │   replaces content already on screen
│ └─────────────────────────────────┘ │ ← its own full-width row
│ ▾ Day-to-day work                   │
│   Full-stack on an internal admin   │
│   app, but mostly backend…          │
│   Backend   ▓▓▓▓▓▓▓▓░░  80%        │
│   Frontend  ▓▓░░░░░░░░  20%        │
│ ▾ Why Say No                        │ ← as this team's hiring manager,
│   • No production Kubernetes; we    │   passing on you: 3-5 blunt reasons,
│     need clusters from day one.     │   most decisive first
│   • 4 years against our 7+.         │
│ ▾ Skill / Experience Match          │
│   Required   9/10                   │
│   Preferred  2/3                    │
│   Implied    4/6                    │
│   "5+ years of Python in prod"  req.│ ← the posting's own wording,
│     ▸ Python (42%) ⓘ            ✔  │   verbatim, and IT carries the tier
│   "Containerization and orchestra-  │   badge — not each skill
│    tion experience"             req.│
│     ▾ Container system (18%)    ✔  │
│       ├ Kubernetes (11%) ⓘ      ✘  │
│       ├ Docker (5%)         ✔ impl │ ← "impl" only on an inferred child,
│       └ Microservices (2%)  ✔ impl │   where the tier is new information
│ ▾ Company & Role Brief              │
│   Industry      Fintech        est  │
│   Headquarters  San Francisco  page │
│   Products      Payments API   est  │
│   Size          1,001-5,000    page │
│   Eng. size     ~300           est  │
│   ARR           ~$200M         est  │
│   Finance       Profitable     est  │
│   Ownership     Private, Series C   │ ← ownership folds funding stage in:
│   Tech stack    Python, Go, K8s est │   "Public" makes stage moot
│   Team          Payments Core  page │
│   Team mission  …              page │
│   Salary        $150000-$190000 page│ ← thousands commas stripped, so the
│   Applicants    87 applied     page │   range reads as one number
│   Senior level  40 applied     page │
│   est = the model's general knowledge, not verified — may be stale
│   ✎ every row edits in place; an all-blank row hides itself
│ ▾ Interview Process                 │
│   ⠿ 1  Recruiter screen        ✎ ✕  │ ← drag to reorder
│        "30-minute call…"            │ ← the posting's own line, quoted
│   ⠿ 2  System design    edited ✎ ✕  │ ← "edited" = yours, not the model's
│        [ + Add a round ]            │
├─────────────────────────────────────┤
│ Settings  History  Export as PDF·   │ ← Export as PDF disabled until an
│ Export entire DB                    │   analysis has succeeded
│ Block this job   Block this company │
└─────────────────────────────────────┘
 ⓘ hover → "~1,240 candidates in San Francisco, CA likely have this skill
   (est. from 8 postings you've analyzed here; rough heuristic, not
   verified)"
```

## Every state the panel can be in

```
 loading          Loading…
 read failed      Couldn't read this page: <error>
                  [[ Try again ]]
 stale tab        This tab was open before the extension loaded, so it
                  can't be read yet.
                  [[ Reload tab ]]        ← reloads, waits, then re-reads
 not a job page   Open a job posting on any website to analyze it.
 not recognized   Open a job posting to analyze it.  (local URL/text precheck failed;
                  header, navigation, sidebar, and footer text are excluded)
 no API key       Add an OpenAI API key to start analyzing.
                  [[ Open Settings ]]
 not a job post   This page doesn't appear to contain a specific job posting.
                  The extraction model rejected it; no resume comparison runs.
 no resume        Upload a resume to start analyzing.
                  [[ Open Settings ]]
 blocked (job)    <why>   [[ Unblock this job ]]     [ Open Settings ]
 blocked (company)<why>   [[ Unblock this company ]] [ Open Settings ]
 blocked (keyword)<why>   Manage blocked keywords in Settings.
                                                     [ Open Settings ]
 never analyzed   skeletons in every section — never an empty panel
 reading page     [[ Reading page… ]]·   + skeleton labelled "Reading page…"
 analyzing        [[ Analyzing… (12s) ]]· ← counts up every second
 stale pending    ⚠ Previous analysis didn't complete — click Analyze to
                  retry.   (a "pending" record older than 2 minutes; an
                  in-flight fetch dies with the service worker, so the panel
                  stops spinning rather than waiting forever)
 partial          a cached company brief can arrive before this job's own
                  analysis; role is stubbed blank rather than waited on
 no rounds found  No interview process found in this job description.
                  Add the rounds yourself as you learn them.
 no rejection note  Re-analyze to see the hiring manager's rejection note.
                  (a record analyzed before Why Say No existed)
```

The error only ever shows as the ⚠ icon in the toolbar. Whatever was already
known stays on screen through a pending, errored or unparsed status.
