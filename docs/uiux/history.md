# History and print

## History  `src/options/HistoryPanel.tsx`

Opened as its own tab from the side panel's footer.

```
┌────────────────────────────────────────────────────────────────┐
│ History                                                        │
│ All profiles ▾   [ Export entire DB ]·  [ Clear history ]·      │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Title             Company   Location    Resume  Status  Analyzed│
│ ├────────────────────────────────────────────────────────────┤ │
│ │ Senior Backend…   Acme      San Fran…   Backend ok      Sep 16 │
│ │ Data Engineer     Globex    Remote      Data    pending  Sep 14 │
│ │ Platform Eng…     Initech   NYC         Backend error   Sep 12 │
│ └────────────────────────────────────────────────────────────┘ │
│ (both buttons disabled with an empty history)                  │
└────────────────────────────────────────────────────────────────┘
```

Filter by resume profile, because the same posting analyzed against two
resumes is two different answers.

## Print page  `src/sidepanel/PrintPage.tsx`

A side panel can't reliably print, so `Export as PDF` opens the same
render in a normal tab keyed by job id, and prints from there.

```
 chrome-extension://…/src/sidepanel/index.html?printJobId=<id>
┌──────────────────────────────────────────────────────────────┐
│ Senior Backend Engineer — Acme Corp                          │
│ San Francisco, CA (Hybrid) · analyzed Sep 16, 2026           │
│ ── Company & Role Brief ────────────────────────────────────  │
│ (the same rows, laid out for a page instead of a 380px panel)│
│ ── Day-to-day work ────────────────────────────────────────  │
│ ── Skill / Experience Match ───────────────────────────────  │
│ ── Interview Process ──────────────────────────────────────  │
└──────────────────────────────────────────────────────────────┘
 print-only layout: no footer buttons, no collapsers, nothing that
 only works with a cursor
```
