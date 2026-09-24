# Options page — Settings

`src/options/SettingsPanel.tsx`. History is a separate page opened from the
panel's footer, not a tab in this one.

```
┌──────────────────────────────────────────────────────┐
│ Settings                                             │
│ OpenAI API key                                       │
│ ┌────────────────────────────┐ [ Verify & save ]     │
│ │ sk-…                       │  Verified and saved.  │ ← saving IS the test:
│ └────────────────────────────┘                       │   one real request
│ Model                                                │
│ gpt-4.1-mini                                      ▾  │
│   custom ⇒ ┌──────────────────────────┐ [ Use ]      │
│            │ e.g. gpt-4.1-2025-04-14  │              │
│ Reasoning effort                low               ▾  │ ← only for a
│ Higher effort thinks longer before answering —       │   reasoning-capable
│ slower, but more accurate on harder postings.        │   model
│ ────────────────────────────────────────────────     │
│ Resume profiles          [ + Upload resume (PDF/DOCX) ]
│  • Backend  (active)         [ Rename ] [ Delete ]   │
│  • Data                      [ Rename ] [ Delete ]   │
│  No resume profiles yet.                             │
│ ────────────────────────────────────────────────     │
│ Blocked companies & jobs                             │
│  Acme Staffing                        [ Unblock ]    │
│  Senior Backend Engineer · Acme       [ Unblock ]    │
│  None yet.                                           │
│ ────────────────────────────────────────────────     │
│ Company name block keywords                          │
│ A job is skipped automatically when its company name │
│ contains any of these.                               │
│  staffing                                  [ ✕ ]     │
│  None yet.                                           │
│ ┌──────────────────────────┐ [ Add ]                 │
│ │ e.g. Staffing Agency     │                         │
│ └──────────────────────────┘                         │
│ ────────────────────────────────────────────────     │
│ Role title block keywords                            │
│ A job is skipped automatically when its title        │
│ contains any of these.                               │
│  contract                                  [ ✕ ]     │
│ ┌──────────────────────────┐ [ Add ]                 │
│ │ e.g. Contract            │                         │
│ └──────────────────────────┘                         │
└──────────────────────────────────────────────────────┘
```

Four blocking mechanisms, one section each, in the order they bite: an
explicit job, an explicit company, a company-name keyword, a role-title
keyword. The panel's blocked state names which one applied and offers the
matching undo.
